import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sugestoes, aceitarSugestao, aceitarTodas, dispensarSugestao, restaurarSugestao, chaveSugProt, chaveSugRegra,
} from '../js/nucleo/sugestoes.js';
import { PROT_PADRAO, parseProtocolo, novaPendencia, concluir, remover } from '../js/nucleo/pendencias.js';
import { REGRAS_GLOBAIS } from '../js/nucleo/regras.js';
import { novoEstado } from '../js/nucleo/estado.js';
import { contexto } from '../js/nucleo/contexto.js';

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

test('fluxo do app (estado + contexto) não cria pendências', () => {
  const e = { ...novoEstado(), pac: [pac0({ id: 'a', igDays: 32 * 7, dxs: [DMG, { dx: 'dheg', mods: {} }] })] };
  const c = contexto(e);
  const s = sugestoes(e.pac[0], e, HOJE, c);
  assert.ok(s.length > 0);
  assert.equal(e.pac[0].pend.length, 0);
});
