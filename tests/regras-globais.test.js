import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRegras, REGRAS_GLOBAIS_TEXTO, REGRAS_GLOBAIS } from '../js/nucleo/regras.js';
import { avaliarAlertas, registrarAlertaFeito, desfazerAlertaFeito, chaveFeito } from '../js/nucleo/alertas.js';
import { contexto } from '../js/nucleo/contexto.js';
import { novoEstado, seedExemplos } from '../js/nucleo/estado.js';

const HOJE = '2026-11-04';
const seed = (leito) => seedExemplos(HOJE).find(p => p.leito === leito);
const ig = (s, d = 0) => s * 7 + d;
const hac = (extra = {}) => ({ igDays: ig(37), igRef: HOJE, alertasFeitos: [], dxs: [{ dx: 'dheg', mods: { tipo: 'hac', ...extra } }] });

test('texto global: 35 itens e nenhum erro', () => {
  const { itens, erros } = parseRegras(REGRAS_GLOBAIS_TEXTO);
  assert.deepEqual(erros, []);
  assert.equal(itens.length, 35);
  assert.equal(REGRAS_GLOBAIS.length, 35);
});

test('seed leito 04: um corticoide vermelho ativo + mgso4 amarelo', () => {
  const a = avaliarAlertas(seed('04'), HOJE, REGRAS_GLOBAIS);
  const cort = a.filter(x => x.regraId.startsWith('corticoide'));
  assert.equal(cort.length, 1);
  assert.equal(cort[0].nivel, 'vermelho');
  assert.equal(cort[0].estado, 'ativo');
  const mg = a.find(x => x.regraId === 'mgso4-neuro');
  assert.equal(mg.nivel, 'amarelo');
  assert.equal(a.length, 2);
});

test('seed leito 07: só res-dmg-ruim vermelho ativo', () => {
  const a = avaliarAlertas(seed('07'), HOJE, REGRAS_GLOBAIS);
  assert.equal(a.length, 1);
  assert.equal(a[0].regraId, 'res-dmg-ruim');
  assert.equal(a[0].nivel, 'vermelho');
  assert.equal(a[0].estado, 'ativo');
});

test('seed leito 09: corticoide feito (cinza) + mgso4 amarelo, sem res-rpmo', () => {
  const a = avaliarAlertas(seed('09'), HOJE, REGRAS_GLOBAIS);
  const c = a.find(x => x.regraId.startsWith('corticoide'));
  assert.equal(c.nivel, 'cinza');
  assert.equal(c.estado, 'feito');
  assert.equal(a.find(x => x.regraId === 'mgso4-neuro').nivel, 'amarelo');
  assert.ok(!a.some(x => x.regraId === 'res-rpmo'));
  assert.equal(a.length, 2);
});

test('HAC com 37+0: res-hac; com dificil: res-hac-dificil', () => {
  const a = avaliarAlertas(hac(), HOJE, REGRAS_GLOBAIS).filter(x => x.regraId.startsWith('res-'));
  assert.deepEqual(a.map(x => x.regraId), ['res-hac']);
  const b = avaliarAlertas(hac({ dificil: true }), HOJE, REGRAS_GLOBAIS).filter(x => x.regraId.startsWith('res-'));
  assert.deepEqual(b.map(x => x.regraId), ['res-hac-dificil']);
});

test('chaveFeito e registro compartilhado do corticoide', () => {
  assert.equal(chaveFeito('corticoide'), 'corticoide');
  assert.equal(chaveFeito('corticoide-pe'), 'corticoide');
  assert.equal(chaveFeito('mgso4-neuro'), 'mgso4-neuro');
  const p = registrarAlertaFeito({ alertasFeitos: [] }, 'corticoide-pe', HOJE, 'ok');
  assert.equal(p.alertasFeitos[0].id, 'corticoide');
  assert.deepEqual(desfazerAlertaFeito(p, 'corticoide-rpmo').alertasFeitos, []);
});

test('contexto: regra do serviço substitui a global e herda antecedência 7', () => {
  const estado = { ...novoEstado(), regrasServico: 'res-colestase | colestase!ab100 | 37+0 | 37+6 | vermelho | HU-X | HU-X 2025' };
  const c = contexto(estado);
  assert.deepEqual(c.faixas.map(f => f.id), ['glic-hipo', 'glic-jejum', 'glic-pos', 'pa-crise', 'pa-alta']);
  assert.deepEqual(c.errosRegras, []);
  const r = c.regras.find(x => x.id === 'res-colestase');
  assert.equal(r.ini, 37 * 7);
  assert.equal(r.fonte, 'HU-X 2025');
  assert.equal(r.antecedencia, 7);
  assert.equal(c.regras.filter(x => x.id === 'res-colestase').length, 1);
});

test('mgso4-neuro: nada aos 20+0, amarelo aos 24+0', () => {
  const p = (d) => ({ igDays: d, igRef: HOJE, alertasFeitos: [], dxs: [] });
  assert.ok(!avaliarAlertas(p(ig(20)), HOJE, REGRAS_GLOBAIS).some(x => x.regraId === 'mgso4-neuro'));
  const a = avaliarAlertas(p(ig(24)), HOJE, REGRAS_GLOBAIS).find(x => x.regraId === 'mgso4-neuro');
  assert.equal(a.nivel, 'amarelo');
});

test('chaveFeito tolera undefined e desfazer sem id é no-op', () => {
  assert.equal(chaveFeito(undefined), undefined);
  const p = { alertasFeitos: [{ id: 'corticoide', data: HOJE, res: '' }] };
  assert.deepEqual(desfazerAlertaFeito(p, undefined).alertasFeitos, p.alertasFeitos);
});

test('feito registrado por corticoide-pe aparece cinza em paciente com corticoide-rpmo', () => {
  let p = { igDays: ig(30), igRef: HOJE, alertasFeitos: [], dxs: [{ dx: 'rpmo', mods: {} }] };
  p = registrarAlertaFeito(p, 'corticoide-pe', HOJE);
  const c = avaliarAlertas(p, HOJE, REGRAS_GLOBAIS).filter(x => x.regraId.startsWith('corticoide'));
  assert.equal(c.length, 1);
  assert.equal(c[0].regraId, 'corticoide-rpmo');
  assert.equal(c[0].nivel, 'cinza');
  assert.equal(c[0].estado, 'feito');
});

test('corticoide anterior que não emite não esconde o seguinte', () => {
  const regras = parseRegras(`
corticoide | | 28+0 | 33+6 | vermelho | Cort A | X
corticoide-b | | 24+0 | 33+6 | vermelho | Cort B | X
`).itens;
  const p = { igDays: ig(26), igRef: HOJE, alertasFeitos: [], dxs: [] };
  const a = avaliarAlertas(p, HOJE, regras);
  assert.equal(a.length, 1);
  assert.equal(a[0].regraId, 'corticoide-b');
});
