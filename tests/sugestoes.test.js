import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sugestoes, aceitarSugestao, aceitarTodas, dispensarSugestao, restaurarSugestao, chaveSugProt, chaveSugRegra,
} from '../js/nucleo/sugestoes.js';
import { PROT_PADRAO, parseProtocolo, novaPendencia, concluir, remover } from '../js/nucleo/pendencias.js';
import { REGRAS_GLOBAIS } from '../js/nucleo/regras.js';
import { novoEstado, novaPaciente, migrar, exportarJSON } from '../js/nucleo/estado.js';
import { ensaiarRestauracao } from '../js/ui/dados.js';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOJE = '2026-11-07';
const pac0 = (extra = {}) => ({ pend: [], dispensadas: [], sugDispensadas: [], dxs: [], igDays: null, igRef: HOJE, ...extra });
const est = (prot = PROT_PADRAO) => ({ prot });
const ctx = { regras: REGRAS_GLOBAIS };
const DMG = { dx: 'dmg', mods: { medicacao: true } };

test('dx com protocolo padrão gera sugestões de protocolo sem criar pendências', () => {
  const p = pac0({ dxs: [{ dx: 'dheg', mods: {} }, { dx: 'dheg', mods: {} }] });
  const s = sugestoes(p, est(), HOJE, ctx);
  const itens = parseProtocolo(PROT_PADRAO.dheg).itens;
  assert.equal(s.length, itens.length);
  assert.ok(s.every((x) => x.fonte === 'protocolo' && x.dxId === 'dheg'));
  assert.equal(s[0].chave, chaveSugProt('dheg', itens[0].texto));
  assert.equal(p.pend.length, 0);
});

test('regra por IG: dentro da janela sugere, fora não', () => {
  const dentro = sugestoes(pac0({ igDays: 32 * 7, dxs: [DMG] }), est({}), HOJE, ctx);
  assert.ok(dentro.some((s) => s.chave === 'regra:ctg-dmg-a2' && s.fonte === 'regra' && s.cat === 'Exame'));
  const fora = sugestoes(pac0({ igDays: 30 * 7, dxs: [DMG] }), est({}), HOJE, ctx);
  assert.ok(!fora.some((s) => s.chave === 'regra:ctg-dmg-a2'));
});

test('aceitar cria pendência com sug; concluir não traz de volta; remover traz', () => {
  const p0 = pac0({ igDays: 32 * 7, dxs: [DMG] });
  const sug = sugestoes(p0, est({}), HOJE, ctx).find((s) => s.chave === 'regra:ctg-dmg-a2');
  const p = aceitarSugestao(p0, sug, HOJE);
  assert.equal(p.pend.length, 1);
  assert.equal(p.pend[0].sug, sug.chave);
  assert.equal(p.pend[0].origem, 'ctg-dmg-a2');
  assert.equal(p.pend[0].due, HOJE);
  assert.ok(!sugestoes(p, est({}), HOJE, ctx).some((s) => s.chave === sug.chave));
  const c = concluir(p, p.pend[0].id, HOJE);
  assert.equal(c.pend[1].sug, sug.chave);
  assert.ok(!sugestoes(c, est({}), HOJE, ctx).some((s) => s.chave === sug.chave));
  const r = c.pend.reduce((acc, x) => remover(acc, x.id), c);
  assert.ok(sugestoes(r, est({}), HOJE, ctx).some((s) => s.chave === sug.chave));
});

test('aceitar protocolo: due por dias, dur, origem protocolo; aceitarTodas esvazia', () => {
  const prot = { dmg: 'A | Medicação | 2 | 0 | 7d\nB | Conduta | 0 | 0' };
  const p0 = pac0({ dxs: [DMG] });
  const s = sugestoes(p0, est(prot), HOJE, ctx);
  const p = aceitarSugestao(p0, s[0], HOJE);
  assert.equal(p.pend[0].due, '2026-11-09');
  assert.equal(p.pend[0].dur.inicio, '2026-11-09');
  assert.equal(p.pend[0].origem, 'protocolo');
  const t = aceitarTodas(p0, s, HOJE);
  assert.equal(t.pend.length, 2);
  assert.equal(sugestoes(t, est(prot), HOJE, ctx).length, 0);
});

