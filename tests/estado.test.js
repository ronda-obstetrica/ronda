import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE, CHAVE_CORROMPIDO, novoEstado, carregar, salvar, novaPaciente, cortar,
  seedExemplos, apagarExemplos, exportarJSON, importarJSON, ordenarPacientes,
  precisaLembrarBackup, lerBruto, mudouFora,
} from '../js/nucleo/estado.js';
import { igHoje } from '../js/nucleo/datas.js';

function fake(inicial = {}) {
  const d = { ...inicial };
  return { d, getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); } };
}

test('carregar vazio devolve exemplos sem aviso', () => {
  const { estado, aviso } = carregar(fake());
  assert.equal(aviso, null);
  assert.deepEqual(estado.pac.map((p) => p.leito), ['04', '07', '09']);
  assert.ok(estado.pac.every((p) => p.ex === true));
});

test('seed: IG exata hoje e internação', () => {
  const s = seedExemplos('2026-11-07');
  assert.equal(igHoje(s[0], '2026-11-07'), 31 * 7 + 2);
  assert.equal(igHoje(s[1], '2026-11-07'), 37 * 7 + 1);
  assert.equal(igHoje(s[2], '2026-11-07'), 29 * 7 + 5);
  assert.equal(s[0].int, '2026-11-01');
  assert.equal(s[1].int, '2026-11-05');
  assert.equal(s[2].int, '2026-10-27');
  assert.deepEqual(s[2].alertasFeitos, [{ id: 'corticoide', data: '2026-10-26', res: '' }]);
  assert.equal(s[0].alerg, 'Dipirona');
});

test('salvar e carregar round-trip', () => {
  const st = fake();
  const e = novoEstado();
  e.pac = [novaPaciente({ leito: '12', obs: 'a' })];
  assert.equal(salvar(e, st), true);
  assert.ok(CHAVE in st.d);
  assert.deepEqual(carregar(st).estado, e);
});

test('JSON corrompido preservado e aviso', () => {
  const st = fake({ [CHAVE]: '{quebrado' });
  const { estado, aviso } = carregar(st);
  assert.equal(st.d[CHAVE_CORROMPIDO], '{quebrado');
  assert.match(aviso, /corrompido/);
  assert.equal(estado.v, 3);
  assert.equal(estado.pac.length, 3);
});

test('salvar retorna false se setItem lança', () => {
  const st = { getItem: () => null, setItem: () => { throw new DOMException('x', 'QuotaExceededError'); } };
  assert.equal(salvar(novoEstado(), st), false);
});

test('novaPaciente corta obs e gera id', () => {
  const p = novaPaciente({ obs: 'x'.repeat(300) });
  assert.equal(p.obs.length, 240);
  assert.equal(p.id.length, 8);
  assert.equal(cortar('  ab  ', 5), 'ab');
});

test('exportar/importar', () => {
  const e = novoEstado();
  e.pac = [novaPaciente({ leito: '3' })];
  assert.deepEqual(importarJSON(exportarJSON(e)), e);
  assert.throws(() => importarJSON('{"v":1}'), { message: 'Backup inválido' });
  assert.throws(() => importarJSON('{"v":2}'), { message: 'Backup inválido' });
  assert.throws(() => importarJSON('nao json'), { message: 'Backup inválido' });
});

test('importarJSON valida cada paciente e completa listas ausentes', () => {
  const bk = (pac) => JSON.stringify({ v: 2, pac });
  const ok = importarJSON(bk([{ leito: '3' }, { leito: 7, dxs: [{ dx: 'dmg', mods: {} }] }]));
  for (const k of ['dxs', 'pend', 'alertasFeitos', 'registros', 'dispensadas']) assert.deepEqual(ok.pac[0][k], [], k);
  assert.equal(ok.pac[1].dxs.length, 1);
  for (const ruim of [[null], ['texto'], [[]], [{}], [{ leito: {} }], [{ leito: '1', pend: 'x' }], [{ leito: '1', dxs: {} }], [{ leito: '1', pend: [null] }], [{ leito: '1', dxs: ['dmg'] }]]) {
    assert.throws(() => importarJSON(bk(ruim)), { message: 'Backup inválido' }, JSON.stringify(ruim));
  }
});

test('ordenarPacientes', () => {
  const pac = ['10A', '4', '10', '2B', '04'].map((leito) => ({ leito }));
  assert.deepEqual(ordenarPacientes(pac).map((p) => p.leito), ['2B', '4', '04', '10', '10A']);
  assert.equal(pac[0].leito, '10A');
});

test('apagarExemplos', () => {
  const e = novoEstado();
  e.pac = [...seedExemplos('2026-11-07'), novaPaciente({ leito: '1' })];
  assert.deepEqual(apagarExemplos(e).pac.map((p) => p.leito), ['1']);
});

test('precisaLembrarBackup', () => {
  const h = '2026-11-07';
  const e = novoEstado();
  e.pac = seedExemplos(h);
  assert.equal(precisaLembrarBackup(e, h), false);
  e.pac = [novaPaciente({ leito: '1' })];
  assert.equal(precisaLembrarBackup(e, h), true);
  e.ultimoBackup = '2026-11-04';
  assert.equal(precisaLembrarBackup(e, h), false);
  e.ultimoBackup = '2026-10-30';
  assert.equal(precisaLembrarBackup(e, h), true);
});

test('carregar: getItem que lança não vira tela em branco nem grava por cima', () => {
  const st = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('não deve gravar'); } };
  const r = carregar(st);
  assert.equal(r.leituraFalhou, true);
  assert.match(r.aviso, /não foi possível ler/i);
  assert.deepEqual(r.estado.pac, []);
});

test('carregar: acessor do storage ausente (null) também não lança', () => {
  const r = carregar(null);
  assert.equal(r.leituraFalhou, true);
  assert.ok(r.aviso);
  assert.equal(salvar(novoEstado(), null), false);
  assert.equal(lerBruto(null), null);
});

test('lerBruto devolve o texto guardado ou null', () => {
  assert.equal(lerBruto(fake({ [CHAVE]: '{"a":1}' })), '{"a":1}');
  assert.equal(lerBruto(fake()), null);
  assert.equal(lerBruto({ getItem() { throw new Error('x'); } }), null);
});

test('mudouFora: só quando há texto guardado diferente do último desta janela', () => {
  assert.equal(mudouFora('{"a":2}', '{"a":1}'), true);
  assert.equal(mudouFora('{"a":1}', '{"a":1}'), false);
  assert.equal(mudouFora(null, '{"a":1}'), false);
  assert.equal(mudouFora('{"a":1}', null), true);
});
