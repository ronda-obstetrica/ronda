// O service worker precisa listar todo arquivo que o app usa; um faltante só quebraria offline, em campo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(RAIZ, 'sw.js'), 'utf8');
const ARQUIVOS = JSON.parse(/const ARQUIVOS = (\[[\s\S]*?\]);/.exec(sw)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

function arquivosJs(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivosJs(p) : n.endsWith('.js') ? [p] : [];
  });
}
const RE_IMPORT = /(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

test('VERSAO definida', () => assert.match(sw, /const VERSAO = 'ronda-v2-\d+'/));

test('todo caminho de ARQUIVOS existe no disco', () => {
  assert.ok(ARQUIVOS.length > 20);
  for (const a of ARQUIVOS) assert.ok(existsSync(join(RAIZ, a)), `falta no disco: ${a}`);
});

test('todo arquivo de js/** e todo import estão em ARQUIVOS', () => {
  const lista = new Set(ARQUIVOS);
  const faltam = [];
  for (const arq of arquivosJs(join(RAIZ, 'js'))) {
    const rel = relative(RAIZ, arq).split(sep).join('/');
    if (!lista.has(rel)) faltam.push(rel);
    for (const m of readFileSync(arq, 'utf8').matchAll(RE_IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec.startsWith('.')) continue;
      const alvo = relative(RAIZ, resolve(dirname(arq), spec)).split(sep).join('/');
      if (!lista.has(alvo)) faltam.push(`${rel} -> ${alvo}`);
    }
  }
  assert.deepEqual(faltam, []);
});

test('index.html, vendor, manifest e ícones estão em ARQUIVOS', () => {
  const lista = new Set(ARQUIVOS);
  for (const a of ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'vendor/xlsx.mini.min.js',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png', 'icons/apple-touch-icon.png']) {
    assert.ok(lista.has(a), `falta em ARQUIVOS: ${a}`);
  }
  const man = JSON.parse(readFileSync(join(RAIZ, 'manifest.webmanifest'), 'utf8'));
  for (const i of man.icons) assert.ok(lista.has(i.src), `ícone do manifest fora de ARQUIVOS: ${i.src}`);
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="((?!https?:)[^"#]+)"/g)) assert.ok(lista.has(m[1]), `index.html usa ${m[1]} fora de ARQUIVOS`);
});
