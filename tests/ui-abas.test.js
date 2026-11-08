// HTML das abas Hoje, Plantão, Protocolos e Dados e da pendência manual, gerado no Node (sem DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoEstado, seedExemplos, novaPaciente } from '../js/nucleo/estado.js';
import { contexto } from '../js/nucleo/contexto.js';
import { novaPendencia } from '../js/nucleo/pendencias.js';
import { htmlHoje, alertasDeTodos } from '../js/ui/hoje.js';
import { htmlPlantao, nomePlanilha } from '../js/ui/plantao.js';
import { htmlProtocolos, htmlGlobais, htmlErros, errosDe, gravarTexto, AVISO_PROTOCOLOS, acoes as acoesProt, limparRascunhos, temRascunho } from '../js/ui/protocolos.js';
import { htmlDados, confirmaApagar, nomeBackup, ensaiarRestauracao } from '../js/ui/dados.js';
import { htmlNovaPend, lerNovaPend, acoes as acoesPend } from '../js/ui/pendform.js';
import { exportarJSON } from '../js/nucleo/estado.js';
import { htmlCenso, htmlLembreteBackup } from '../js/ui/censo.js';

const HOJE = '2026-11-08';
const AGORA = new Date(`${HOJE}T12:00`);
const XSS = '<img src=x onerror=alert(1)>';
const comSeed = () => ({ ...novoEstado(), pac: seedExemplos(HOJE) });
const dados = (estado) => ({ estado, ctx: contexto(estado), hoje: HOJE });
const semXss = (html) => {
  assert.ok(!html.includes('<img'), 'tag <img> não escapada');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'payload escapado ausente');
};

test('Hoje: alertas de todos os leitos com o leito, ordenados (vermelho primeiro)', () => {
  const estado = comSeed();
  const al = alertasDeTodos(estado, HOJE, contexto(estado));
  assert.ok(al.length > 0);
  assert.ok(al.every((a) => a.nivel === 'vermelho' || a.nivel === 'amarelo'));
  const niveis = al.map((a) => a.nivel);
  assert.deepEqual(niveis, [...niveis].sort((x, y) => (x === 'vermelho' ? 0 : 1) - (y === 'vermelho' ? 0 : 1)));
  const html = htmlHoje(dados(estado), AGORA);
  assert.match(html, /<h3>Alertas <span class="contagem">\d+<\/span>/);
  assert.match(html, /Leito 04<\/b> <span class="prefixo">▲ AGIR:/);
  assert.match(html, /data-act="alerta-feito" data-id="[^"]+" data-regra="[^"]+"/);
  assert.doesNotMatch(html, /undefined|NaN/);
});

test('Hoje: pendências agrupadas na ordem pedida, cada uma com o leito e atrasadas com dias', () => {
  const pac = novaPaciente({ leito: '12', dxs: [{ dx: 'outro', mods: {} }], pend: [
    novaPendencia({ texto: 'Amanhã X', due: '2026-11-09' }),
    novaPendencia({ texto: 'Concluída Y', due: HOJE, done: true, doneAt: HOJE }),
    novaPendencia({ texto: 'Exame Z', cat: 'Exame', due: HOJE, estadoExame: 'aguardando', aguardandoDesde: '2026-11-07' }),
    novaPendencia({ texto: 'Hoje W', due: HOJE }),
    novaPendencia({ texto: 'Atrasada V', due: '2026-11-05' }),
  ] });
  const estado = { ...novoEstado(), pac: [pac] };
  const html = htmlHoje(dados(estado), AGORA);
  const ordem = ['Atrasadas', 'Hoje <span', 'Aguardando resultado', 'Amanhã', 'Concluídas hoje'].map((t) => html.indexOf(`<h3>${t}`));
  assert.ok(ordem.every((i) => i > 0), `grupo faltando: ${ordem}`);
  assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b));
  assert.match(html, /Leito 12<\/b> <span class="prefixo">ATRASADA 3d:<\/span> Atrasada V/);
  assert.equal((html.match(/class="pend-leito">Leito 12/g) ?? []).length, 5);
  assert.match(html, /data-act="pend-desfazer"/); // mesmas ações do Censo
  assert.doesNotMatch(html, /data-act="pend-aguardando"/); // o exame já está aguardando
});

