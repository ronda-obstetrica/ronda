// Ficha por leito para impressão / "salvar PDF" (sem DOM e sem identificação de paciente).
// Todo texto vindo da usuária passa por esc(); a cor nunca é o único sinal (prefixo de texto).
import { ordenarPacientes } from '../nucleo/estado.js';
import { REGRAS_GLOBAIS } from '../nucleo/regras.js';
import { resumoPaciente } from './comum.js';

export const FONTES_RODAPE = [
  'RBEHG — Pré-eclâmpsia, Protocolo 03, 2023',
  'OPAS/MS/FEBRASGO/SBD — Cuidados obstétricos em DMG no Brasil, 2021',
  'ACOG/SMFM — Committee Opinion 831, 2021',
];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const ddmm = (iso) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;
const dmy = (iso) => `${ddmm(iso)}/${String(iso).slice(0, 4)}`;
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Mesmas palavras do cartão (js/ui/cartao.js), sem importar da UI.
function prefixo(a) {
  if (a.estado === 'feito') return 'FEITO:';
  if (a.estado === 'encerrado') return 'ENCERRADO:';
  return a.nivel === 'vermelho' ? 'AGIR:' : 'ATENÇÃO:';
}

const secao = (titulo, itens, cls = '') => (itens.length
  ? `<section class="f-sec ${cls}"><h4>${esc(titulo)}</h4><ul>${itens.map((i) => `<li>${i}</li>`).join('')}</ul></section>` : '');

function ficha(pac, hoje, ctx, agora) {
  const r = resumoPaciente(pac, hoje, ctx, agora);
  const cab = [`LEITO ${esc(r.leito)}`, r.ig === 'IG não informada' ? esc(r.ig) : `${esc(r.ig)} sem`];
  if (r.dia !== null) cab.push(`D${r.dia}`);
  const sub = [r.idade !== null && r.idade !== '' ? `${esc(r.idade)}a` : null, r.gpca ? esc(r.gpca) : null].filter(Boolean).join(' ');
  const feitos = r.linhaTempo.filter((e) => e.tipo !== 'internacao');
  const recentes = feitos.slice(-5).reverse().map((e) => `${ddmm(e.data)} ${esc(e.texto)}`);
  if (feitos.length > 5) recentes.push(`+${feitos.length - 5} anteriores`);
  const hojeItens = [
    ...r.atrasadas.map((p) => `☐ ${esc(p.texto)} <b>ATRASADO ${p.diasAtraso}d</b>`),
    ...r.hoje.map((p) => `☐ ${esc(p.texto)}`),
  ];
  const aguardando = r.aguardando.map((p) => esc(p.texto) + (p.aguardandoDesde ? ` (desde ${ddmm(p.aguardandoDesde)})` : ''));
  return `<article class="ficha">
<header><h3>${cab.join(' · ')}</h3>${sub ? `<p class="f-sub">${sub}</p>` : ''}</header>
${r.dxExtenso.length ? `<p class="f-dx">${r.dxExtenso.map(esc).join('; ')}</p>` : ''}
${r.alerg ? `<p class="f-alerg"><b>Alergia: ${esc(r.alerg)}</b></p>` : ''}
${secao('Alertas', r.alertas.map((a) => `<b>${prefixo(a)}</b> ${esc(a.msg)}`), 'f-alertas')}
${secao('Hoje', hojeItens)}
${secao('Aguardando resultado', aguardando)}
${secao('Tratamentos', r.tratamentos.map(esc))}
${secao('Fora da faixa', r.foraFaixa.map(esc))}
${secao('Já feito na internação', recentes)}
</article>`;
}

export function htmlFichas(estado, hoje, ctx, { enfermaria = 'Enfermaria de alto risco', pacIds = null, agora = new Date() } = {}) {
  let pacs = ordenarPacientes(estado.pac);
  if (pacIds) pacs = pacs.filter((p) => pacIds.includes(p.id));
  const servico = (ctx.regras ?? []).some((r) => !REGRAS_GLOBAIS.includes(r));
  const fontes = [...FONTES_RODAPE, ...(servico ? ['Regras do serviço'] : [])];
  return `<div class="fichas-folha">
<header class="f-topo"><b>${esc(enfermaria)}</b> · ${dmy(hoje)} · gerado ${hhmm(agora)}</header>
<div class="f-grade">${pacs.map((p) => ficha(p, hoje, ctx, agora)).join('\n')}</div>
<footer class="f-rodape">Sem identificação de paciente (LGPD). Alertas baseados em: ${fontes.map(esc).join('; ')}.</footer>
</div>`;
}