test('dispensar esconde; restaurar traz de volta', () => {
  const p0 = pac0({ dxs: [{ dx: 'outro', mods: {} }] });
  const [s] = sugestoes(p0, est(), HOJE, ctx);
  const d = dispensarSugestao(p0, s.chave);
  assert.equal(sugestoes(d, est(), HOJE, ctx).length, 0);
  assert.deepEqual(dispensarSugestao(d, s.chave).sugDispensadas, [s.chave]);
  assert.equal(sugestoes(restaurarSugestao(d, s.chave), est(), HOJE, ctx).length, 1);
});

test('pendências legadas escondem sugestões equivalentes', () => {
  const regra = novaPendencia({ texto: 'x', origem: 'ctg-dmg-a2' });
  const p1 = pac0({ igDays: 32 * 7, dxs: [DMG], pend: [regra] });
  assert.ok(!sugestoes(p1, est({}), HOJE, ctx).some((s) => s.chave === chaveSugRegra('ctg-dmg-a2')));
  const prot = { dmg: 'Revisar glicemia | Avaliação | 0 | 0' };
  const leg = novaPendencia({ texto: 'revisar  GLICEMIA', cat: 'Avaliação', origem: 'protocolo', done: true });
  assert.equal(sugestoes(pac0({ dxs: [DMG], pend: [leg] }), est(prot), HOJE, ctx).length, 0);
});

test('editar o texto do protocolo gera chave nova', () => {
  const p = pac0({ dxs: [DMG] });
  const a = sugestoes(p, est({ dmg: 'Item | Conduta | 0 | 0' }), HOJE, ctx)[0];
  const b = sugestoes(p, est({ dmg: 'Item novo | Conduta | 0 | 0' }), HOJE, ctx)[0];
  assert.notEqual(a.chave, b.chave);
});

test('mesmo item em dois dx aparece uma vez; aceitarTodas não duplica; dispensar esconde o gêmeo', () => {
  const p0 = pac0({ dxs: [{ dx: 'dheg', mods: {} }, DMG] });
  const s = sugestoes(p0, est(), HOJE, ctx);
  const rev = s.filter((x) => x.texto === 'Revisar plano de resolução');
  assert.equal(rev.length, 1);
  assert.equal(rev[0].dxId, 'dheg');
  const todas = aceitarTodas(p0, [...s, ...s], HOJE);
  assert.equal(new Set(todas.pend.map((p) => p.texto + p.cat)).size, todas.pend.length);
  const d = dispensarSugestao(p0, rev[0].chave);
  assert.ok(!sugestoes(d, est(), HOJE, ctx).some((x) => x.texto === 'Revisar plano de resolução'));
});

test('migrar semeia sugDispensadas com regra:<id> das dispensadas antigas, idempotente', () => {
  const m = migrar({ v: 2, pac: [{ id: 'a', dispensadas: ['ctg-dmg-a2', 'x'], sugDispensadas: ['regra:x'] }] });
  assert.deepEqual(m.pac[0].sugDispensadas, ['regra:x']); // já migrado: não remescla (senão restaurar não valeria)
  const legado = migrar({ v: 2, pac: [{ id: 'b', dispensadas: ['ctg-dmg-a2', 'x'] }] });
  assert.deepEqual(legado.pac[0].sugDispensadas, ['regra:ctg-dmg-a2', 'regra:x']);
  assert.deepEqual(migrar(m).pac[0].sugDispensadas, m.pac[0].sugDispensadas);
});

test('ensaiarRestauracao não gera pendências para paciente dentro de janela de regra', () => {
  const bk = { ...novoEstado(), pac: [novaPaciente({ id: 'a', leito: '1', igDays: 32 * 7, igRef: HOJE, dxs: [DMG] })] };
  const novo = ensaiarRestauracao(exportarJSON(bk), HOJE);
  assert.equal(novo.pac[0].pend.length, 0);
});

test('nenhum arquivo de js/ fora de pendencias.js usa geração automática', () => {
  const raiz = new URL('../js/', import.meta.url);
  const ruins = [];
  const varrer = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, e.name);
      if (e.isDirectory()) varrer(caminho);
      else if (e.name.endsWith('.js') && e.name !== 'pendencias.js'
        && /gerarPendenciasPorIG|aplicarProtocolo/.test(readFileSync(caminho, 'utf8'))) ruins.push(caminho);
    }
  };
  varrer(fileURLToPath(raiz));
  assert.deepEqual(ruins, []);
});
