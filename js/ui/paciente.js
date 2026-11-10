// Página da paciente: uma tela por leito, deslizando para o anterior/próximo (scroll-snap).
// Reúne cabeçalho, diagnósticos, alertas, medicações, programação, sugestões, pendências, controles e cadastro.
// As ações compartilhadas (modificador, alerta, pendência, registro, alta) vêm de censo.js, pelos mesmos data-act.
// HTML puro no topo; o DOM só é tocado dentro de render() e das ações (importável no Node).
import { esc, campoLivre, comPac, mudarPac } from './util.js';
import { htmlDiagnosticos, htmlAlertas, htmlPendencias, htmlRegistrosHoje, medidasDoPac } from './cartao.js';
import { acoes as acoesCenso } from './censo.js';
import { resumoPaciente } from '../relatorios/comum.js';
import { ordenarPacientes, cortar, normalizarPrevistos, LIMITE_MED, LIMITE_PROG } from '../nucleo/estado.js';
import { progressoTratamento } from '../nucleo/pendencias.js';
import { mudancasDesde, baseComparacao, instantaneo } from '../nucleo/mudancas.js';
import { novaMed, diaMed, rotuloMed, adicionarMed, editarMed, removerMed } from '../nucleo/medicacoes.js';
import { sugestoes, aceitarSugestao, aceitarTodas, dispensarSugestao, restaurarSugestao } from '../nucleo/sugestoes.js';
import { dxDef } from '../nucleo/diagnosticos.js';

// Leito em vista: sobrevive aos redesenhos depois de cada ação. Guardado pelo id da paciente.
let atualId = null;
let atualIndice = 0;

// Abrir a página a partir de uma faixa do Censo, do Hoje ou da Programação começa naquele leito.
export function focar(id) { atualId = id ?? null; }

// Índice do leito em vista; se a paciente sumiu (alta), fica na mesma posição.
export function indiceAtual(pacs, id = atualId, anterior = atualIndice) {
  const i = pacs.findIndex((p) => p.id === id);
  if (i >= 0) return i;
  return Math.max(0, Math.min(anterior, pacs.length - 1));
}

