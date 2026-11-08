// Aba Censo: um cartão por leito, em ordem natural, com ações por toque.
import { acharPac, mudarPac, ddmm, esc } from './util.js';
import { htmlCartao } from './cartao.js';
import { htmlFeitoAlerta, htmlFeitoPend, htmlEscolha } from './formularios.js';
import { htmlFichas } from '../relatorios/ficha.js';
import { textoPlantao } from '../relatorios/texto.js';
import { imprimirHtml } from './imprimir.js';
import { copiarTexto } from './compartilhar.js';
import { acoes as acoesPend } from './pendform.js';
import { ordenarPacientes, precisaLembrarBackup } from '../nucleo/estado.js';
import { DIAGNOSTICOS, alternarMod } from '../nucleo/diagnosticos.js';
import { avaliarAlertas, desfazerAlertaFeito } from '../nucleo/alertas.js';
import { pendenciaDeAlerta, desfazer, marcarAguardando, registrarDose } from '../nucleo/pendencias.js';
import { registrar, parseValor, avaliarRegistro } from '../nucleo/faixas.js';

export function htmlBannerErros(ctx) {
  const n = (ctx.errosRegras?.length ?? 0) + (ctx.errosFaixas?.length ?? 0);
  if (!n) return '';
  const txt = n === 1 ? '1 linha das regras do serviço com erro — ver Protocolos' : `${n} linhas das regras do serviço com erro — ver Protocolos`;
  return `<button type="button" class="banner banner-erro" data-act="aba" data-aba="protocolos">⚠ ${txt}</button>`;
}

// Lembrete discreto: o iOS pode apagar os dados do site; o backup fica com a usuária.
export function htmlLembreteBackup(estado, hoje) {
  if (!precisaLembrarBackup(estado, hoje)) return '';
  const quando = estado.ultimoBackup ? `Último backup em ${ddmm(estado.ultimoBackup)}.` : 'Nenhum backup feito ainda.';
  return `<div class="banner banner-aviso banner-linha"><span>${quando} Os dados ficam só neste aparelho.</span>
    <button type="button" class="sec mini" data-act="aba" data-aba="dados">Fazer backup</button></div>`;
}

export function htmlCenso({ estado, ctx, hoje }, agora = new Date()) {
  const pacs = ordenarPacientes(estado.pac);
  const backup = htmlLembreteBackup(estado, hoje);
  const exemplos = pacs.some((p) => p.ex)
    ? '<p class="nota">Os leitos marcados como "exemplo" são fictícios. Eles podem ser apagados na aba Dados.</p>' : '';
  const cartoes = pacs.length
    ? pacs.map((p) => htmlCartao(p, { hoje, ctx, agora })).join('')
    : '<p class="vazio">Nenhuma paciente. Toque em "+ Paciente" para cadastrar.</p>';
  return `${htmlBannerErros(ctx)}${backup}
    <div class="barra"><h1 class="titulo-aba">Censo <span class="contagem">${pacs.length} ${pacs.length === 1 ? 'leito' : 'leitos'}</span></h1>
      <button type="button" class="primario" data-act="novo">+ Paciente</button></div>
    ${exemplos}
    <div class="cartoes">${cartoes}</div>`;
}

export function render(raiz, dados) {
  raiz.innerHTML = htmlCenso(dados);
}

const comPac = (fn) => (ev, el, api) => {
  const pac = acharPac(api.estado, el.dataset.id);
  if (pac) fn(pac, el, api, ev);
};