test('Hoje: texto de pendência é escapado', () => {
  const pac = novaPaciente({ leito: '1', dxs: [{ dx: 'outro', mods: {} }], pend: [novaPendencia({ texto: XSS, due: HOJE })] });
  semXss(htmlHoje(dados({ ...novoEstado(), pac: [pac] }), AGORA));
});

test('Plantão: botões, prévia escapada e nome da planilha', () => {
  const estado = comSeed();
  estado.pac[0].obs = XSS;
  const html = htmlPlantao(dados(estado));
  for (const b of ['Copiar texto', 'Imprimir / salvar PDF', 'Compartilhar planilha']) assert.ok(html.includes(`>${b}</button>`), b);
  assert.match(html, /<textarea class="previa" readonly[^>]*>PASSAGEM DE PLANTÃO/);
  semXss(html);
  assert.equal(nomePlanilha(HOJE), 'censo-2026-11-08.xlsx');
});

test('Protocolos: aviso fixo, um editor por diagnóstico e regras/faixas do serviço', () => {
  const html = htmlProtocolos(dados(comSeed()));
  assert.ok(html.includes(AVISO_PROTOCOLOS));
  assert.equal(AVISO_PROTOCOLOS, 'Os protocolos e regras que acompanham o app são um rascunho com fonte. Confira com os protocolos da sua instituição antes de usar.');
  assert.match(html, /data-tipo="regras"/);
  assert.match(html, /data-tipo="faixas"/);
  assert.match(html, /data-act="ver-globais" data-tipo="regras"/);
  assert.match(html, /data-act="ver-globais" data-tipo="faixas"/);
  assert.ok((html.match(/data-tipo="prot"/g) ?? []).length >= 8);
});

test('Protocolos: erro com número da linha ("37,0") e texto escapado', () => {
  const regras = `# comentário\nres-colestase | colestase!ab100 | 37,0 | 37+6 | vermelho | ${XSS} | HU-X`;
  const erros = errosDe('regras', regras);
  assert.equal(erros.length, 1);
  assert.equal(erros[0].n, 2);
  const estado = { ...comSeed(), regrasServico: regras, prot: { ...novoEstado().prot, dheg: `${XSS} | Categoria${XSS} | 0 | 1` } };
  const html = htmlProtocolos(dados(estado));
  assert.match(html, /Linha 2: IG início inválida/);
  semXss(html);
  assert.match(htmlErros(errosDe('prot', estado.prot.dheg)), /Linha 1: categoria inexistente/);
  assert.equal(htmlErros([]), '');
});

test('Protocolos: regra válida do serviço muda o alerta; salvar grava só o texto', () => {
  const linha = 'res-colestase | colestase!ab100 | 37+0 | 37+6 | vermelho | HU-X | HU-X 2025';
  const pac = novaPaciente({ leito: '3', igDays: 37 * 7 + 2, igRef: HOJE, dxs: [{ dx: 'colestase', mods: {} }] });
  const base = { ...novoEstado(), pac: [pac] };
  const novo = gravarTexto('regras', '', linha)(base);
  assert.equal(novo.regrasServico, linha);
  const msgs = alertasDeTodos(novo, HOJE, contexto(novo)).map((a) => a.msg);
  assert.ok(msgs.includes('HU-X'), msgs.join(' / '));
  assert.equal(gravarTexto('prot', 'dmg', 'x')(base).prot.dmg, 'x');
  assert.equal(gravarTexto('faixas', '', 'y')(base).faixasServico, 'y');
});

test('Protocolos: regras globais somente leitura, com Copiar', () => {
  const html = htmlGlobais('regras');
  assert.match(html, /<textarea class="previa" readonly/);
  assert.match(html, /data-act="copiar-globais" data-tipo="regras"/);
  assert.match(htmlGlobais('faixas'), /glic-hipo/);
});

