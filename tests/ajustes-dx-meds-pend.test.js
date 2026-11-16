// Ajustes pedidos: diagnóstico sem sigla e com exclusão dos padrão, medicações já utilizadas, pendência por texto livre.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { novoEstado, novaPaciente, migrar, normalizarMed } from '../js/nucleo/estado.js';
import {
  definirDxCustom, listaDx, validarNovoDx, criarDx, ocultarDx, restaurarDxBase, rotuloCurto, rotuloExtenso, dxDef, DIAGNOSTICOS,
} from '../js/nucleo/diagnosticos.js';
import { contexto } from '../js/nucleo/contexto.js';
import { novaMed, diaMed, rotuloUsada, adicionarMed, editarMed, suspenderMed, retomarMed } from '../js/nucleo/medicacoes.js';
import { resumoPaciente } from '../js/relatorios/comum.js';
import { htmlMedicacoes, lerMedForm, acoes as acoesPaciente } from '../js/ui/paciente.js';
import { lerRepeticao, interpretarPendencias, parseProtocolo } from '../js/nucleo/pendencias.js';
import { htmlNovaPend, acoes as acoesPend } from '../js/ui/pendform.js';
import { htmlProtocolos, acoes as acoesProt } from '../js/ui/protocolos.js';
import { htmlCadastro } from '../js/ui/formularios.js';

const HOJE = '2026-11-16';
afterEach(() => definirDxCustom([]));

// ---------- 1. Diagnóstico sem sigla ----------

test('novo diagnóstico: só o nome é obrigatório; aparece o nome', () => {
  assert.equal(validarNovoDx(novoEstado(), { nome: 'Pielonefrite', sigla: '' }), null);
  assert.ok(validarNovoDx(novoEstado(), { nome: '', sigla: '' }));
  assert.ok(validarNovoDx(novoEstado(), { nome: 'Diabetes', sigla: '' }), 'nome igual ao de um padrão');
  const e = criarDx(novoEstado(), { nome: 'Pielonefrite', sigla: '' });
  const { id } = e.dxCustom[0];
  assert.equal(id, 'u-pielonefrite');
  definirDxCustom(e.dxCustom);
  assert.equal(rotuloCurto({ dx: id, mods: {} }), 'Pielonefrite');
  assert.equal(rotuloExtenso({ dx: id, mods: {} }), 'Pielonefrite');
  assert.ok(validarNovoDx(e, { nome: 'pielonefrite', sigla: '' }), 'duplicado');
});

test('diagnóstico criado antes, com sigla, continua igual', () => {
  const e = criarDx(novoEstado(), { nome: 'Pielonefrite', sigla: 'PNF' });
  definirDxCustom(e.dxCustom);
  assert.equal(rotuloCurto({ dx: e.dxCustom[0].id, mods: {} }), 'PNF');
});

test('formulário de cadastro não pergunta a sigla', () => {
  const html = htmlCadastro(null, HOJE);
  assert.match(html, /data-dx-nome/);
  assert.doesNotMatch(html, /data-dx-sigla/);
  assert.doesNotMatch(html, />Sigla</);
});

// ---------- 2. Excluir diagnóstico padrão da lista ----------

test('ocultarDx tira da lista, guarda o protocolo e pode restaurar', () => {
  let e = novoEstado();
  const antes = e.prot.tpp;
  e = ocultarDx(e, 'tpp');
  assert.deepEqual(e.dxOcultos, ['tpp']);
  assert.equal(e.prot.tpp, antes);
  definirDxCustom(e.dxCustom, e.dxOcultos);
  assert.ok(!listaDx().some(([id]) => id === 'tpp'));
  assert.ok(dxDef('tpp'), 'a definição continua existindo');
  e = restaurarDxBase(e);
  definirDxCustom(e.dxCustom, e.dxOcultos);
  assert.deepEqual(listaDx().map(([k]) => k), Object.keys(DIAGNOSTICOS));
});

test('ocultarDx recusa dx em uso e dx que não é padrão', () => {
  const e = novoEstado();
  e.pac = [novaPaciente({ leito: '1', dxs: [{ dx: 'dheg', mods: {} }] })];
  assert.equal(ocultarDx(e, 'dheg'), null);
  assert.equal(ocultarDx(e, 'u-qualquer'), null);
  assert.ok(ocultarDx(e, 'dmg'));
});

