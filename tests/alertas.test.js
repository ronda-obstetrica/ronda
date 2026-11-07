import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRegras } from '../js/nucleo/regras.js';
import { avaliarAlertas, registrarAlertaFeito, desfazerAlertaFeito, ordenarAlertas } from '../js/nucleo/alertas.js';

const HOJE = '2026-11-07';
const ig = (s, d = 0) => s * 7 + d;
const pac = (igDays, dxs = [], extra = {}) => ({ igDays, igRef: HOJE, dxs, alertasFeitos: [], ...extra });
const R = (txt) => parseRegras(txt).itens;

const REGRAS = R(`
res-pe | dheg+pe!gravidade | 37+0 | 38+6 | vermelho | Resolução PE | ACOG | 7
res-dmg-a2 | dmg+medicacao!controle-ruim | 39+0 | 39+6 | vermelho | Resolução DMG A2 | ACOG
corticoide | | 24+0 | 33+6 | vermelho | Corticoide | ACOG
mgso4 | | 24+0 | 31+6 | amarelo | MgSO4 | ACOG
`);
const PE = [{ dx: 'dheg', mods: { tipo: 'pe' } }];

test('PE: nada, próximo (amarelo), ativo (vermelho)', () => {
  const r = R('res-pe | dheg+pe!gravidade | 37+0 | 38+6 | vermelho | Resolução PE | ACOG | 7');
  assert.deepEqual(avaliarAlertas(pac(ig(35, 6), PE), HOJE, r), []);
  const a = avaliarAlertas(pac(ig(36), PE), HOJE, r);
  assert.equal(a.length, 1);
  assert.equal(a[0].nivel, 'amarelo');
  assert.equal(a[0].estado, 'proximo');
  const b = avaliarAlertas(pac(ig(37), PE), HOJE, r);
  assert.equal(b[0].nivel, 'vermelho');
  assert.equal(b[0].estado, 'ativo');
  assert.equal(b[0].principal, true);
  assert.equal(b[0].regraId, 'res-pe');
  assert.equal(b[0].fonte, 'ACOG');
});

test('resolução ultrapassada', () => {
  const a = avaliarAlertas(pac(ig(39, 2), PE), HOJE, REGRAS.filter(r => r.id === 'res-pe'));
  assert.equal(a[0].nivel, 'vermelho');
  assert.equal(a[0].estado, 'ultrapassado');
  assert.equal(a[0].diasUltrapassado, 3);
  assert.ok(a[0].msg.endsWith('ultrapassada em 3 dias'));
});

test('corticoide: ativo, feito, encerrado, some', () => {
  const r = REGRAS.filter(x => x.id === 'corticoide');
  const p = pac(ig(31, 2));
  const a = avaliarAlertas(p, HOJE, r);
  assert.equal(a[0].nivel, 'vermelho');
  assert.equal(a[0].principal, false);
  const p2 = registrarAlertaFeito(p, 'corticoide', '2026-10-24');
  const b = avaliarAlertas(p2, HOJE, r);
  assert.equal(b.length, 1);
  assert.equal(b[0].nivel, 'cinza');
  assert.equal(b[0].estado, 'feito');
  assert.equal(b[0].msg, 'Corticoide — feito em 24/10');
  assert.equal(b[0].fonte, 'ACOG');
  assert.equal(b[0].principal, false);
  const c = avaliarAlertas(pac(ig(34, 3)), HOJE, r);
  assert.equal(c[0].nivel, 'cinza');
  assert.equal(c[0].estado, 'encerrado');
  assert.equal(c[0].msg, 'Corticoide — janela encerrada sem registro');
  assert.deepEqual(avaliarAlertas(pac(ig(35, 0)), HOJE, r), []);
});