const btn = (act, dados, rotulo, extra = '') => {
  const attrs = Object.entries(dados).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button type="button" data-act="${esc(act)}"${attrs}${extra}>${esc(rotulo)}</button>`;
};

function htmlCabecalho(pac, r) {
  const ig = r.ig === 'IG não informada' ? '<span class="v-ig ig-nada">IG não informada</span>' : `<span class="v-ig">${esc(r.ig)} sem</span>`;
  const info = [
    pac.iniciais ? esc(pac.iniciais) : null,
    r.gpca ? esc(r.gpca) : null,
    r.idade != null ? `${esc(r.idade)}a` : null,
  ].filter(Boolean).join(' · ');
  return `<header class="v-cab">
    <h2 class="v-leito">Leito ${esc(pac.leito)}</h2>
    ${ig}
    ${r.dia != null ? `<span class="v-dia">D${esc(r.dia)}</span>` : ''}
    ${info ? `<span class="v-info">${info}</span>` : ''}
    ${pac.ex ? '<span class="etq-ex">exemplo</span>' : ''}
  </header>
  ${r.alerg ? `<p class="alergia"><strong>⚠ Alergia:</strong> ${esc(r.alerg)}</p>` : ''}`;
}

function htmlMudou(frases) {
  if (!frases?.length) return '';
  return `<details class="bloco mudou" data-k="mudou" open><summary>Mudou desde o último plantão <span class="contagem">${frases.length}</span></summary>
    <ul class="mudou-lista">${frases.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></details>`;
}

// ---------- Medicações ----------

export function htmlMedicacoes(pac, hoje) {
  const itens = (pac.meds ?? []).map((m) => {
    const sit = diaMed(m, hoje)?.situacao;
    const cls = sit === 'ultimo' ? ' med-ultimo' : sit === 'terminou' ? ' med-terminou' : '';
    const d = { id: pac.id, med: m.id };
    return `<li class="med${cls}"><span class="med-txt">${esc(rotuloMed(m, hoje))}</span>
      <span class="acoes-linha">${btn('med-editar', d, 'Editar', ' class="sec"')}${btn('med-remover', d, 'Remover', ` class="sec perigo" aria-label="Remover ${esc(m.texto)}"`)}</span></li>`;
  }).join('');
  return `<section class="bloco"><div class="bloco-cab"><h3>Medicações</h3>${btn('med-nova', { id: pac.id }, '+ Medicação', ' class="sec"')}</div>
    ${itens ? `<ul class="meds">${itens}</ul>` : '<p class="vazio-linha">Nenhuma medicação em curso.</p>'}
  </section>`;
}

export function htmlMedForm(pac, med, hoje) {
  const m = med ?? {};
  return `<form data-submit="med-salvar" data-id="${esc(pac.id)}" data-med="${esc(m.id ?? '')}" novalidate>
    <h2>${med ? 'Editar medicação' : 'Nova medicação'}</h2>
    <p class="nota">Leito ${esc(pac.leito)}</p>
    ${campoLivre({ nome: 'texto', rotulo: 'Medicação *', valor: m.texto ?? '', max: LIMITE_MED })}
    <div class="linha2">
      <label class="campo">Início<input type="date" name="inicio" value="${esc(m.inicio || hoje)}"></label>
      <label class="campo">Dias previstos (opcional)<input type="number" name="previstos" inputmode="numeric" min="1" max="365" value="${esc(m.previstos ?? '')}"></label>
    </div>
    <label class="chip"><input type="checkbox" name="contar"${m.contar === false ? '' : ' checked'}> Contar dias</label>
    <div class="acoes-form">
      <button type="button" class="sec" data-act="fechar-folha">Cancelar</button>
      <button type="submit" class="primario">Salvar</button>
    </div>
  </form>`;
}

// ---------- Programação ----------

export function htmlProgramacaoBloco(pac) {
  const txt = String(pac.prog ?? '').trim();
  return `<section class="bloco"><div class="bloco-cab"><h3>Programação</h3>${btn('prog-editar', { id: pac.id }, txt ? 'Editar' : '+ Programação', ' class="sec"')}</div>
    ${txt ? `<p class="prog-txt">${esc(txt)}</p>` : '<p class="vazio-linha">Sem programação.</p>'}
  </section>`;
}

export function htmlProgForm(pac) {
  return `<form data-submit="prog-salvar" data-id="${esc(pac.id)}" novalidate>
    <h2>Programação</h2>
    <p class="nota">Leito ${esc(pac.leito)}</p>
    ${campoLivre({ nome: 'prog', rotulo: 'Programação', valor: pac.prog ?? '', max: LIMITE_PROG, multilinha: true })}
    <div class="acoes-form">
      <button type="button" class="sec" data-act="fechar-folha">Cancelar</button>
      <button type="submit" class="primario">Salvar</button>
    </div>
  </form>`;
}

// ---------- Sugestões ----------

export function htmlSugestoes(pac, { estado, ctx, hoje }) {
  const lista = sugestoes(pac, estado, hoje, ctx);
  const nDisp = (pac.sugDispensadas ?? []).length;
  if (!lista.length) return nDisp ? `<div class="bloco">${btn('sug-dispensadas', { id: pac.id }, `ver dispensadas (${nDisp})`, ' class="link"')}</div>` : '';
  const itens = lista.map((s) => {
    const d = { id: pac.id, chave: s.chave };
    return `<li class="sug"><span class="sug-txt">${esc(s.texto)} <span class="cat">${esc(s.cat)}</span></span>
      <span class="acoes-linha">${btn('sug-aceitar', d, '+', ` class="sec" aria-label="Adicionar às pendências: ${esc(s.texto)}"`)}${btn('sug-dispensar', d, 'dispensar', ` class="sec" aria-label="Dispensar: ${esc(s.texto)}"`)}</span></li>`;
  }).join('');
  const todas = lista.length > 1 ? btn('sug-todas', { id: pac.id }, 'adicionar todas', ' class="sec"') : '';
  const disp = nDisp ? btn('sug-dispensadas', { id: pac.id }, `ver dispensadas (${nDisp})`, ' class="link"') : '';
  return `<details class="bloco" data-k="sugestoes"><summary>Sugestões (${lista.length})</summary>
    ${todas ? `<div class="bloco-cab">${todas}</div>` : ''}
    <ul class="sugs">${itens}</ul>
    ${disp}
  </details>`;
}

// Rótulo legível de uma chave dispensada: regra pela mensagem, protocolo pelo diagnóstico + texto normalizado.
function rotuloChave(chave, ctx) {
  const [tipo, ...resto] = String(chave).split(':');
  if (tipo === 'regra') return ctx?.regras?.find((r) => r.id === resto.join(':'))?.msg ?? resto.join(':');
  if (tipo === 'prot') {
    const [dx, ...t] = resto;
    return `${dxDef(dx)?.nome ?? dx}: ${t.join(':')}`;
  }
  return String(chave);
}

export function htmlDispensadas(pac, ctx) {
  const itens = (pac.sugDispensadas ?? []).map((c) => `<li class="sug"><span class="sug-txt">${esc(rotuloChave(c, ctx))}</span>
    ${btn('sug-restaurar', { id: pac.id, chave: c }, 'restaurar', ' class="sec"')}</li>`).join('');
  return `<h2>Sugestões dispensadas</h2><p class="nota">Leito ${esc(pac.leito)}</p>
    ${itens ? `<ul class="sugs">${itens}</ul>` : '<p class="vazio-linha">Nenhuma sugestão dispensada.</p>'}
    <div class="acoes-form"><button type="button" class="sec" data-act="fechar-folha" data-foco>Fechar</button></div>`;
}

// ---------- Controles de hoje e tratamentos ----------

// Um campo grande por medida: glicemias com teclado numérico; PA num campo só, no formato 150x95.
function htmlControlesPaciente(pac, hoje, ctx) {
  const medidas = medidasDoPac(pac);
  if (!medidas.length) return '';
  const linhas = medidas.map((m) => {
    const pa = m.id === 'pa';
    const idCampo = `v-${esc(pac.id)}-${esc(m.id)}`;
    return `<form class="v-controle" data-submit="registrar-valor" data-id="${esc(pac.id)}">
      <input type="hidden" name="medida" value="${esc(m.id)}">
      <label for="${idCampo}">${esc(m.nome)}</label>
      <input id="${idCampo}" name="valor" autocomplete="off" enterkeyhint="done"
        inputmode="${pa ? 'text' : 'numeric'}" placeholder="${pa ? '150x95' : '95'}"${pa ? ` aria-describedby="v-dica-pa-${esc(pac.id)}"` : ''}>
      <button type="submit" class="sec">Registrar</button>
    </form>`;
  }).join('');
  const dicaPa = medidas.some((m) => m.id === 'pa') ? `<p class="nota" id="v-dica-pa-${esc(pac.id)}">PA no formato 150x95.</p>` : '';
  return `<details class="bloco" data-k="controles" open><summary>Controles de hoje</summary>
    ${htmlRegistrosHoje(pac, hoje, ctx)}
    <div class="v-controles">${linhas}</div>${dicaPa}
  </details>`;
}

function htmlTratamentos(pac, agora) {
  const itens = pac.pend.filter((p) => !p.done && p.dur).map((p) => {
    const prog = progressoTratamento(p, agora);
    return `<li>${esc(p.texto)}${prog ? ` <span class="prog">${esc(prog.texto)}</span>` : ''}</li>`;
  }).join('');
  return itens ? `<section class="bloco"><h3>Tratamentos</h3><ul class="v-trat">${itens}</ul></section>` : '';
}

export function htmlLeitoPaciente(pac, { estado, hoje, ctx, agora, frases, n, total }) {
  const r = resumoPaciente(pac, hoje, ctx, agora);
  return `<section class="v-leito-tela" id="paciente-${esc(pac.id)}" data-id="${esc(pac.id)}" aria-label="Leito ${esc(pac.leito)}, ${n} de ${total}">
    <div class="cartao v-cartao">
      ${htmlCabecalho(pac, r)}
      ${htmlMudou(frases)}
      <section class="bloco"><h3>Diagnósticos</h3>${htmlDiagnosticos(pac)}</section>
      ${htmlAlertas(pac, r.alertas)}
      ${htmlMedicacoes(pac, hoje)}
      ${htmlProgramacaoBloco(pac)}
      ${htmlSugestoes(pac, { estado, ctx, hoje })}
      ${htmlPendencias(pac, hoje, agora)}
      ${htmlTratamentos(pac, agora)}
      ${htmlControlesPaciente(pac, hoje, ctx)}
      ${r.obs ? `<p class="obs"><b>Obs.:</b> ${esc(r.obs)}</p>` : ''}
      <details class="bloco cadastro" data-k="cadastro"><summary>Cadastro e alta</summary>
        <footer class="cartao-rodape">
          ${btn('editar', { id: pac.id }, 'Editar cadastro', ' class="sec"')}
          ${btn('alta', { id: pac.id }, 'Alta/parto', ' class="sec perigo"')}
        </footer>
      </details>
    </div>
  </section>`;
}

// Frases do "o que mudou" por paciente; vazio quando ainda não há plantão de comparação.
export function mudancasDaPagina(estado, hoje, ctx) {
  const base = baseComparacao(estado, hoje);
  if (!base) return {};
  return mudancasDesde(base, instantaneo(estado, hoje, ctx), estado, hoje, ctx);
}

export function htmlPaciente({ estado, ctx, hoje }, { id = atualId, agora = new Date() } = {}) {
  const pacs = ordenarPacientes(estado.pac);
  const voltar = '<button type="button" class="sec v-lista" data-act="aba" data-aba="censo">‹ Lista</button>';
  if (!pacs.length) {
    return `<div class="v-barra">${voltar}</div>
      <p class="vazio">Nenhuma paciente. Cadastre os leitos para começar.</p>
      <button type="button" class="primario" data-act="novo">+ Paciente</button>`;
  }
  const i = indiceAtual(pacs, id);
  const mud = mudancasDaPagina(estado, hoje, ctx);
  const total = pacs.length;
  const telas = pacs.map((p, k) => htmlLeitoPaciente(p, { estado, hoje, ctx, agora, frases: mud[p.id], n: k + 1, total })).join('');
  return `<div class="visita paciente">
    <div class="v-barra">
      ${voltar}
      <button type="button" class="sec" data-act="paciente-ir" data-dir="-1" aria-label="Leito anterior">‹</button>
      <span class="v-indicador" aria-live="polite">${i + 1} de ${total}</span>
      <button type="button" class="sec" data-act="paciente-ir" data-dir="1" aria-label="Próximo leito">›</button>
    </div>
    <div class="v-trilho" tabindex="-1">${telas}</div>
  </div>`;
}

// ---------- Navegador ----------

function indiceDoTrilho(trilho) {
  return trilho.clientWidth ? Math.round(trilho.scrollLeft / trilho.clientWidth) : 0;
}

function marcarAtual(trilho, i) {
  const telas = trilho.querySelectorAll('.v-leito-tela');
  const tela = telas[i];
  if (!tela) return;
  atualIndice = i;
  atualId = tela.dataset.id;
  const ind = trilho.closest('.paciente')?.querySelector('.v-indicador');
  const txt = `${i + 1} de ${telas.length}`;
  if (ind && ind.textContent !== txt) ind.textContent = txt;
}

export function render(raiz, dados) {
  const pacs = ordenarPacientes(dados.estado.pac);
  const i = pacs.length ? indiceAtual(pacs) : 0;
  if (pacs.length) { atualIndice = i; atualId = pacs[i].id; }
  // Guarda rolagem vertical e seções abertas/fechadas da paciente em vista para o redesenho não pular.
  const antes = raiz.querySelector(`.v-leito-tela[data-id="${CSS.escape(String(atualId))}"]`);
  const y = antes ? window.scrollY : null;
  const abertos = {};
  if (antes) for (const d of antes.querySelectorAll('details[data-k]')) abertos[d.dataset.k] = d.open;
  raiz.innerHTML = htmlPaciente(dados, { id: atualId });
  if (antes) {
    const nova = raiz.querySelector(`.v-leito-tela[data-id="${CSS.escape(String(atualId))}"]`);
    for (const d of nova?.querySelectorAll('details[data-k]') ?? []) if (d.dataset.k in abertos) d.open = abertos[d.dataset.k];
  }
  const trilho = raiz.querySelector('.v-trilho');
  if (!trilho) return;
  // Volta ao leito em vista sem animação (depois de uma ação o HTML é trocado inteiro).
  const alvo = trilho.children[i];
  if (alvo) trilho.scrollLeft = alvo.offsetLeft;
  if (y != null) window.scrollTo(0, y);
  let pendente = false;
  trilho.addEventListener('scroll', () => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => { pendente = false; marcarAtual(trilho, indiceDoTrilho(trilho)); });
  }, { passive: true });
}

const reduzMovimento = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- Ações próprias da página ----------

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

// Lê o formulário de medicação; devolve { campos } ou { erro }.
export function lerMedForm(el, hoje) {
  const texto = cortar(el.texto.value, LIMITE_MED);
  if (!texto) return { erro: 'Escreva a medicação.' };
  const inicio = String(el.inicio.value ?? '').trim() || hoje;
  if (!RE_DATA.test(inicio)) return { erro: 'Data de início inválida.' };
  const prevTxt = String(el.previstos.value ?? '').trim();
  const previstos = prevTxt ? normalizarPrevistos(prevTxt) : null;
  if (prevTxt && previstos === null) return { erro: 'Dias previstos: use um número inteiro de 1 a 365.' };
  return { campos: { texto, inicio, previstos, contar: Boolean(el.contar.checked) } };
}

// adicionarMed/editarMed/removerMed mutam a paciente: trabalham numa cópia, nunca no estado em uso.
const copiaComMeds = (p) => ({ ...p, meds: (p.meds ?? []).map((m) => ({ ...m })) });

export const acoes = {
  ...acoesCenso,
  'paciente-ir': (ev, el) => {
    const trilho = el.closest('.paciente')?.querySelector('.v-trilho');
    if (!trilho) return;
    const total = trilho.children.length;
    // Parte do leito marcado (não da posição da rolagem): toques rápidos seguidos não pulam nem repetem leito.
    const i = Math.max(0, Math.min(total - 1, atualIndice + Number(el.dataset.dir)));
    trilho.scrollTo({ left: trilho.children[i].offsetLeft, behavior: reduzMovimento() ? 'auto' : 'smooth' });
    marcarAtual(trilho, i);
  },

  'med-nova': comPac((pac, el, api) => api.abrirFolha(htmlMedForm(pac, null, api.hoje))),
  'med-editar': comPac((pac, el, api) => {
    const med = (pac.meds ?? []).find((m) => m.id === el.dataset.med);
    if (med) api.abrirFolha(htmlMedForm(pac, med, api.hoje));
  }),
  'med-salvar': comPac((pac, form, api) => {
    const r = lerMedForm(form.elements, api.hoje);
    if (r.erro) { api.avisar(r.erro); return; }
    const medId = form.dataset.med;
    const ok = api.atualizar(mudarPac(pac.id, (p) => {
      const q = copiaComMeds(p);
      return medId ? editarMed(q, medId, r.campos) : adicionarMed(q, novaMed(r.campos));
    }));
    if (!ok) return;
    api.fecharFolha();
    api.avisar(medId ? 'Medicação atualizada.' : `Medicação adicionada ao leito ${pac.leito}.`);
  }),
  'med-remover': comPac((pac, el, api) => {
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm('Remover esta medicação?')) return;
    api.atualizar(mudarPac(pac.id, (p) => removerMed(copiaComMeds(p), el.dataset.med)));
  }),

  'prog-editar': comPac((pac, el, api) => api.abrirFolha(htmlProgForm(pac))),
  'prog-salvar': comPac((pac, form, api) => {
    const prog = cortar(form.elements.prog.value, LIMITE_PROG);
    if (!api.atualizar(mudarPac(pac.id, (p) => ({ ...p, prog })))) return;
    api.fecharFolha();
    api.avisar('Programação salva.');
  }),

  // A sugestão é recalculada na hora e achada pela chave: nada de sugestão serializada no DOM.
  'sug-aceitar': comPac((pac, el, api) => {
    const sug = sugestoes(pac, api.estado, api.hoje, api.ctx).find((s) => s.chave === el.dataset.chave);
    if (!sug) return;
    if (api.atualizar(mudarPac(pac.id, (p) => aceitarSugestao(p, sug, api.hoje)))) api.avisar('Virou pendência.');
  }),
  'sug-todas': comPac((pac, el, api) => {
    const lista = sugestoes(pac, api.estado, api.hoje, api.ctx);
    if (!lista.length) return;
    if (api.atualizar(mudarPac(pac.id, (p) => aceitarTodas(p, lista, api.hoje)))) api.avisar(`${lista.length} ${lista.length === 1 ? 'pendência adicionada' : 'pendências adicionadas'}.`);
  }),
  'sug-dispensar': comPac((pac, el, api) => { api.atualizar(mudarPac(pac.id, (p) => dispensarSugestao(p, el.dataset.chave))); }),
  'sug-dispensadas': comPac((pac, el, api) => api.abrirFolha(htmlDispensadas(pac, api.ctx))),
  'sug-restaurar': comPac((pac, el, api) => {
    if (api.atualizar(mudarPac(pac.id, (p) => restaurarSugestao(p, el.dataset.chave)))) api.fecharFolha();
  }),
};
