import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrar, novoEstado, novaPaciente, exportarJSON, importarJSON, carregar, CHAVE,
  LIMITE_INICIAIS, LIMITE_PAR, LIMITE_PROG, LIMITE_MED } from '../js/nucleo/estado.js';

const v2 = (pac) => ({ v: 2, prot: {}, regrasServico: '', faixasServico: '', pac, ultimoPlantao: null, ultimoBackup: null });
const pv2 = (o = {}) => ({ id: 'a1', leito: '04', g: 2, p: 1, c: 1, a: 0, dxs: [], pend: [], alertasFeitos: [], dispensadas: [], registros: [], ...o });

test('constantes', () => {
  assert.deepEqual([LIMITE_INICIAIS, LIMITE_PAR, LIMITE_PROG, LIMITE_MED], [10, 20, 240, 60]);
});

test('novoEstado e novaPaciente v3', () => {
  const e = novoEstado();
  assert.equal(e.v, 3); assert.deepEqual(e.dxCustom, []);
  const p = novaPaciente();
  assert.equal(p.par, ''); assert.equal(p.iniciais, ''); assert.deepEqual(p.meds, []);
  assert.equal(p.prog, ''); assert.deepEqual(p.sugDispensadas, []);
  for (const k of ['g', 'p', 'c', 'a']) assert.ok(!(k in p));
});

test('migrar v2 -> v3', () => {
  const e = migrar(v2([pv2()]));
  const p = e.pac[0];
  assert.equal(e.v, 3); assert.deepEqual(e.dxCustom, []);
  assert.equal(p.par, 'G2P1C1A0');
  for (const k of ['g', 'p', 'c', 'a']) assert.ok(!(k in p));
  assert.deepEqual(p.meds, []); assert.equal(p.prog, ''); assert.equal(p.iniciais, '');
  assert.deepEqual(p.sugDispensadas, []);
});

test('migrar: nulos parciais viram 0; todos nulos viram vazio', () => {
  assert.equal(migrar(v2([pv2({ g: 3, p: null, c: null, a: null })])).pac[0].par, 'G3P0C0A0');
  assert.equal(migrar(v2([pv2({ g: null, p: null, c: null, a: null })])).pac[0].par, '');
});

test('migrar mantém par existente e é idempotente', () => {
  assert.equal(migrar(v2([pv2({ par: 'G1P0' })])).pac[0].par, 'G1P0');
  const x = v2([pv2()]);
  const um = migrar(x);
  assert.deepEqual(migrar(um), um);
});

test('migrar mantém pendências idênticas', () => {
  const pend = [{ id: 'x', origem: 'lab-pe', txt: 'a' }, { id: 'y', origem: 'protocolo', txt: 'b' }];
  assert.deepEqual(migrar(v2([pv2({ pend })])).pac[0].pend, pend);
});

test('exportarJSON remove iniciais', () => {
  for (const ini of ['MAS', '']) {
    const e = { ...novoEstado(), pac: [novaPaciente({ leito: '1', iniciais: ini })] };
    const o = JSON.parse(exportarJSON(e));
    assert.ok(!('iniciais' in o.pac[0]));
  }
});

test('importarJSON de v2 devolve v3 e descarta iniciais', () => {
  const e = importarJSON(JSON.stringify(v2([pv2({ iniciais: 'ZZ', sugDispensadas: null })])));
  assert.equal(e.v, 3); assert.equal(e.pac[0].par, 'G2P1C1A0');
  assert.equal(e.pac[0].iniciais, ''); assert.deepEqual(e.pac[0].meds, []);
  assert.throws(() => importarJSON(JSON.stringify(v2([pv2({ meds: 'x' })]))), { message: 'Backup inválido' });
});

test('carregar migra v2', () => {
  const st = { getItem: () => JSON.stringify(v2([pv2()])), setItem() {} };
  const { estado } = carregar(st);
  assert.equal(estado.v, 3); assert.equal(estado.pac[0].par, 'G2P1C1A0');
  assert.equal(CHAVE, 'ronda-obstetrica-v2');
});
