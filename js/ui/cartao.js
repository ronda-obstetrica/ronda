// HTML do cartão de um leito (Censo). Puro: recebe dados, devolve string com textos escapados.
import { esc, ddmm, modVisivel } from './util.js';
import { DIAGNOSTICOS } from '../nucleo/diagnosticos.js';
import { resumoPaciente } from '../relatorios/comum.js';
import { MEDIDAS, MEDIDAS_POR_DX, avaliarRegistro } from '../nucleo/faixas.js';
import { classificarHoje, progressoTratamento } from '../nucleo/pendencias.js';

export const NOME_ESCOLHA = { tipo: 'Tipo', grau: 'Grau' };

// Cor nunca é o único sinal: todo alerta leva um prefixo de texto.
export function prefixoAlerta(a) {
  if (a.estado === 'feito') return '✓ FEITO:';
  if (a.estado === 'encerrado') return '– ENCERRADO:';
  return a.nivel === 'vermelho' ? '▲ AGIR:' : '● ATENÇÃO:';
}

// rotulo é texto puro (escapado aqui); extra são atributos já montados com esc().
const btn = (act, dados, rotulo, extra = '') => {
  const attrs = Object.entries(dados).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button type="button" data-act="${esc(act)}"${attrs}${extra}>${esc(rotulo)}</button>`;
};

function htmlCabecalho(pac, r) {
  const ig = r.ig === 'IG não informada' ? '<span class="ig ig-nada">IG não informada</span>' : `<span class="ig">${esc(r.ig)} sem</span>`;
  const info = [
    r.dia != null ? `D${r.dia}` : null,
    r.idade != null ? `${esc(r.idade)}a` : null,
    r.gpca ? esc(r.gpca) : null,
  ].filter(Boolean).join(' · ');
  return `<header class="cartao-cab">
    <h2 class="leito">Leito ${esc(pac.leito)}</h2>
    ${ig}
    ${info ? `<span class="cab-info">${info}</span>` : ''}
    ${pac.ex ? '<span class="etq-ex">exemplo</span>' : ''}
  </header>`;
}

export function htmlDiagnosticos(pac) {
  const blocos = pac.dxs.map((item, i) => {
    const def = DIAGNOSTICOS[item.dx];
    const mods = item.mods || {};
    const botoes = (def?.mods ?? []).filter((m) => modVisivel(m, mods)).map((m) => {
      const dados = { id: pac.id, i, mod: m.id };
      if (m.tipo === 'escolha') {
        const opc = m.opcoes.find((o) => o.id === mods[m.id]);
        const rot = opc ? opc.curto : `${NOME_ESCOLHA[m.id] ?? m.id}?`;
        return btn('mod', dados, `${rot} ▾`, ` class="mod mod-escolha${opc ? ' ligado' : ''}" aria-haspopup="dialog" aria-label="${esc(NOME_ESCOLHA[m.id] ?? m.id)}: ${opc ? esc(opc.extenso) : 'não definido'}"`);
      }
      const on = mods[m.id] === true;
      return btn('mod', dados, `${on ? '✓ ' : '+ '}${m.curto}`, ` class="mod${on ? ' ligado' : ''}" aria-pressed="${on}"`);
    }).join('');
    return `<div class="dx"><span class="dx-nome">${esc(def?.nome ?? item.dx)}</span>${botoes}</div>`;
  }).join('');
  return `<div class="dxs">${blocos}</div>`;
}

export function htmlAlertas(pac, alertas) {
  if (!alertas.length) return '';
  const varios = alertas.length > 1;
  const itens = alertas.map((a) => {
    const d = { id: pac.id, regra: a.regraId };
    const acoes = a.estado === 'feito'
      ? btn('alerta-desfazer', d, 'Desfazer', ' class="sec"')
      : btn('alerta-feito', d, 'Feito', ' class="sec"') + btn('alerta-pend', d, 'Virar pendência', ' class="sec"');
    return `<li class="alerta ${esc(a.nivel)}">
      <p><span class="prefixo">${prefixoAlerta(a)}</span> ${esc(a.msg)}${a.principal && varios ? ' <span class="tag">principal</span>' : ''}</p>
      ${a.fonte ? `<p class="fonte">Fonte: ${esc(a.fonte)}</p>` : ''}
      <div class="acoes-linha">${acoes}</div>
    </li>`;
  }).join('');
  return `<section class="bloco"><h3>Alertas</h3><ul class="alertas">${itens}</ul></section>`;
}

const fmtValor = (v) => (v && typeof v === 'object' ? `${v.s}x${v.d}` : String(v));

export function medidasDoPac(pac) {
  return MEDIDAS.filter((m) => pac.dxs.some((d) => (MEDIDAS_POR_DX[d.dx] ?? []).includes(m.id)));
}

// Valores registrados hoje, com marca de fora da faixa e botão de apagar (Censo e Visita).
export function htmlRegistrosHoje(pac, hoje, ctx) {
  const nomes = Object.fromEntries(MEDIDAS.map((m) => [m.id, m.nome]));
  const regs = (pac.registros ?? []).filter((r) => r.data === hoje);
  const lista = regs.map((reg) => {
    const al = avaliarRegistro(pac, reg, ctx.faixas);
    const nivel = al.some((a) => a.nivel === 'vermelho') ? 'vermelho' : al.length ? 'amarelo' : '';
    const fora = al.length ? ` <span class="fora">⚠ FORA DA FAIXA: ${esc(al.map((a) => a.msg).join('; '))}</span>` : '';
    return `<li class="registro ${nivel}"><span><b>${esc(nomes[reg.medida] ?? reg.medida)}</b> ${esc(fmtValor(reg.valor))}${fora}</span>
      ${btn('valor-apagar', { id: pac.id, reg: reg.id }, '×', ` class="icone" aria-label="Apagar valor ${esc(fmtValor(reg.valor))}"`)}</li>`;
  }).join('');
  return lista ? `<ul class="registros">${lista}</ul>` : '<p class="vazio-linha">Nenhum valor hoje.</p>';
}

function htmlControles(pac, hoje, ctx) {
  const medidas = medidasDoPac(pac);
  if (!medidas.length) return '';
  const pa = medidas[0].id === 'pa';
  const opcoes = medidas.map((m) => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join('');
  return `<section class="bloco"><h3>Controles de hoje</h3>
    ${htmlRegistrosHoje(pac, hoje, ctx)}
    <form class="controle" data-submit="registrar-valor" data-id="${esc(pac.id)}">
      <select name="medida" data-input="medida-sel" aria-label="Medida">${opcoes}</select>
      <input name="valor" autocomplete="off" aria-label="Valor" inputmode="${pa ? 'text' : 'decimal'}" placeholder="${pa ? '150x95' : '95'}">
      <button type="submit" class="sec">Registrar</button>
    </form>
  </section>`;
}

// comLeito: na aba Hoje, cada item mostra o leito.
export function htmlPend(pac, p, tipo, agora, comLeito = false) {
  const d = { id: pac.id, pend: p.id };
  const leito = comLeito ? `<b class="pend-leito">Leito ${esc(pac.leito)}</b> ` : '';
  const prog = progressoTratamento(p, agora);
  let prefixo = '';
  if (tipo === 'atrasada') prefixo = `<span class="prefixo">ATRASADA ${p.diasAtraso}d:</span> `;
  if (tipo === 'aguardando') prefixo = `<span class="prefixo">AGUARDANDO resultado${p.aguardandoDesde ? ` (desde ${ddmm(p.aguardandoDesde)})` : ''}:</span> `;
  if (tipo === 'feita') {
    return `<li class="pend feita"><span class="check-feito" aria-hidden="true">✓</span>
      <span class="pend-txt">${leito}${esc(p.texto)}${p.res ? ` — ${esc(p.res)}` : ''} <span class="cat">feito ${ddmm(p.doneAt)}</span></span>
      ${btn('pend-desfazer', d, 'Desfazer', ' class="sec"')}</li>`;
  }
  const extras = [];
  if (p.cat === 'Exame' && p.estadoExame !== 'aguardando') extras.push(btn('pend-aguardando', d, 'Aguardando', ' class="sec"'));
  if (prog && p.dur?.unidade === 'doses' && !prog.terminado) extras.push(btn('pend-dose', d, 'Registrar dose', ' class="sec"'));
  return `<li class="pend ${tipo}">
    ${btn('pend-feito', d, '☐', ` class="check" aria-label="Marcar feito: ${esc(p.texto)}"`)}
    <span class="pend-txt">${leito}${prefixo}${esc(p.texto)} <span class="cat">${esc(p.cat)}</span>${prog ? ` <span class="prog">${esc(prog.texto)}</span>` : ''}</span>
    ${extras.length ? `<div class="acoes-linha">${extras.join('')}</div>` : ''}
  </li>`;
}

export function htmlPendencias(pac, hoje, agora) {
  const cl = classificarHoje(pac, hoje);
  const itens = [
    ...cl.atrasadas.map((p) => htmlPend(pac, p, 'atrasada', agora)),
    ...cl.hoje.map((p) => htmlPend(pac, p, 'hoje', agora)),
    ...cl.aguardando.map((p) => htmlPend(pac, p, 'aguardando', agora)),
    ...cl.concluidasHoje.map((p) => htmlPend(pac, p, 'feita', agora)),
  ].join('');
  return `<section class="bloco"><div class="bloco-cab"><h3>Pendências</h3>${btn('pend-nova', { id: pac.id }, '+ pendência', ' class="sec mini"')}</div>
    ${itens ? `<ul class="pends">${itens}</ul>` : '<p class="vazio-linha">Sem pendências para hoje.</p>'}
  </section>`;
}

export function htmlCartao(pac, { hoje, ctx, agora = new Date() }) {
  const r = resumoPaciente(pac, hoje, ctx, agora);
  return `<article class="cartao" id="leito-${esc(pac.id)}">
    ${htmlCabecalho(pac, r)}
    ${htmlDiagnosticos(pac)}
    ${r.alerg ? `<p class="alergia"><strong>⚠ Alergia:</strong> ${esc(r.alerg)}</p>` : ''}
    ${htmlAlertas(pac, r.alertas)}
    ${htmlControles(pac, hoje, ctx)}
    ${htmlPendencias(pac, hoje, agora)}
    ${r.obs ? `<p class="obs"><b>Obs.:</b> ${esc(r.obs)}</p>` : ''}
    <footer class="cartao-rodape">
      ${btn('editar', { id: pac.id }, 'Editar', ' class="sec"')}
      ${btn('abrir-visita', { id: pac.id }, 'Visita', ' class="sec"')}
      ${btn('alta', { id: pac.id }, 'Alta/parto', ' class="sec perigo"')}
    </footer>
  </article>`;
}