test('Dados: LGPD, backup, restaurar, apagar exemplos e apagar tudo com APAGAR', () => {
  const html = htmlDados(dados(comSeed()));
  assert.match(html, /Nada é enviado a servidor/);
  assert.match(html, /data-act="backup-exportar"/);
  assert.match(html, /data-submit="backup-restaurar"/);
  assert.match(html, /type="file" name="arquivo" accept="\.json,application\/json"/);
  assert.match(html, /Apagar exemplos \(3\)/);
  assert.match(html, /digite APAGAR/);
  assert.equal(nomeBackup(HOJE), 'ronda-backup-2026-11-08.json');
  assert.ok(confirmaApagar('APAGAR'));
  assert.ok(confirmaApagar(' APAGAR '));
  assert.ok(!confirmaApagar('apagar'));
  assert.ok(!confirmaApagar(''));
  assert.match(htmlDados(dados(novoEstado())), /data-act="apagar-exemplos" disabled/);
});

test('Lembrete de backup no Censo com botão "Fazer backup" que leva à aba Dados', () => {
  const real = novaPaciente({ leito: '5', dxs: [{ dx: 'outro', mods: {} }] });
  const estado = { ...novoEstado(), pac: [real] };
  assert.match(htmlCenso(dados(estado), AGORA), /data-act="aba" data-aba="dados">Fazer backup<\/button>/);
  assert.equal(htmlLembreteBackup({ ...estado, ultimoBackup: HOJE }, HOJE), '');
  assert.equal(htmlLembreteBackup(comSeed(), HOJE), ''); // só exemplos
});

test('Pendência manual: botão no cartão, folha com campos e aviso de LGPD', () => {
  const estado = comSeed();
  assert.match(htmlCenso(dados(estado), AGORA), /data-act="pend-nova" data-id="[^"]+"[^>]*>\+ pendência/);
  const html = htmlNovaPend(estado.pac[0], HOJE);
  assert.match(html, /name="texto" maxlength="120"/);
  assert.match(html, /<select name="cat">/);
  assert.match(html, /<option value="Outro" selected>/);
  assert.match(html, new RegExp(`name="prazo" value="${HOJE}"`));
  assert.match(html, /name="rep"[^>]*value="0"/);
  assert.match(html, /name="dur"/);
  assert.match(html, /Não escreva nomes ou dados que identifiquem a paciente\./);
  semXss(htmlNovaPend({ ...estado.pac[0], leito: XSS }, HOJE));
});

test('Pendência manual: validação (texto, repetição, duração com as regras do protocolo)', () => {
  const ok = lerNovaPend({ texto: '  Ver K+  ', cat: 'Exame', prazo: '', rep: '2', dur: '' }, HOJE);
  assert.equal(ok.pend.texto, 'Ver K+');
  assert.equal(ok.pend.due, HOJE);
  assert.equal(ok.pend.rep, 2);
  assert.equal(ok.pend.origem, 'manual');
  assert.equal(ok.pend.estadoExame, 'solicitado');
  assert.match(lerNovaPend({ texto: ' ', cat: 'Outro' }, HOJE).erro, /Escreva/);
  assert.match(lerNovaPend({ texto: 'a', cat: 'Nada' }, HOJE).erro, /categoria/);
  assert.match(lerNovaPend({ texto: 'a', cat: 'Outro', rep: '-1' }, HOJE).erro, /Repetir/);
  assert.match(lerNovaPend({ texto: 'a', cat: 'Outro', dur: '7 dias' }, HOJE).erro, /Duração inválida/);
  const d = lerNovaPend({ texto: 'ATB', cat: 'Medicação', prazo: '2026-11-09', dur: '7d' }, HOJE).pend.dur;
  assert.deepEqual(d, { total: 7, unidade: 'dias', inicio: '2026-11-09' });
  assert.equal(lerNovaPend({ texto: 'S', cat: 'Medicação', dur: '24h' }, HOJE).pend.dur.inicio, `${HOJE}T08:00`);
  assert.deepEqual(lerNovaPend({ texto: 'C', cat: 'Medicação', dur: '2doses@1' }, HOJE).pend.dur.doses, []);
});

