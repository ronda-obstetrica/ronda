import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerIGDigitada, igHoje, addDias } from '../js/nucleo/datas.js';
import { novoEstado } from '../js/nucleo/estado.js';
import { contexto } from '../js/nucleo/contexto.js';
import { acoes as forms, textoDatacao, htmlCadastro } from '../js/ui/formularios.js';

const HOJE = '2026-11-08';
const ERRO = { erro: 'Use semanas+dias, ex.: 31+2' };

test('lerIGDigitada aceita 31+2, 31 2, 31 e espaços', () => {
  assert.deepEqual(lerIGDigitada('31+2'), { dias: 219 });
  assert.deepEqual(lerIGDigitada('31 2'), { dias: 219 });
  assert.deepEqual(lerIGDigitada('31'), { dias: 217 });
  assert.deepEqual(lerIGDigitada('  31 + 2 '), { dias: 219 });
  assert.deepEqual(lerIGDigitada('0+0'), { dias: 0 });
  assert.deepEqual(lerIGDigitada('44+6'), { dias: 314 });
});

test('lerIGDigitada recusa formatos inválidos e vazio é não informado', () => {
  for (const t of ['31+7', '31+', '31,2', 'abc', '45', '45+0', '-1']) assert.deepEqual(lerIGDigitada(t), ERRO, t);
  assert.deepEqual(lerIGDigitada(''), { dias: null });
  assert.deepEqual(lerIGDigitada('   '), { dias: null });
  assert.deepEqual(lerIGDigitada(undefined), { dias: null });
});

test('prévia mostra a IG digitada e o erro de formato', () => {
  const ok = textoDatacao({ igHoje: '31+2' }, HOJE);
  assert.equal(ok.erro, null);
  assert.match(ok.texto, /IG hoje: 31\+2/);
  assert.equal(ok.sug.fonte, 'ig');
  assert.equal(textoDatacao({ igHoje: '31+7' }, HOJE).erro, 'Use semanas+dias, ex.: 31+2');
});

test('com DUM e IG hoje e sem escolha, mantém a sugestão DUM/USG e oferece o rádio IG', () => {
  const r = textoDatacao({ dum: '2026-04-01', igHoje: '31+2' }, HOJE);
  assert.equal(r.sug.fonte, 'dum');
  assert.deepEqual(r.disponiveis, ['dum', 'ig']);
});

function formPaciente({ igHoje: ig, escolhida }) {
  const campos = { leito: '12', dum: '', usgData: '', usgIG: '', igHoje: ig, idade: '', par: '', iniciais: '', int: HOJE, alerg: '', obs: '' };
  const elements = Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { value: v, focus() {} }]));
  const bloco = { querySelector: () => ({ value: 'rpmo' }), querySelectorAll: () => [] };
  return {
    dataset: { id: '' }, elements, querySelectorAll: () => [bloco],
    querySelector: (q) => (q.includes(':checked') && escolhida ? { value: escolhida } : null),
  };
}

function apiFalsa() {
  let estado = novoEstado();
  const avisos = [];
  return {
    avisos, atualizar(m) { const n = m(estado); if (!n) return false; estado = n; return true; },
    abrirFolha() {}, fecharFolha() {}, avisar(m) { avisos.push(m); },
    get estado() { return estado; }, get ctx() { return contexto(estado); }, get hoje() { return HOJE; },
  };
}

test('salvar só com IG digitada grava igDays, igRef e datacao ig', () => {
  const api = apiFalsa();
  forms['paciente-salvar'](null, formPaciente({ igHoje: '31+2' }), api);
  const pac = api.estado.pac[0];
  assert.equal(pac.igDays, 219);
  assert.equal(pac.igRef, HOJE);
  assert.equal(pac.datacao.escolhida, 'ig');
  assert.equal(pac.datacao.igDigitada, 219);
  assert.equal(igHoje(pac, addDias(HOJE, 3)), 31 * 7 + 5);
});

test('IG digitada inválida impede salvar', () => {
  const api = apiFalsa();
  forms['paciente-salvar'](null, formPaciente({ igHoje: '31+7' }), api);
  assert.equal(api.estado.pac.length, 0);
  assert.ok(api.avisos.includes('Use semanas+dias, ex.: 31+2'));
});

test('cadastro tem o campo IG hoje com 16px de fonte garantida pelo css e rádio ig', () => {
  const html = htmlCadastro(null, HOJE);
  assert.match(html, /name="igHoje" placeholder="31\+2" inputmode="text"/);
  assert.match(html, /value="ig"/);
});
