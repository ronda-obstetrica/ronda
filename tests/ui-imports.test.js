// Garante que toda importação relativa em js/** aponta para um arquivo existente
// (sem navegador, um caminho errado só apareceria ao abrir o app) e que os módulos de UI
// importáveis no Node exportam o contrato render/acoes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function arquivosJs(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivosJs(p) : n.endsWith('.js') ? [p] : [];
  });
}

const RE_IMPORT = /(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

test('toda importação relativa em js/** resolve para um arquivo existente', () => {
  const quebradas = [];
  let total = 0;
  for (const arq of arquivosJs(join(RAIZ, 'js'))) {
    const src = readFileSync(arq, 'utf8');
    for (const m of src.matchAll(RE_IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec.startsWith('.')) continue;
      total++;
      if (!existsSync(join(dirname(arq), spec))) quebradas.push(`${relative(RAIZ, arq)} → ${spec}`);
    }
  }
  assert.ok(total > 20, `poucas importações encontradas (${total}); o scanner pode estar quebrado`);
  assert.deepEqual(quebradas, []);
});

test('index.html carrega js/app.js como módulo e styles.css', () => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
  assert.match(html, /<script type="module" src="js\/app\.js"><\/script>/);
  assert.match(html, /href="styles\.css"/);
  assert.match(html, /lang="pt-BR"/);
});

test('censo.js exporta render e acoes (módulo sem DOM no topo)', async () => {
  const censo = await import('../js/ui/censo.js');
  assert.equal(typeof censo.render, 'function');
  assert.equal(typeof censo.acoes, 'object');
  for (const k of ['mod', 'alerta-feito', 'alerta-pend', 'pend-feito', 'pend-aguardando', 'registrar-valor', 'alta']) {
    assert.equal(typeof censo.acoes[k], 'function', `falta a ação ${k}`);
  }
});

test('formularios.js exporta acoes do cadastro e das folhas', async () => {
  const f = await import('../js/ui/formularios.js');
  for (const k of ['novo', 'editar', 'paciente-salvar', 'mod-op', 'alerta-feito-salvar', 'pend-feito-salvar']) {
    assert.equal(typeof f.acoes[k], 'function', `falta a ação ${k}`);
  }
});

test('nenhum campo de identificação no cadastro', async () => {
  const { htmlCadastro } = await import('../js/ui/formularios.js');
  const html = htmlCadastro(null, '2026-11-08').toLowerCase();
  for (const proibido of ['nome', 'inicia', 'prontu', 'nascim', 'telefone', 'hospital']) {
    assert.ok(!new RegExp(`name="[^"]*${proibido}`).test(html), `campo proibido: ${proibido}`);
  }
});

test('telas da Task 14 exportam render e acoes (módulos sem DOM no topo)', async () => {
  const esperadas = {
    hoje: ['alerta-feito', 'alerta-pend', 'pend-feito', 'pend-aguardando', 'pend-desfazer', 'pend-dose'],
    plantao: ['plantao-copiar', 'plantao-pdf', 'plantao-planilha'],
    protocolos: ['prot-salvar', 'prot-validar', 'ver-globais', 'copiar-globais'],
    dados: ['backup-exportar', 'backup-restaurar', 'apagar-exemplos', 'apagar-tudo'],
  };
  for (const [nome, acoes] of Object.entries(esperadas)) {
    const m = await import(`../js/ui/${nome}.js`);
    assert.equal(typeof m.render, 'function', `${nome}.render`);
    assert.equal(typeof m.acoes, 'object', `${nome}.acoes`);
    for (const k of acoes) assert.equal(typeof m.acoes[k], 'function', `${nome}: falta a ação ${k}`);
  }
  const censo = await import('../js/ui/censo.js');
  for (const k of ['pend-nova', 'pend-nova-salvar']) assert.equal(typeof censo.acoes[k], 'function', `censo: falta ${k}`);
});

test('app.js registra as telas da Task 14 em TELAS', () => {
  const src = readFileSync(join(RAIZ, 'js', 'app.js'), 'utf8');
  for (const n of ['hoje', 'plantao', 'protocolos', 'dados']) assert.match(src, new RegExp(`from '\./ui/${n}\.js'`));
  assert.match(src, /const TELAS = \{ censo, hoje: telaHoje, plantao, protocolos, dados \}/);
  assert.doesNotMatch(src, /xlsx/i, 'a biblioteca da planilha não carrega na partida');
});

test('app.js: atualizar só adota o novo estado depois de calcular e desenhar sem erro', () => {
  const src = readFileSync(join(RAIZ, 'js', 'app.js'), 'utf8');
  const corpo = src.slice(src.indexOf('function atualizar('), src.indexOf('const api = {'));
  const iRender = corpo.indexOf('render(novoEstado, novoCtx)');
  const iAdota = corpo.indexOf('estado = novoEstado');
  const iSalva = corpo.indexOf('salvar(estado)');
  assert.ok(iRender > 0 && iAdota > iRender && iSalva > iAdota, 'ordem: desenhar → adotar → gravar');
  assert.match(corpo, /catch \(e\)[\s\S]*return false;/);
});