test('dxOcultos: estado novo, migração, contexto e backup', () => {
  assert.deepEqual(novoEstado().dxOcultos, []);
  assert.deepEqual(migrar({ v: 3, pac: [] }).dxOcultos, []);
  assert.deepEqual(migrar({ v: 3, pac: [], dxOcultos: ['rcf', 7] }).dxOcultos, ['rcf']);
  contexto({ ...novoEstado(), dxOcultos: ['rcf'] });
  assert.ok(!listaDx().some(([id]) => id === 'rcf'));
});

test('Protocolos: botão × Excluir da lista nos padrão e restaurar', () => {
  const estado = novoEstado();
  const dados = { estado, ctx: contexto(estado), hoje: HOJE };
  assert.match(htmlProtocolos(dados), /data-act="dx-ocultar" data-dx="dheg"/);
  const avisos = [];
  const api = { estado, atualizar: (fn) => { const n = fn(api.estado); if (!n) return false; api.estado = n; contexto(n); return true; }, avisar: (m) => avisos.push(m) };
  globalThis.confirm = () => true;
  acoesProt['dx-ocultar']({}, { dataset: { dx: 'tpp' } }, api);
  assert.deepEqual(api.estado.dxOcultos, ['tpp']);
  const html = htmlProtocolos({ estado: api.estado, ctx: contexto(api.estado), hoje: HOJE });
  assert.doesNotMatch(html, /data-dx="tpp"/);
  assert.match(html, /dx-restaurar-base/);
  acoesProt['dx-restaurar-base']({}, {}, api);
  assert.deepEqual(api.estado.dxOcultos, []);
  delete globalThis.confirm;
});

test('Protocolos: não exclui dx em uso', () => {
  const estado = novoEstado();
  estado.pac = [novaPaciente({ leito: '1', dxs: [{ dx: 'dheg', mods: {} }] })];
  const avisos = [];
  const api = { estado, atualizar: () => { throw new Error('não deveria gravar'); }, avisar: (m) => avisos.push(m) };
  acoesProt['dx-ocultar']({}, { dataset: { dx: 'dheg' } }, api);
  assert.match(avisos[0], /Em uso em 1 leito/);
});

test('cadastro: dx padrão fora da lista, mas ainda usado no leito, segue selecionável', () => {
  const estado = novoEstado();
  const pac = novaPaciente({ leito: '1', dxs: [{ dx: 'rcf', mods: {} }] });
  definirDxCustom([], ['rcf']);
  const html = htmlCadastro(pac, HOJE);
  assert.match(html, /<option value="rcf" selected>RCF<\/option>/);
  assert.doesNotMatch(htmlCadastro(null, HOJE), /<option value="rcf"/);
  assert.ok(estado);
});

// ---------- 3. Medicações já utilizadas ----------

const ce = (o = {}) => novaMed({ texto: 'Cefalexina', inicio: '2026-11-06', previstos: 7, ...o });

test('suspender move para as já utilizadas e retomar volta', () => {
  const p = novaPaciente({ id: 'p', leito: '01' });
  const m = ce();
  adicionarMed(p, m);
  suspenderMed(p, m.id, '2026-11-12');
  assert.equal(p.meds[0].fim, '2026-11-12');
  assert.equal(diaMed(p.meds[0], '2026-11-12'), null, 'não conta dia depois de suspensa');
  assert.equal(rotuloUsada(p.meds[0]), 'Cefalexina · 06/11 a 12/11 · 7 dias');
  retomarMed(p, m.id);
  assert.ok(!('fim' in p.meds[0]));
  assert.equal(diaMed(p.meds[0], '2026-11-08').d, 3);
});

test('suspender antes do início usa a data de início; editar com fim vazio volta a em curso', () => {
  const p = novaPaciente({ id: 'p' });
  const m = ce({ inicio: '2026-11-20' });
  adicionarMed(p, m);
  suspenderMed(p, m.id, '2026-11-16');
  assert.equal(p.meds[0].fim, '2026-11-20');
  editarMed(p, m.id, { fim: '' });
  assert.ok(!('fim' in p.meds[0]));
  editarMed(p, m.id, { fim: '2026-11-21' });
  assert.equal(p.meds[0].fim, '2026-11-21');
  editarMed(p, m.id, { fim: 'lixo' });
  assert.ok(!('fim' in p.meds[0]));
});

test('backup guarda a data de suspensão e ignora data inválida', () => {
  assert.equal(normalizarMed({ texto: 'A', fim: '2026-11-12' }).fim, '2026-11-12');
  assert.ok(!('fim' in normalizarMed({ texto: 'A', fim: 'abc' })));
  assert.ok(!('fim' in normalizarMed({ texto: 'A' })));
});

