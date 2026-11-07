import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIAGNOSTICOS, tokens, rotuloCurto, rotuloExtenso, alternarMod } from '../js/nucleo/diagnosticos.js';

test('catálogo tem os dx esperados', () => {
  assert.deepEqual(Object.keys(DIAGNOSTICOS), ['dheg', 'dmg', 'rcf', 'colestase', 'placenta', 'tpp', 'rpmo', 'outro']);
  assert.equal(DIAGNOSTICOS.rpmo.extenso, 'Rotura prematura de membranas ovulares');
});

test('tokens: dx primeiro, depois ordem do catálogo', () => {
  assert.deepEqual(tokens({ dx: 'dheg', mods: { gravidade: true, tipo: 'pe' } }), ['dheg', 'pe', 'gravidade']);
  assert.deepEqual(tokens({ dx: 'rpmo', mods: {} }), ['rpmo']);
  assert.deepEqual(tokens({ dx: 'rpmo' }), ['rpmo']);
});

test('dificil só entra com tipo hac', () => {
  assert.deepEqual(tokens({ dx: 'dheg', mods: { tipo: 'pe', dificil: true } }), ['dheg', 'pe']);
  assert.deepEqual(tokens({ dx: 'dheg', mods: { dificil: true } }), ['dheg']);
  assert.deepEqual(tokens({ dx: 'dheg', mods: { tipo: 'hac', dificil: true } }), ['dheg', 'hac', 'dificil']);
  assert.equal(rotuloCurto({ dx: 'dheg', mods: { tipo: 'pe', dificil: true } }), 'DHEG · PE');
  assert.equal(rotuloExtenso({ dx: 'dheg', mods: { tipo: 'pe', dificil: true } }), 'Pré-eclâmpsia');
});

test('rotuloCurto', () => {
  assert.equal(rotuloCurto({ dx: 'dmg', mods: { medicacao: true, 'controle-ruim': true } }), 'DMG · insulina · controle ruim');
  assert.equal(rotuloCurto({ dx: 'dheg', mods: { tipo: 'pe', gravidade: true } }), 'DHEG · PE · com gravidade');
  assert.equal(rotuloCurto({ dx: 'rpmo', mods: {} }), 'RPMO');
});

test('rotuloExtenso', () => {
  assert.equal(rotuloExtenso({ dx: 'dmg', mods: { medicacao: true, 'controle-ruim': true } }), 'DMG em uso de medicação, controle glicêmico ruim');
  assert.equal(rotuloExtenso({ dx: 'dheg', mods: { tipo: 'pe', gravidade: true } }), 'Pré-eclâmpsia com sinais de gravidade');
  assert.equal(rotuloExtenso({ dx: 'dheg', mods: { tipo: 'hac', gravidade: true, dificil: true } }), 'Hipertensão crônica com sinais de gravidade, de difícil controle');
  assert.equal(rotuloExtenso({ dx: 'rpmo', mods: {} }), 'RPMO');
  assert.equal(rotuloExtenso({ dx: 'rcf', mods: { grau: 'dz' } }), 'RCF diástole zero');
  assert.equal(rotuloExtenso({ dx: 'dheg', mods: { gravidade: true } }), 'DHEG com sinais de gravidade');
});

test('dx desconhecido não lança', () => {
  assert.deepEqual(tokens({ dx: 'xyz', mods: { a: true } }), ['xyz']);
  assert.equal(rotuloCurto({ dx: 'xyz' }), 'xyz');
  assert.equal(rotuloExtenso({ dx: 'xyz' }), 'xyz');
});

test('alternarMod não muta e funciona para liga e escolha', () => {
  const orig = { dx: 'dheg', mods: { tipo: 'pe' } };
  const a = alternarMod(orig, 'gravidade');
  assert.deepEqual(orig, { dx: 'dheg', mods: { tipo: 'pe' } });
  assert.equal(a.mods.gravidade, true);
  assert.equal(alternarMod(a, 'gravidade').mods.gravidade, undefined);
  assert.equal(alternarMod(orig, 'tipo', 'hg').mods.tipo, 'hg');
  assert.equal(orig.mods.tipo, 'pe');
  assert.equal(alternarMod(orig, 'tipo', 'hg').dx, 'dheg');
});
