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

test('previstos inválidos viram null; editarMed não troca id', () => {
  for (const v of [-3, 2.5, 0, 'abc', 400]) assert.equal(novaMed({ texto: 'x', previstos: v }).previstos, null);
  assert.equal(novaMed({ texto: 'x', previstos: '7' }).previstos, 7);
  const p = novaPaciente({ id: 'p' }); const m = ce(); adicionarMed(p, m);
  editarMed(p, m.id, { id: 'outro', previstos: -1 });
  assert.equal(p.meds[0].id, m.id); assert.equal(p.meds[0].previstos, null);
});
test('diaMed/rotuloMed toleram não-objetos; contar ausente = true', () => {
  assert.equal(diaMed(null, '2026-11-08'), null);
  assert.equal(rotuloMed('x', '2026-11-08'), '');
  assert.equal(diaMed({ texto: 'a', inicio: '2026-11-06' }, '2026-11-08').d, 3);
});
test('backup com meds malformadas: importa, relatórios não quebram', async () => {
  const { importarJSON, novoEstado } = await import('../js/nucleo/estado.js');
  const { textoPlantao } = await import('../js/relatorios/texto.js');
  const { htmlFichas } = await import('../js/relatorios/ficha.js');
  const { linhasPlanilha } = await import('../js/relatorios/planilha.js');
  const { contexto } = await import('../js/nucleo/contexto.js');
  const e = { ...novoEstado(), pac: [novaPaciente({ id: 'x', leito: '01', meds: [null, 'x', {}, { texto: 'Ok', previstos: '7', inicio: 5 }] })] };
  const r = importarJSON(JSON.stringify(e));
  const est = r.estado ?? r;
  assert.deepEqual(est.pac[0].meds.map(m => [m.texto, m.previstos, m.inicio]), [['Ok', 7, null]]);
  const ctx = contexto(est), ag = new Date('2026-11-08T12:00');
  assert.ok(textoPlantao(est, '2026-11-08', ctx, ag).includes('Medicações: Ok'));
  htmlFichas(est, '2026-11-08', ctx, { agora: ag }); linhasPlanilha(est, '2026-11-08', ctx, ag);
  est.pac[0].meds = [];
  assert.ok(!textoPlantao(est, '2026-11-08', ctx, ag).includes('Medicações:'));
});
