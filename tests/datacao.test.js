import test from 'node:test';
import assert from 'node:assert/strict';
import { igPorDUM, igPorUSG, limiteDiscrepancia, sugerirDatacao, aplicarDatacao } from '../js/nucleo/datacao.js';

test('IG pela DUM', () => assert.equal(igPorDUM('2026-04-01', '2026-11-04'), 217));
test('IG pela USG', () => assert.equal(igPorUSG('2026-06-01', 70, '2026-06-11'), 80));
test('limites ACOG', () => {
  assert.equal(limiteDiscrepancia(62), 5); assert.equal(limiteDiscrepancia(63), 7);
  assert.equal(limiteDiscrepancia(111), 7); assert.equal(limiteDiscrepancia(112), 10);
  assert.equal(limiteDiscrepancia(153), 10); assert.equal(limiteDiscrepancia(154), 14);
  assert.equal(limiteDiscrepancia(195), 14); assert.equal(limiteDiscrepancia(196), 21);
});
test('USG de 1º tri com 9 dias de diferença vence a DUM', () => {
  const s = sugerirDatacao({ dum: '2026-04-01', usg: { data: '2026-06-01', igDias: 70 } }, '2026-11-04');
  assert.equal(s.fonte, 'usg'); assert.equal(s.diferenca, 9); assert.equal(s.limite, 7);
  assert.equal(s.igDumHoje, 217); assert.equal(s.igUsgHoje, igPorUSG('2026-06-01', 70, '2026-11-04'));
});
test('diferença dentro do limite mantém DUM', () => {
  const s = sugerirDatacao({ dum: '2026-04-01', usg: { data: '2026-06-01', igDias: 64 } }, '2026-11-04');
  assert.equal(s.fonte, 'dum');
});
test('só uma fonte', () => {
  assert.equal(sugerirDatacao({ dum: '2026-04-01' }, '2026-11-04').fonte, 'dum');
  const u = sugerirDatacao({ usg: { data: '2026-06-01', igDias: 70 } }, '2026-11-04');
  assert.equal(u.fonte, 'usg'); assert.equal(u.diferenca, null); assert.equal(u.igDumHoje, null);
  assert.equal(sugerirDatacao({}, '2026-11-04'), null);
});
test('aplicarDatacao preenche igDays/igRef sem mutar', () => {
  const pac = { nome: 'A' };
  const dat = { dum: '2026-04-01', usg: { data: '2026-06-01', igDias: 70 }, escolhida: 'usg' };
  const r = aplicarDatacao(pac, dat, '2026-11-04');
  assert.equal(r.igDays, igPorUSG('2026-06-01', 70, '2026-11-04'));
  assert.equal(r.igRef, '2026-11-04'); assert.equal(r.datacao, dat);
  assert.equal(pac.igDays, undefined);
  assert.equal(aplicarDatacao(pac, { ...dat, escolhida: 'dum' }, '2026-11-04').igDays, 217);
});