test('Restaurar: ensaio aceita backup bom e recusa backup estruturado que quebraria a tela', () => {
  const bom = comSeed();
  assert.equal(ensaiarRestauracao(exportarJSON(bom), HOJE).pac.length, 3);
  const quebra = { leito: '9', igDays: 29 * 7 + 5, igRef: HOJE, dxs: [{ dx: 'rpmo', mods: {} }], alertasFeitos: [{ id: 'corticoide', data: 5 }] };
  const erroOrig = console.error;
  console.error = () => {};
  try {
    assert.throws(() => ensaiarRestauracao(JSON.stringify({ v: 2, pac: [quebra] }), HOJE), { message: 'Backup inválido' });
    assert.throws(() => ensaiarRestauracao(JSON.stringify({ v: 2, pac: [null] }), HOJE), { message: 'Backup inválido' });
  } finally { console.error = erroOrig; }
});

// Formulário falso do editor de Protocolos (sem DOM).
function formFalso(tipo, dx = '') {
  const erros = { innerHTML: '' }, marca = { hidden: true };
  return { dataset: { tipo, dx }, erros, marca, querySelector: (s) => (s === '.erros' ? erros : marca) };
}

test('Protocolos: rascunho não salvo sobrevive ao redesenho, com marca "não salvo"; salvar limpa', () => {
  limparRascunhos();
  let estado = comSeed();
  const api = { get estado() { return estado; }, atualizar: (fn) => { estado = fn(estado); return true; }, avisar: () => {} };
  const form = formFalso('regras');
  acoesProt['prot-validar']({}, { form, value: 'linha | rascunho' }, api);
  assert.equal(form.marca.hidden, false);
  assert.ok(temRascunho('regras'));
  let html = htmlProtocolos(dados(estado));
  assert.match(html, /linha \| rascunho<\/textarea>/);
  assert.match(html, /<span class="nao-salvo">● não salvo<\/span>/);
  // rascunho de protocolo de diagnóstico: seção aberta e marca no resumo
  acoesProt['prot-validar']({}, { form: formFalso('prot', 'dmg'), value: 'Novo | Exame | 0 | 0' }, api);
  html = htmlProtocolos(dados(estado));
  assert.match(html, /<details class="prot-dx" open>\s*<summary data-act="prot-secao" data-dx="dmg">.*não salvo/);
  // salvar regras limpa só o rascunho delas
  acoesProt['prot-salvar']({}, { dataset: { tipo: 'regras', dx: '' }, elements: { texto: { value: 'linha | rascunho' } } }, api);
  assert.equal(estado.regrasServico, 'linha | rascunho');
  assert.ok(!temRascunho('regras'));
  assert.ok(temRascunho('prot', 'dmg'));
  // voltar ao texto gravado desfaz o rascunho
  acoesProt['prot-validar']({}, { form: formFalso('prot', 'dmg'), value: estado.prot.dmg }, api);
  assert.ok(!temRascunho('prot', 'dmg'));
  limparRascunhos();
});

test('Protocolos: se a gravação falhar, o rascunho continua na tela', () => {
  limparRascunhos();
  const estado = comSeed();
  const api = { estado, atualizar: () => false, avisar: () => {} };
  acoesProt['prot-salvar']({}, { dataset: { tipo: 'faixas', dx: '' }, elements: { texto: { value: 'faixa nova' } } }, api);
  assert.ok(temRascunho('faixas'));
  assert.match(htmlProtocolos(dados(estado)), /faixa nova<\/textarea>/);
  limparRascunhos();
});

test('Pendência manual: falha ao gravar mantém a folha aberta', () => {
  const estado = comSeed();
  let fechou = false;
  const avisos = [];
  const api = { estado, hoje: HOJE, atualizar: () => false, fecharFolha: () => { fechou = true; }, avisar: (m) => avisos.push(m) };
  const form = { dataset: { id: estado.pac[0].id }, elements: { texto: { value: 'Ver K' }, cat: { value: 'Exame' }, prazo: { value: HOJE }, rep: { value: '0' }, dur: { value: '' } } };
  acoesPend['pend-nova-salvar']({}, form, api);
  assert.equal(fechou, false);
  assert.deepEqual(avisos, []);
  api.atualizar = () => true;
  acoesPend['pend-nova-salvar']({}, form, api);
  assert.equal(fechou, true);
  assert.match(avisos[0], /Pendência adicionada/);
});
