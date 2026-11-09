import { test } from 'node:test'; import assert from 'node:assert/strict';
import { novaMed, diaMed, rotuloMed, adicionarMed, editarMed, removerMed } from '../js/nucleo/medicacoes.js';
import { novaPaciente } from '../js/nucleo/estado.js';

const ce = (o = {}) => novaMed({ texto: 'Cefalexina 12/12h', inicio: '2026-11-06', previstos: 7, ...o });

test('diaMed: curso, último, terminou', () => {
  assert.deepEqual(diaMed(ce(), '2026-11-08'), { d: 3, total: 7, situacao: 'curso' });
  assert.equal(diaMed(ce(), '2026-11-12').situacao, 'ultimo');
  assert.equal(diaMed(ce(), '2026-11-13').situacao, 'terminou');
});
test('diaMed: null para futuro, inválido e contar:false', () => {
  assert.equal(diaMed(ce({ inicio: '2026-11-09' }), '2026-11-08'), null);
  assert.equal(diaMed(ce({ inicio: 'abc' }), '2026-11-08'), null);
  assert.equal(diaMed(ce({ inicio: '2026-02-31' }), '2026-11-08'), null);
  assert.equal(diaMed(ce({ contar: false }), '2026-11-08'), null);
});
test('rotuloMed', () => {
  assert.equal(rotuloMed(ce(), '2026-11-08'), 'Cefalexina 12/12h · D3/7');
  assert.equal(rotuloMed(ce(), '2026-11-12'), 'Cefalexina 12/12h · D7/7 · último dia');
  assert.equal(rotuloMed(ce(), '2026-11-13'), 'Cefalexina 12/12h · D8/7 · terminou — suspender?');
  assert.equal(rotuloMed(ce({ previstos: null }), '2026-11-08'), 'Cefalexina 12/12h · D3');
  assert.equal(rotuloMed(ce({ contar: false }), '2026-11-08'), 'Cefalexina 12/12h');
});
test('novaMed corta o texto; adicionar/editar/remover', () => {
  assert.equal(novaMed({ texto: 'x'.repeat(100) }).texto.length, 60);
  const p = novaPaciente({ id: 'p', leito: '01' });
  const m = ce();
  assert.equal(adicionarMed(p, m), p);
  assert.equal(p.meds.length, 1);
  editarMed(p, m.id, { texto: 'Outra' });
  assert.equal(p.meds[0].texto, 'Outra');
  removerMed(p, m.id);
  assert.deepEqual(p.meds, []);
});
