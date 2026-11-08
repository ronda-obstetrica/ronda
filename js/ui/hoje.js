// Aba Hoje: alertas vermelhos/amarelos de todos os leitos e pendências agrupadas por situação.
// As ações (feito, aguardando, dose, virar pendência) são as mesmas do Censo, pelos mesmos data-act.
import { esc } from './util.js';
import { htmlPend, prefixoAlerta } from './cartao.js';
import { acoes as acoesCenso, htmlBannerErros } from './censo.js';
import { ordenarPacientes } from '../nucleo/estado.js';
import { avaliarAlertas, ordenarAlertas } from '../nucleo/alertas.js';
import { classificarHoje } from '../nucleo/pendencias.js';

const GRUPOS = [
  ['atrasadas', 'Atrasadas', 'atrasada'],
  ['hoje', 'Hoje', 'hoje'],
  ['aguardando', 'Aguardando resultado', 'aguardando'],
  ['amanha', 'Amanhã', 'amanha'],
  ['concluidasHoje', 'Concluídas hoje', 'feita'],
];

// Alertas ativos (vermelho/amarelo) de todos os leitos, já ordenados, cada um com sua paciente.
export function alertasDeTodos(estado, hoje, ctx) {
  const todos = ordenarPacientes(estado.pac).flatMap((pac) => avaliarAlertas(pac, hoje, ctx.regras)
    .filter((a) => a.nivel === 'vermelho' || a.nivel === 'amarelo')
    .map((a) => ({ ...a, pac })));
  return ordenarAlertas(todos);
}

function htmlAlertaHoje(a) {
  const d = `data-id="${esc(a.pac.id)}" data-regra="${esc(a.regraId)}"`;
  return `<li class="alerta ${esc(a.nivel)}">
    <p><b class="pend-leito">Leito ${esc(a.pac.leito)}</b> <span class="prefixo">${prefixoAlerta(a)}</span> ${esc(a.msg)}</p>
    ${a.fonte ? `<p class="fonte">Fonte: ${esc(a.fonte)}</p>` : ''}
    <div class="acoes-linha">
      <button type="button" class="sec" data-act="alerta-feito" ${d}>Feito</button>
      <button type="button" class="sec" data-act="alerta-pend" ${d}>Virar pendência</button>
    </div>
  </li>`;
}

export function htmlHoje({ estado, ctx, hoje }, agora = new Date()) {
  const alertas = alertasDeTodos(estado, hoje, ctx);
  const pacs = ordenarPacientes(estado.pac);
  const porGrupo = Object.fromEntries(GRUPOS.map(([k]) => [k, []]));
  for (const pac of pacs) {
    const cl = classificarHoje(pac, hoje);
    for (const [k] of GRUPOS) for (const p of cl[k]) porGrupo[k].push([pac, p]);
  }
  // Atrasadas: as mais antigas primeiro (ordem estável por leito em caso de empate).
  porGrupo.atrasadas.sort((x, y) => y[1].diasAtraso - x[1].diasAtraso);
  const grupos = GRUPOS.filter(([k]) => porGrupo[k].length).map(([k, titulo, tipo]) => `<section class="bloco grupo-hoje grupo-${esc(k)}">
      <h3>${esc(titulo)} <span class="contagem">${porGrupo[k].length}</span></h3>
      <ul class="pends">${porGrupo[k].map(([pac, p]) => htmlPend(pac, p, tipo, agora, true)).join('')}</ul>
    </section>`).join('');
  return `${htmlBannerErros(ctx)}
    <h1 class="titulo-aba">Hoje</h1>
    <section class="bloco"><h3>Alertas <span class="contagem">${alertas.length}</span></h3>
      ${alertas.length ? `<ul class="alertas">${alertas.map(htmlAlertaHoje).join('')}</ul>` : '<p class="vazio-linha">Nenhum alerta ativo.</p>'}
    </section>
    ${grupos || '<p class="vazio">Nenhuma pendência para hoje ou amanhã.</p>'}`;
}

export function render(raiz, dados) {
  raiz.innerHTML = htmlHoje(dados);
}

const REUSO = ['alerta-feito', 'alerta-pend', 'pend-feito', 'pend-desfazer', 'pend-aguardando', 'pend-dose'];
export const acoes = Object.fromEntries(REUSO.map((k) => [k, acoesCenso[k]]));
