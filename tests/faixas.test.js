import { test } from 'node:test'; import assert from 'node:assert/strict';
import { parseFaixas, FAIXAS_GLOBAIS, registrar, avaliarRegistro, foraDaFaixaHoje, parseValor, MEDIDAS } from '../js/nucleo/faixas.js';
import { novaPaciente } from '../js/nucleo/estado.js';
import { mesclarPorId } from '../js/nucleo/textoregras.js';
import { contexto } from '../js/nucleo/contexto.js';

const pac = novaPaciente();
const ids = (pac, medida, valor) => avaliarRegistro(pac, { data: '2026-11-08', medida, valor }, FAIXAS_GLOBAIS).map(a => a.faixaId);

test('glicemia', () => {
  assert.deepEqual(ids(pac, 'jejum', 102), ['glic-jejum']);
  assert.deepEqual(ids(pac, 'jejum', 65), ['glic-hipo']);
  assert.equal(avaliarRegistro(pac, { medida: 'jejum', valor: 65 }, FAIXAS_GLOBAIS)[0].nivel, 'vermelho');
  assert.deepEqual(ids(pac, 'pos-almoco', 150), ['glic-pos']);
  assert.deepEqual(ids(pac, 'pos-almoco', 120), []);
});
test('pressão', () => {
  assert.deepEqual(ids(pac, 'pa', { s: 150, d: 95 }), ['pa-alta']);
  assert.deepEqual(ids(pac, 'pa', { s: 165, d: 100 }), ['pa-crise']);
  assert.deepEqual(ids(pac, 'pa', { s: 120, d: 80 }), []);
  assert.deepEqual(ids(pac, 'pa', { s: 130, d: 112 }), ['pa-crise']);
});
test('campo que não cabe no valor é falso', () => {
  assert.deepEqual(ids(pac, 'pa', 150), []);
  assert.deepEqual(ids(pac, 'jejum', { s: 150, d: 95 }), []);
});
test('parseValor', () => {
  assert.deepEqual(parseValor('pa', '150x95'), { s: 150, d: 95 });
  assert.deepEqual(parseValor('pa', '150/95'), { s: 150, d: 95 });
  assert.deepEqual(parseValor('pa', '150 X 95'), { s: 150, d: 95 });
  assert.ok(parseValor('pa', '150') instanceof Error);
  assert.equal(parseValor('jejum', '102'), 102);
  assert.equal(parseValor('jejum', '95.5'), 95.5);
  assert.ok(parseValor('jejum', 'abc') instanceof Error);
  assert.ok(parseValor('jejum', '9,5') instanceof Error);
});
test('parseFaixas: linhas ruins viram erro, boa continua', () => {
  const { itens, erros } = parseFaixas([
    'x | dmg | jejum | >=9,5 | amarelo | m | f',
    'y | dmg | voo | >=95 | amarelo | m | f',
    'z | dmg | jejum',
    'ok | dmg | jejum | >=100 | amarelo | m | f',
  ].join('\n'));
  assert.deepEqual(erros.map(e => e.n), [1, 2, 3]);
  assert.match(erros[0].msg, /use ponto/);
  assert.match(erros[1].msg, /medida desconhecida: "voo"/);
  assert.match(erros[2].msg, /7 campos/);
  assert.equal(itens.length, 1);
  assert.deepEqual(itens[0].cond, [{ campo: 'v', op: '>=', n: 100 }]);
});
test('parseFaixas: mais campos, prefixo sem correspondência, desligar', () => {
  const r = parseFaixas('a | dmg | jejum | >1 | amarelo | m | f | extra\nb | dmg | xx-* | >1 | amarelo | m | f\n-glic-pos');
  assert.equal(r.erros.length, 2); assert.match(r.erros[0].msg, /sobrando/);
  assert.deepEqual(r.desligar, ['glic-pos']);
});
test('faixa do serviço substitui a global', () => {
  const s = parseFaixas('glic-pos | dmg | pos-* | >=120 | amarelo | m | f');
  const f = mesclarPorId(FAIXAS_GLOBAIS, s, []);
  assert.equal(f.length, FAIXAS_GLOBAIS.length);
  assert.equal(avaliarRegistro(pac, { medida: 'pos-almoco', valor: 125 }, f)[0].faixaId, 'glic-pos');
  const ctx = contexto({ faixasServico: 'glic-pos | dmg | pos-* | >=120 | amarelo | m | f\nruim' });
  assert.equal(ctx.faixas.length, FAIXAS_GLOBAIS.length);
  assert.equal(ctx.errosFaixas.length, 1);
  assert.equal(contexto({}).faixas.length, FAIXAS_GLOBAIS.length);
});
test('registrar e foraDaFaixaHoje', () => {
  let p = registrar(pac, { data: '2026-11-08', medida: 'jejum', valor: 102 });
  p = registrar(p, { data: '2026-11-08', medida: 'pos-cafe', valor: 100 });
  p = registrar(p, { data: '2026-11-07', medida: 'jejum', valor: 130 });
  assert.equal(pac.registros.length, 0);
  assert.ok(p.registros[0].id);
  const r = foraDaFaixaHoje(p, '2026-11-08', FAIXAS_GLOBAIS);
  assert.equal(r.length, 1); assert.equal(r[0].registro.medida, 'jejum'); assert.equal(r[0].alertas[0].faixaId, 'glic-jejum');
  assert.equal(registrar(pac, { data: 'x', medida: 'voo', valor: 1 }), pac);
  assert.equal(MEDIDAS.length, 7);
});
