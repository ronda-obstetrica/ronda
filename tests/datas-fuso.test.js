// TZ precisa ser definido antes de importar o módulo (por isso o import dinâmico).
process.env.TZ = 'America/Sao_Paulo';
import { test } from 'node:test'; import assert from 'node:assert/strict';
const { hojeISO, diffDias } = await import('../js/nucleo/datas.js');
test('fuso efetivo é America/Sao_Paulo', () => {
  assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/Sao_Paulo');
  assert.equal(new Date('2026-11-05T02:30:00Z').getDate(), 4);
});
test('hojeISO usa data local perto da meia-noite', () => {
  assert.equal(hojeISO(new Date('2026-11-05T02:30:00Z')), '2026-11-04'); // 23h30 local
});
test('diffDias imune a horário de verão', () => {
  assert.equal(diffDias('2018-11-03', '2018-11-05'), 2); // DST começou em 04/11/2018
});