export const acoes = {
  ...acoesPend,
  // Liga/desliga direto; nas escolhas, abre a lista pequena na folha.
  mod: comPac((pac, el, api) => {
    const i = Number(el.dataset.i);
    const item = pac.dxs[i];
    const def = DIAGNOSTICOS[item?.dx]?.mods.find((m) => m.id === el.dataset.mod);
    if (!def) return;
    if (def.tipo === 'escolha') { api.abrirFolha(htmlEscolha(pac, i, def)); return; }
    api.atualizar(mudarPac(pac.id, (p) => ({ ...p, dxs: p.dxs.map((d, j) => (j === i ? alternarMod(d, def.id) : d)) })));
  }),
  'alerta-feito': comPac((pac, el, api) => {
    const alerta = avaliarAlertas(pac, api.hoje, api.ctx.regras).find((a) => a.regraId === el.dataset.regra);
    if (alerta) api.abrirFolha(htmlFeitoAlerta(pac, alerta, api.hoje));
  }),
  'alerta-desfazer': comPac((pac, el, api) => api.atualizar(mudarPac(pac.id, (p) => desfazerAlertaFeito(p, el.dataset.regra)))),
  'alerta-pend': comPac((pac, el, api) => {
    const alerta = avaliarAlertas(pac, api.hoje, api.ctx.regras).find((a) => a.regraId === el.dataset.regra);
    if (!alerta) return;
    const novo = pendenciaDeAlerta(pac, alerta, api.hoje);
    if (novo.pend.length === pac.pend.length) { api.avisar('Esse alerta já está nas pendências.'); return; }
    if (api.atualizar(mudarPac(pac.id, () => novo))) api.avisar('Virou pendência para hoje.');
  }),
  'pend-feito': comPac((pac, el, api) => {
    const pend = pac.pend.find((p) => p.id === el.dataset.pend);
    if (pend) api.abrirFolha(htmlFeitoPend(pac, pend));
  }),
  'pend-desfazer': comPac((pac, el, api) => api.atualizar(mudarPac(pac.id, (p) => desfazer(p, el.dataset.pend)))),
  'pend-aguardando': comPac((pac, el, api) => api.atualizar(mudarPac(pac.id, (p) => marcarAguardando(p, el.dataset.pend, api.hoje)))),
  'pend-dose': comPac((pac, el, api) => api.atualizar(mudarPac(pac.id, (p) => registrarDose(p, el.dataset.pend, api.hoje)))),
  // input no seletor de medida: ajusta teclado e exemplo (PA usa "150x95").
  'medida-sel': (ev, el) => {
    const campo = el.form.elements.valor;
    const pa = el.value === 'pa';
    campo.inputMode = pa ? 'text' : 'decimal';
    campo.placeholder = pa ? '150x95' : '95';
  },
  'registrar-valor': comPac((pac, form, api) => {
    const medida = form.elements.medida.value;
    const valor = parseValor(medida, form.elements.valor.value);
    if (valor instanceof Error) { api.avisar(valor.message); form.elements.valor.focus(); return; }
    const reg = { data: api.hoje, medida, valor };
    const fora = avaliarRegistro(pac, reg, api.ctx.faixas);
    const ok = api.atualizar(mudarPac(pac.id, (p) => registrar(p, reg)));
    if (ok && fora.length) api.avisar(`Fora da faixa: ${fora.map((a) => a.msg).join('; ')}`);
  }),
  'valor-apagar': comPac((pac, el, api) => {
    if (!globalThis.confirm('Apagar este valor?')) return;
    api.atualizar(mudarPac(pac.id, (p) => ({ ...p, registros: (p.registros ?? []).filter((r) => r.id !== el.dataset.reg) })));
  }),
  // Alta/parto: confirmação com ficha/texto antes; a remoção é definitiva.
  alta: comPac((pac, el, api) => api.abrirFolha(htmlAlta(pac))),
  'alta-ficha': comPac((pac, el, api) => imprimirHtml(htmlFichas(api.estado, api.hoje, api.ctx, { pacIds: [pac.id] }))),
  'alta-copiar': comPac(async (pac, el, api) => {
    const so = { ...api.estado, pac: [pac] };
    let ok = false;
    try { ok = await copiarTexto(textoPlantao(so, api.hoje, api.ctx)); } catch (e) { console.error(e); }
    api.avisar(ok ? 'Texto do leito copiado.' : 'Não foi possível copiar o texto.');
  }),
  'alta-remover': comPac((pac, el, api) => {
    if (api.atualizar((e) => ({ ...e, pac: e.pac.filter((p) => p.id !== pac.id) }))) {
      api.fecharFolha();
      api.avisar(`Leito ${pac.leito} removido.`);
    }
  }),
};

export function htmlAlta(pac) {
  const d = `data-id="${esc(pac.id)}"`;
  return `<h2>Remover leito ${esc(pac.leito)} do app?</h2>
    <p class="nota">A remoção é definitiva: os dados deste leito não poderão ser recuperados. Gere a ficha ou copie o texto antes, se precisar.</p>
    <button type="button" class="sec largo" data-act="alta-ficha" ${d}>Gerar ficha antes</button>
    <button type="button" class="sec largo" data-act="alta-copiar" ${d}>Copiar texto antes</button>
    <button type="button" class="sec perigo largo" data-act="alta-remover" ${d}>Remover</button>
    <button type="button" class="sec largo" data-act="fechar-folha" data-foco>Cancelar</button>`;
}