test('página da paciente separa em curso e já utilizadas', () => {
  const p = novaPaciente({ id: 'p', leito: '01' });
  adicionarMed(p, ce({ texto: 'Em curso A' }));
  adicionarMed(p, ce({ texto: 'Usada B', fim: '2026-11-10' }));
  const html = htmlMedicacoes(p, HOJE);
  assert.match(html, /Em curso A/);
  assert.match(html, /data-act="med-suspender"/);
  assert.match(html, /<details class="bloco" data-k="meds-usadas">[\s\S]*Usada B · 06\/11 a 10\/11 · 5 dias[\s\S]*med-retomar/);
  const emCurso = html.split('<details')[0];
  assert.doesNotMatch(emCurso, /Usada B/);
  const vazio = htmlMedicacoes(novaPaciente({ id: 'q', leito: '2' }), HOJE);
  assert.doesNotMatch(vazio, /já utilizadas/);
});

test('formulário aceita data de suspensão e valida', () => {
  const el = (fim, inicio = '2026-11-06') => ({ texto: { value: 'A' }, inicio: { value: inicio }, previstos: { value: '' }, contar: { checked: true }, fim: { value: fim } });
  assert.equal(lerMedForm(el('2026-11-10'), HOJE).campos.fim, '2026-11-10');
  assert.equal(lerMedForm(el(''), HOJE).campos.fim, '');
  assert.match(lerMedForm(el('2026-11-01'), HOJE).erro, /antes do início/);
  assert.match(lerMedForm(el('10/11'), HOJE).erro, /inválida/);
});

test('ações suspender e retomar pela página', () => {
  const pac = novaPaciente({ id: 'p', leito: '01', meds: [ce()] });
  const medId = pac.meds[0].id;
  const estado = { ...novoEstado(), pac: [pac] };
  const api = { estado, hoje: HOJE, atualizar: (fn) => { api.estado = fn(api.estado); return true; }, avisar: () => {} };
  acoesPaciente['med-suspender']({}, { dataset: { id: 'p', med: medId } }, api);
  assert.equal(api.estado.pac[0].meds[0].fim, HOJE);
  assert.equal(pac.meds[0].fim, undefined, 'não altera o estado antigo');
  acoesPaciente['med-retomar']({}, { dataset: { id: 'p', med: medId } }, api);
  assert.ok(!('fim' in api.estado.pac[0].meds[0]));
});

test('relatórios só listam medicações em curso', () => {
  const e = { ...novoEstado(), pac: [novaPaciente({ id: 'p', leito: '1', igRef: HOJE, igDays: 200, meds: [ce({ texto: 'Ativa' }), ce({ texto: 'Antiga', fim: '2026-11-10' })] })] };
  const r = resumoPaciente(e.pac[0], HOJE, contexto(e));
  assert.equal(r.meds.length, 1);
  assert.match(r.meds[0], /^Ativa/);
});

// ---------- 4. Pendência por texto livre e repetição ----------

test('lerRepeticao entende dias, horas e palavras', () => {
  const casos = { 2: 2, '48h': 2, '24h': 1, '72 horas': 3, 'a cada 3 dias': 3, semanal: 7, quinzenal: 14, mensal: 30, diário: 1, diaria: 1, '2 semanas': 14, 0: 0, '0': 0 };
  for (const [txt, dias] of Object.entries(casos)) assert.equal(lerRepeticao(txt), dias, txt);
  for (const ruim of ['', 'xyz', '-1', '1.5', '400']) assert.equal(lerRepeticao(ruim), null, ruim);
});

test('interpretarPendencias: exemplos do uso real', () => {
  assert.deepEqual(interpretarPendencias('rotina infecciosa a cada 48h, usg semanal'), [
    { texto: 'Rotina infecciosa', cat: 'Exame', rep: 2, dias: 0 },
    { texto: 'USG', cat: 'Exame', rep: 7, dias: 0 },
  ]);
  assert.deepEqual(interpretarPendencias('hemograma diário amanhã'), [{ texto: 'Hemograma', cat: 'Exame', rep: 1, dias: 1 }]);
  assert.deepEqual(interpretarPendencias('Doppler de 7 em 7 dias'), [{ texto: 'Doppler', cat: 'Exame', rep: 7, dias: 0 }]);
  assert.deepEqual(interpretarPendencias('ctg 12/12h'), [{ texto: 'CTG', cat: 'Exame', rep: 1, dias: 0 }]);
  assert.deepEqual(interpretarPendencias('interconsulta com cardiologia hoje'), [{ texto: 'Interconsulta com cardiologia', cat: 'Interconsulta', rep: 0, dias: 0 }]);
  assert.deepEqual(interpretarPendencias(' , ; '), []);
});

