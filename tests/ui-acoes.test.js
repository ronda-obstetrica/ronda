// Ações da UI com uma api falsa (sem DOM): aviso de falha ao salvar e alta provisória.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoEstado, seedExemplos, novaPaciente } from '../js/nucleo/estado.js';
import { contexto } from '../js/nucleo/contexto.js';
import { avaliarAlertas } from '../js/nucleo/alertas.js';
import { acoes as censo, htmlCenso } from '../js/ui/censo.js';
import { acoes as forms, htmlCadastro } from '../js/ui/formularios.js';
import { AVISO_FALHA_SALVAR } from '../js/ui/util.js';

const HOJE = '2026-11-08';

// Imita app.js: aplica a mutação, avisa a falha e devolve o resultado de salvar.
function apiFalsa({ salvarOk }) {
  let estado = { ...novoEstado(), pac: seedExemplos(HOJE) };
  const avisos = [];
  return {
    avisos,
    atualizar(m) {
      const n = m(estado);
      if (!n) return false;
      estado = n;
      if (!salvarOk) avisos.push(AVISO_FALHA_SALVAR);
      return salvarOk;
    },
    abrirFolha() {}, fecharFolha() {}, avisar(msg) { avisos.push(msg); },
    get estado() { return estado; }, get ctx() { return contexto(estado); }, get hoje() { return HOJE; },
  };
}

function formPaciente(leito, dx) {
  const campos = { leito, dum: '', usgData: '', usgIG: '', idade: '', g: '', p: '', c: '', a: '', int: HOJE, alerg: '', obs: '' };
  const elements = Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { value: v, focus() {} }]));
  const bloco = { querySelector: () => ({ value: dx }), querySelectorAll: () => [] };
  return { dataset: { id: '' }, elements, querySelectorAll: () => [bloco], querySelector: () => null };
}

const leito04 = (api) => api.estado.pac.find((p) => p.leito === '04');

test('falha ao salvar: o aviso de erro não é trocado pelo de sucesso', () => {
  const api = apiFalsa({ salvarOk: false });
  forms['paciente-salvar'](null, formPaciente('12', 'rpmo'), api);
  assert.equal(api.avisos.at(-1), AVISO_FALHA_SALVAR);

  const p = leito04(api);
  const regra = avaliarAlertas(p, HOJE, api.ctx.regras)[0].regraId;
  censo['alerta-pend'](null, { dataset: { id: p.id, regra } }, api);
  assert.equal(api.avisos.at(-1), AVISO_FALHA_SALVAR);

  censo['registrar-valor'](null, { dataset: { id: p.id }, elements: { medida: { value: 'pa' }, valor: { value: '165x100', focus() {} } } }, api);
  assert.equal(api.avisos.at(-1), AVISO_FALHA_SALVAR);
  assert.ok(!api.avisos.some((m) => /salvo|Virou pendência|Fora da faixa/.test(m)));
});

test('salvar com sucesso mostra o aviso de sucesso', () => {
  const api = apiFalsa({ salvarOk: true });
  forms['paciente-salvar'](null, formPaciente('12', 'rpmo'), api);
  assert.equal(api.avisos.at(-1), 'Leito 12 salvo.');
});

test('Alta/parto ainda não apaga nada', () => {
  const api = apiFalsa({ salvarOk: true });
  const antes = api.estado.pac.length;
  censo.alta(null, { dataset: { id: leito04(api).id } }, api);
  assert.equal(api.estado.pac.length, antes);
  assert.equal(api.avisos.at(-1), 'Alta/parto: disponível em breve.');
});

test('cadastro escapa valores vindos de um backup importado', () => {
  const xss = '"><img src=x onerror=alert(1)>';
  const pac = novaPaciente({
    leito: xss, idade: xss, g: xss, p: xss, c: xss, a: xss, int: xss, alerg: xss, obs: xss,
    datacao: { dum: xss, usg: { data: xss, igDias: xss }, escolhida: 'usg' },
    dxs: [{ dx: 'dheg', mods: { tipo: xss } }],
  });
  const html = htmlCadastro(pac, HOJE);
  assert.ok(!html.includes('<img'), 'HTML contém <img sem escape');
  assert.ok(html.includes('&quot;&gt;&lt;img'));
  const estado = { ...novoEstado(), pac: [{ ...pac, registros: [{ id: xss, data: HOJE, medida: 'pa', valor: { s: xss, d: 1 } }] }] };
  const cartao = htmlCenso({ estado, ctx: contexto(estado), hoje: HOJE });
  assert.ok(!cartao.includes('<img'), 'cartão contém <img sem escape');
});
