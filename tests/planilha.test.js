import { test } from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs'; import vm from 'node:vm';
import { COLUNAS, linhasPlanilha, gerarXlsx } from '../js/relatorios/planilha.js';
import { partesExtenso } from '../js/nucleo/diagnosticos.js';
import { novoEstado, novaPaciente, seedExemplos } from '../js/nucleo/estado.js';
import { novaPendencia } from '../js/nucleo/pendencias.js';
import { contexto } from '../js/nucleo/contexto.js';

const HOJE = '2026-11-04';
const mkEst = (pac) => ({ ...novoEstado(), pac });
const gerar = (e) => linhasPlanilha(e, HOJE, contexto(e), new Date(HOJE + 'T12:00'));
const col = (linhas, nome, i) => linhas[i][COLUNAS.indexOf(nome)];

test('partesExtenso inclui o tipo da DHEG', () => {
  assert.deepEqual(partesExtenso({ dx: 'dheg', mods: { tipo: 'pe', gravidade: true } }), ['pré-eclâmpsia', 'com sinais de gravidade']);
  assert.deepEqual(partesExtenso({ dx: 'rpmo', mods: {} }), []);
  assert.deepEqual(partesExtenso({ dx: 'nada' }), []);
});
test('seed: 4 linhas, cabeçalho = COLUNAS', () => {
  const l = gerar(mkEst(seedExemplos(HOJE)));
  assert.equal(l.length, 4);
  assert.deepEqual(l[0], COLUNAS);
  assert.deepEqual(l.map(r => r[0]), ['Leito', '04', '07', '09']);
});
test('modificadores e valores básicos', () => {
  const l = gerar(mkEst(seedExemplos(HOJE)));
  assert.equal(col(l, 'Modificadores', 2), 'em uso de medicação; controle glicêmico ruim');
  assert.equal(col(l, 'Modificadores', 1), 'pré-eclâmpsia; com sinais de gravidade');
  assert.equal(col(l, 'Diagnósticos', 1), 'DHEG');
  assert.equal(col(l, 'G/P/C/A', 1), 'G2P1C1A0');
  assert.equal(col(l, 'Dia de internação', 1), 'D7');
  assert.equal(col(l, 'Idade', 1), '27');
  assert.equal(col(l, 'Alergias', 3), 'Penicilina');
  assert.match(col(l, 'Alertas feitos', 3), /\S/);
});
test('nenhuma célula undefined/null; todas strings', () => {
  const vazia = novaPaciente({ id: 'x', leito: '01', dxs: [] });
  for (const e of [mkEst(seedExemplos(HOJE)), mkEst([vazia])]) {
    for (const r of gerar(e)) {
      assert.equal(r.length, COLUNAS.length);
      for (const c of r) { assert.equal(typeof c, 'string'); assert.ok(!/undefined|null/.test(c)); }
    }
  }
  const l = gerar(mkEst([vazia]));
  assert.equal(col(l, 'Idade', 1), ''); assert.equal(col(l, 'Dia de internação', 1), '');
});
test('pendências abertas, atrasadas e aguardando', () => {
  const pend = [
    novaPendencia({ id: 'a', texto: 'Hoje1', due: HOJE }),
    novaPendencia({ id: 'b', texto: 'Futura', due: '2026-11-10' }),
    novaPendencia({ id: 'c', texto: 'Velha', due: '2026-11-01' }),
    novaPendencia({ id: 'd', texto: 'Feita', due: HOJE, done: true, doneAt: HOJE }),
    novaPendencia({ id: 'e', texto: 'USG', due: HOJE, cat: 'Exame', estadoExame: 'aguardando' }),
  ];
  const l = gerar(mkEst([novaPaciente({ id: 'x', leito: '01', pend })]));
  assert.equal(col(l, 'Pendências abertas', 1), 'Hoje1; Futura');
  assert.equal(col(l, 'Pendências atrasadas', 1), 'Velha (3d)');
  assert.equal(col(l, 'Aguardando resultado', 1), 'USG');
});
test('gerarXlsx (SheetJS vendorizado) gera zip não vazio', (t) => {
  let XLSX;
  try { const ctx = { }; vm.createContext(ctx); vm.runInContext(readFileSync(new URL('../vendor/xlsx.mini.min.js', import.meta.url), 'utf8') + ';this.XLSX = XLSX;', ctx); XLSX = ctx.XLSX; } catch (e) { t.skip('SheetJS não carrega no Node: ' + e.message); return; }
  const blob = gerarXlsx(gerar(mkEst(seedExemplos(HOJE))), XLSX);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return blob.arrayBuffer().then(ab => {
    const b = new Uint8Array(ab);
    assert.ok(b.length > 100);
    assert.equal(String.fromCharCode(b[0], b[1]), 'PK');
  });
});

test('colunas Medicações e Programação, sem iniciais', async () => {
  const { novaMed } = await import('../js/nucleo/medicacoes.js');
  const p = novaPaciente({ id: 'x', leito: '01', int: '2026-11-01', igDays: 200, igRef: HOJE, iniciais: 'MAS', prog: 'USG amanhã',
    meds: [novaMed({ texto: 'Cefalexina 12/12h', inicio: '2026-11-02', previstos: 7 })] });
  const l = gerar(mkEst([p]));
  assert.equal(col(l, 'Medicações', 1), 'Cefalexina 12/12h · D3/7');
  assert.equal(col(l, 'Programação', 1), 'USG amanhã');
  assert.ok(!JSON.stringify(l).includes('MAS'));
});
