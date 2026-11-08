import { test } from 'node:test'; import assert from 'node:assert/strict';
import { instantaneo, mudancasDesde, marcarPlantao } from '../js/nucleo/mudancas.js';
import { novoEstado, novaPaciente } from '../js/nucleo/estado.js';
import { novaPendencia } from '../js/nucleo/pendencias.js';
import { contexto } from '../js/nucleo/contexto.js';
import { avaliarAlertas } from '../js/nucleo/alertas.js';

const ONTEM = '2026-11-07', HOJE = '2026-11-08';
const mk = (o = {}) => novaPaciente({ id: 'p1', leito: '04', igDays: 30 * 7, igRef: HOJE, dxs: [{ dx: 'dmg', mods: {} }], ...o });
const est = (...pac) => ({ ...novoEstado(), pac });
const ctx = e => contexto(e);
const snap = (e, h = HOJE) => instantaneo(e, h, ctx(e));
const mud = (antes, depois, h = HOJE) => mudancasDesde(snap(antes, ONTEM), snap(depois, h), depois, h, ctx(depois));

test('sem anterior retorna {}', () => {
  const e = est(mk());
  assert.deepEqual(mudancasDesde(null, snap(e), e, HOJE, ctx(e)), {});
});
test('instantaneo e marcarPlantao', () => {
  const e = est(mk());
  const s = snap(e);
  assert.deepEqual(s.p1.tokens, ['dmg']);
  assert.equal(s.p1.leito, '04');
  const m = marcarPlantao(e, HOJE, ctx(e));
  assert.equal(m.ultimoPlantao.data, HOJE);
  assert.deepEqual(m.ultimoPlantao.snap, s);
  assert.equal(e.ultimoPlantao, null);
});
test('nova paciente, só essa frase', () => {
  const antes = est(mk());
  const depois = est(mk(), mk({ id: 'p2', leito: '05', dxs: [{ dx: 'dheg', mods: { tipo: 'pe' } }] }));
  assert.deepEqual(mud(antes, depois), { p2: ['Nova paciente'] });
});
test('paciente que saiu é ignorada; sem mudança é omitida', () => {
  const a = est(mk(), mk({ id: 'p2' }));
  assert.deepEqual(mud(a, est(mk())), {});
});
test('diagnóstico/modificador mudou', () => {
  const antes = est(mk());
  const depois = est(mk({ dxs: [{ dx: 'dmg', mods: { medicacao: true } }] }));
  const r = mud(antes, depois);
  assert.ok(r.p1.some(f => f.startsWith('Diagnóstico/modificador: ')));
});
test('modificador removido emite para todos os itens', () => {
  const antes = est(mk({ dxs: [{ dx: 'dmg', mods: { medicacao: true } }] }));
  const r = mud(antes, est(mk()));
  assert.equal(r.p1.filter(f => f.startsWith('Diagnóstico/modificador: ')).length, 1);
});
test('novo alerta: novo regraId e amarelo→vermelho; cinza não conta', () => {
  const depois = est(mk({ dxs: [{ dx: 'dheg', mods: {} }], igDays: 30 * 7 }));
  const antes = est(mk({ dxs: [{ dx: 'dheg', mods: {} }], igDays: 30 * 7 }));
  const c = ctx(depois);
  const al = avaliarAlertas(depois.pac[0], HOJE, c.regras);
  const vv = al.filter(a => a.nivel !== 'cinza');
  const base = snap(antes, ONTEM);
  // remove um alerta vermelho/amarelo do passado: vira novo
  const alvo = vv[0];
  delete base.p1.alertas[alvo.regraId];
  const r1 = mudancasDesde(base, snap(depois), depois, HOJE, c);
  assert.ok(r1.p1.includes('Novo alerta: ' + alvo.msg));
  // amarelo -> vermelho
  const b2 = snap(antes, ONTEM);
  const am = vv.find(a => a.nivel === 'vermelho');
  if (am) {
    b2.p1.alertas[am.regraId] = 'amarelo';
    assert.ok(mudancasDesde(b2, snap(depois), depois, HOJE, c).p1.includes('Novo alerta: ' + am.msg));
  }
  // anterior vermelho → atual qualquer: não alerta
  const b3 = snap(antes, ONTEM); b3.p1.alertas[alvo.regraId] = 'vermelho';
  assert.equal((mudancasDesde(b3, snap(depois), depois, HOJE, c).p1 || []).includes('Novo alerta: ' + alvo.msg), false);
  // regra nova que seja cinza não conta
  const b4 = snap(antes, ONTEM);
  const cz = al.find(a => a.nivel === 'cinza');
  if (cz) { delete b4.p1.alertas[cz.regraId]; assert.equal((mudancasDesde(b4, snap(depois), depois, HOJE, c).p1 || []).includes('Novo alerta: ' + cz.msg), false); }
});
test('resultado novo', () => {
  const p0 = mk({ pend: [novaPendencia({ id: 'x1', texto: 'Hemograma', cat: 'Exame', due: HOJE })] });
  const p1 = mk({ pend: [novaPendencia({ id: 'x1', texto: 'Hemograma', cat: 'Exame', due: HOJE, done: true, doneAt: HOJE, res: 'Hb 10' })] });
  assert.ok(mud(est(p0), est(p1)).p1.includes('Resultado: Hemograma — Hb 10'));
});
test('fora da faixa novo', () => {
  const regs = [{ id: 'r1', data: HOJE, medida: 'jejum', valor: 102 }, { id: 'r2', data: HOJE, medida: 'pa', valor: { s: 150, d: 95 } }];
  const p1 = mk({ dxs: [{ dx: 'dmg', mods: {} }, { dx: 'dheg', mods: {} }], registros: regs });
  const p0 = mk({ dxs: p1.dxs });
  const r = mud(est(p0), est(p1)).p1;
  assert.ok(r.includes('Fora da faixa: Jejum 102'));
  assert.ok(r.includes('Fora da faixa: PA 150x95'));
});
test('atrasou novo', () => {
  const pend = (due) => [novaPendencia({ id: 'x9', texto: 'Colher cultura', cat: 'Exame', due })];
  const r = mud(est(mk({ pend: pend(HOJE) })), est(mk({ pend: pend(ONTEM) })));
  assert.ok(r.p1.includes('Atrasou: Colher cultura'));
});
test('ordem das frases', () => {
  const regs = [{ id: 'r1', data: HOJE, medida: 'jejum', valor: 102 }];
  const antes = est(mk({ pend: [novaPendencia({ id: 'x1', texto: 'Exame A', cat: 'Exame', due: HOJE }), novaPendencia({ id: 'x2', texto: 'B', cat: 'Outro', due: HOJE })] }));
  const depois = est(mk({
    dxs: [{ dx: 'dmg', mods: { medicacao: true } }], registros: regs,
    pend: [novaPendencia({ id: 'x1', texto: 'Exame A', cat: 'Exame', due: HOJE, done: true, doneAt: HOJE, res: 'ok' }), novaPendencia({ id: 'x2', texto: 'B', cat: 'Outro', due: ONTEM })],
  }));
  const sa = snap(antes, ONTEM); sa.p1.alertas = {};
  const r = mudancasDesde(sa, snap(depois), depois, HOJE, ctx(depois)).p1;
  const pref = ['Diagnóstico/modificador: ', 'Novo alerta: ', 'Resultado: ', 'Fora da faixa: ', 'Atrasou: '];
  const idx = pref.map(p => r.findIndex(f => f.startsWith(p)));
  assert.ok(idx.every(i => i >= 0), JSON.stringify(r));
  assert.deepEqual([...idx].sort((a, b) => a - b), idx);
});
