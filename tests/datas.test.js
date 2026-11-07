import { test } from 'node:test'; import assert from 'node:assert/strict';
import { addDias, diffDias, parseIG, fmtIG, igHoje } from '../js/nucleo/datas.js';
test('addDias/diffDias atravessam mês', () => {
  assert.equal(addDias('2026-10-30', 3), '2026-11-02');
  assert.equal(diffDias('2026-10-29', '2026-11-04'), 6);
});
test('parseIG/fmtIG', () => {
  assert.equal(parseIG('31+2'), 219); assert.equal(parseIG('31'), 217);
  assert.equal(parseIG(' 31 + 2 '), 219);
  assert.equal(parseIG('31,2'), null); assert.equal(parseIG('31+7'), null); assert.equal(parseIG(''), null);
  assert.equal(fmtIG(219), '31+2');
});
test('igHoje avança com os dias e aceita IG ausente', () => {
  assert.equal(igHoje({ igDays: 219, igRef: '2026-11-02' }, '2026-11-04'), 221);
  assert.equal(igHoje({ igDays: null, igRef: null }, '2026-11-04'), null);
});