test('protocolo aceita 48h e semanal na coluna de repetição', () => {
  const { itens, erros } = parseProtocolo('CTG | Exame | 0 | 48h\nUSG | Exame | 0 | semanal\nHemograma | Exame | 0 | 3\nX | Exame | 0 | de vez em quando');
  assert.deepEqual(itens.map((i) => i.rep), [2, 7, 3]);
  assert.equal(erros.length, 1);
  assert.match(erros[0].msg, /repetição inválida/);
});

test('formulário de pendência tem o campo rápido e os atalhos de repetição', () => {
  const pac = novaPaciente({ id: 'p', leito: '04' });
  const html = htmlNovaPend(pac, HOJE);
  assert.match(html, /name="rapido"/);
  assert.match(html, /data-act="pend-rapida-salvar"/);
  for (const n of [0, 1, 2, 3, 7, 14]) assert.match(html, new RegExp(`data-act="pend-rep" data-n="${n}"`));
});

function apiPend(pac) {
  const estado = { ...novoEstado(), pac: [pac] };
  const api = {
    estado, hoje: HOJE, avisos: [], fechou: false,
    atualizar: (fn) => { api.estado = fn(api.estado); return true; },
    fecharFolha: () => { api.fechou = true; },
    avisar: (m) => api.avisos.push(m),
  };
  return api;
}

test('texto rápido cria as pendências já com repetição e prazo', () => {
  const pac = novaPaciente({ id: 'p', leito: '04' });
  const api = apiPend(pac);
  const form = { elements: { rapido: { value: 'rotina infecciosa a cada 48h, usg semanal amanhã' } } };
  acoesPend['pend-rapida-salvar']({}, { dataset: { id: 'p' }, closest: () => form }, api);
  const pend = api.estado.pac[0].pend;
  assert.deepEqual(pend.map((p) => [p.texto, p.cat, p.rep, p.due, p.origem]), [
    ['Rotina infecciosa', 'Exame', 2, '2026-11-16', 'manual'],
    ['USG', 'Exame', 7, '2026-11-17', 'manual'],
  ]);
  assert.equal(api.fechou, true);
  assert.match(api.avisos[0], /2 pendências adicionadas ao leito 04/);
});

test('texto rápido não duplica pendência aberta', () => {
  const pac = novaPaciente({ id: 'p', leito: '04' });
  const api = apiPend(pac);
  const form = { elements: { rapido: { value: 'usg semanal' } } };
  const el = { dataset: { id: 'p' }, closest: () => form };
  acoesPend['pend-rapida-salvar']({}, el, api);
  api.fechou = false;
  acoesPend['pend-rapida-salvar']({}, el, api);
  assert.equal(api.estado.pac[0].pend.length, 1);
  assert.equal(api.fechou, false);
  assert.match(api.avisos.at(-1), /já estão abertas/);
});

test('Enter no campo rápido (manual em branco) cria o texto livre; manual preenchido segue o fluxo antigo', () => {
  const pac = novaPaciente({ id: 'p', leito: '04' });
  const api = apiPend(pac);
  const campos = (rapido, texto) => ({ dataset: { id: 'p' }, elements: { rapido: { value: rapido }, texto: { value: texto }, cat: { value: 'Exame' }, prazo: { value: HOJE }, rep: { value: '3' }, dur: { value: '' } } });
  acoesPend['pend-nova-salvar']({}, campos('ctg diário', ''), api);
  assert.deepEqual(api.estado.pac[0].pend.map((p) => [p.texto, p.rep]), [['CTG', 1]]);
  acoesPend['pend-nova-salvar']({}, campos('', 'Ver K'), api);
  assert.deepEqual(api.estado.pac[0].pend.map((p) => [p.texto, p.rep]), [['CTG', 1], ['Ver K', 3]]);
});

test('atalho de repetição preenche o campo', () => {
  const rep = { value: '0' };
  acoesPend['pend-rep']({}, { dataset: { n: '2' }, closest: () => ({ elements: { rep } }) });
  assert.equal(rep.value, '2');
});
