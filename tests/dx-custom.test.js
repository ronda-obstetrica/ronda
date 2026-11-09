import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { novoEstado, novaPaciente, migrar } from '../js/nucleo/estado.js';
import {
  definirDxCustom, dxDef, listaDx, validarNovoDx, criarDx, renomearDx, excluirDx,
  rotuloCurto, rotuloExtenso, tokens, DIAGNOSTICOS,
} from '../js/nucleo/diagnosticos.js';
import { contexto } from '../js/nucleo/contexto.js';
import { resumoPaciente } from '../js/relatorios/comum.js';
import { textoPlantao } from '../js/relatorios/texto.js';
import { parseAlvo } from '../js/nucleo/textoregras.js';

afterEach(() => definirDxCustom([]));

test('criarDx acrescenta em dxCustom e cria protocolo em branco', () => {
  const e = criarDx(novoEstado(), { nome: 'Pielonefrite', sigla: 'PNF' });
  assert.equal(e.dxCustom.length, 1);
  const { id } = e.dxCustom[0];
  assert.equal(id, 'u-pnf');
  assert.equal(e.prot[id], '');
  assert.deepEqual(e.dxCustom[0], { id, nome: 'Pielonefrite', sigla: 'PNF' });
});

test('criarDx: id com sufixo numérico se colidir', () => {
  let e = criarDx(novoEstado(), { nome: 'A', sigla: 'x y' });
  e = criarDx(e, { nome: 'B', sigla: 'x-y' });
  assert.notEqual(e.dxCustom[0].id, e.dxCustom[1].id);
});

test('validarNovoDx', () => {
  const e = criarDx(novoEstado(), { nome: 'Pielonefrite', sigla: 'PNF' });
  assert.equal(validarNovoDx(novoEstado(), { nome: 'Ok', sigla: 'OK' }), null);
  assert.ok(validarNovoDx(novoEstado(), { nome: 'X', sigla: 'dheg' }));
  assert.ok(validarNovoDx(novoEstado(), { nome: 'X', sigla: 'ABCDEFG' }));
  assert.ok(validarNovoDx(e, { nome: 'Outra', sigla: 'pnf' }));
  assert.ok(validarNovoDx(novoEstado(), { nome: '', sigla: 'AB' }));
  assert.ok(validarNovoDx(novoEstado(), { nome: 'x'.repeat(41), sigla: 'AB' }));
  assert.ok(validarNovoDx(novoEstado(), { nome: 'X', sigla: '' }));
});

test('rótulos e lista com dx criado', () => {
  const e = criarDx(novoEstado(), { nome: 'Pielonefrite', sigla: 'PNF' });
  const id = e.dxCustom[0].id;
  definirDxCustom(e.dxCustom);
  assert.equal(rotuloCurto({ dx: id, mods: {} }), 'PNF');
  assert.equal(rotuloExtenso({ dx: id, mods: {} }), 'Pielonefrite');
  assert.deepEqual(tokens({ dx: id, mods: {} }), [id]);
  assert.equal(dxDef(id).custom, true);
  const ids = listaDx().map(([k]) => k);
  assert.deepEqual(ids, [...Object.keys(DIAGNOSTICOS), id]);
  assert.equal(dxDef('dheg'), DIAGNOSTICOS.dheg);
  assert.equal(dxDef('nada'), null);
});

test('contexto registra os dx criados', () => {
  const e = criarDx(novoEstado(), { nome: 'Pielonefrite', sigla: 'PNF' });
  contexto(e);
  assert.ok(dxDef(e.dxCustom[0].id));
  assert.ok(!(parseAlvo(e.dxCustom[0].id) instanceof Error));
});

test('dx removido: rótulo e relatórios não lançam', () => {
  assert.equal(rotuloCurto({ dx: 'u-xyz', mods: {} }), 'Diagnóstico removido');
  assert.equal(rotuloExtenso({ dx: 'u-xyz', mods: {} }), 'Diagnóstico removido');
  const e = novoEstado();
  e.pac = [novaPaciente({ leito: '1', dxs: [{ dx: 'u-xyz', mods: {} }], igRef: '2026-11-08', igDays: 200 })];
  const ctx = contexto(e);
  assert.doesNotThrow(() => resumoPaciente(e.pac[0], '2026-11-08', ctx));
  assert.doesNotThrow(() => textoPlantao(e, '2026-11-08', ctx));
});

test('excluirDx e renomearDx', () => {
  let e = criarDx(novoEstado(), { nome: 'Pielonefrite', sigla: 'PNF' });
  const id = e.dxCustom[0].id;
  e.pac = [novaPaciente({ leito: '1', dxs: [{ dx: id, mods: {} }] })];
  assert.equal(excluirDx(e, id), null);
  e.pac = [];
  const r = excluirDx(e, id);
  assert.equal(r.dxCustom.length, 0);
  assert.ok(!(id in r.prot));
  const n = renomearDx(e, id, { nome: 'Pielo', sigla: 'PL' });
  assert.deepEqual(n.dxCustom[0], { id, nome: 'Pielo', sigla: 'PL' });
});

test('migrar: par e iniciais viram texto e são cortados', () => {
  const m = migrar({ v: 3, pac: [{ id: 'a', par: 123, iniciais: 'x'.repeat(50) }, { id: 'b', par: 'G'.repeat(50), iniciais: 7 }] });
  assert.equal(m.pac[0].par, '');
  assert.equal(m.pac[0].iniciais.length, 10);
  assert.equal(m.pac[1].par.length, 20);
  assert.equal(m.pac[1].iniciais, '');
});

test('ensaio de restauração não deixa o registro do backup ativo', async () => {
  const { ensaiarRestauracao } = await import('../js/ui/dados.js');
  const { exportarJSON } = await import('../js/nucleo/estado.js');
  const vivo = criarDx(novoEstado(), { nome: 'Pielonefrite', sigla: 'PNF' });
  const id = vivo.dxCustom[0].id;
  contexto(vivo);
  const backup = criarDx(novoEstado(), { nome: 'Outro', sigla: 'OUT' });
  ensaiarRestauracao(exportarJSON(backup), '2026-11-08');
  assert.equal(rotuloCurto({ dx: id, mods: {} }), 'PNF');
});