test('feito aparece sempre e inclui resultado', () => {
  const r = REGRAS.filter(x => x.id === 'corticoide');
  const p = registrarAlertaFeito(pac(ig(40)), 'corticoide', '2026-10-24', 'betametasona 2 doses');
  const b = avaliarAlertas(p, HOJE, r);
  assert.equal(b[0].estado, 'feito');
  assert.equal(b[0].msg, 'Corticoide — feito em 24/10 · betametasona 2 doses');
  assert.deepEqual(b[0].feito, { data: '2026-10-24', res: 'betametasona 2 doses' });
});

test('MgSO4 amarelo vencido: nada', () => {
  assert.deepEqual(avaliarAlertas(pac(ig(32)), HOJE, REGRAS.filter(x => x.id === 'mgso4')), []);
});

test('especificidade por grupo', () => {
  const r = R(`
res-dmg-a2 | dmg+medicacao | 39+0 | 39+6 | vermelho | A2 | ACOG
res-dmg-ruim | dmg+medicacao+controle-ruim | 37+0 | 38+6 | vermelho | Ruim | ACOG
`);
  const dxs = [{ dx: 'dmg', mods: { medicacao: true, 'controle-ruim': true } }];
  // mesmo com a mais específica fora de janela, a menos específica é descartada
  const a = avaliarAlertas(pac(ig(39), dxs), HOJE, r);
  assert.deepEqual(a.map(x => x.regraId), ['res-dmg-ruim']);
  const b = avaliarAlertas(pac(ig(20), dxs), HOJE, r);
  assert.deepEqual(b, []);
});

test('dois diagnósticos: principal só no de menor ini', () => {
  const dxs = [...PE, { dx: 'dmg', mods: { medicacao: true } }];
  const a = avaliarAlertas(pac(ig(39), dxs), HOJE, REGRAS);
  const ids = a.map(x => x.regraId).filter(i => i.startsWith('res-'));
  assert.deepEqual(ids.sort(), ['res-dmg-a2', 'res-pe']);
  assert.equal(a.find(x => x.regraId === 'res-pe').principal, true);
  assert.equal(a.find(x => x.regraId === 'res-dmg-a2').principal, false);
});

test('sem IG ou sem dx casando', () => {
  assert.deepEqual(avaliarAlertas(pac(null, PE), HOJE, REGRAS), []);
  const r = R('res-pe | dheg+pe | 30+0 | | vermelho | PE | ACOG');
  assert.deepEqual(avaliarAlertas(pac(ig(38), [{ dx: 'outro', mods: {} }]), HOJE, r), []);
});

test('pendências ignoradas', () => {
  const r = R('pend-x | | 20+0 | | amarelo | Pendência | X | | 14');
  assert.deepEqual(avaliarAlertas(pac(ig(30)), HOJE, r), []);
});

test('registrar/desfazer não mutam, substituem e cortam', () => {
  const p = pac(ig(30));
  const p1 = registrarAlertaFeito(p, 'corticoide', '2026-10-24', 'a');
  assert.deepEqual(p.alertasFeitos, []);
  const p2 = registrarAlertaFeito(p1, 'corticoide', '2026-10-25', 'x'.repeat(200));
  assert.equal(p2.alertasFeitos.length, 1);
  assert.equal(p2.alertasFeitos[0].data, '2026-10-25');
  assert.ok(p2.alertasFeitos[0].res.length <= 80);
  assert.equal(p1.alertasFeitos[0].data, '2026-10-24');
  const p3 = desfazerAlertaFeito(p2, 'corticoide');
  assert.deepEqual(p3.alertasFeitos, []);
  assert.equal(p2.alertasFeitos.length, 1);
});

test('ordenarAlertas: nível, principal, estável', () => {
  const mk = (regraId, nivel, principal) => ({ regraId, nivel, principal });
  const o = ordenarAlertas([mk('a', 'cinza', false), mk('b', 'amarelo', false), mk('c', 'vermelho', false),
    mk('d', 'vermelho', true), mk('e', 'vermelho', false)]);
  assert.deepEqual(o.map(x => x.regraId), ['d', 'c', 'e', 'b', 'a']);
});
