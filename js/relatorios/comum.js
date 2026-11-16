// Resumo comum por paciente, reutilizado pelo texto do plantão, PDF e planilha.
import { diffDias, fmtIG, igHoje, addDias, hojeISO } from '../nucleo/datas.js';
import { rotuloCurto, rotuloExtenso } from '../nucleo/diagnosticos.js';
import { avaliarAlertas, ordenarAlertas, chaveFeito } from '../nucleo/alertas.js';
import { REGRAS_GLOBAIS } from '../nucleo/regras.js';
import { classificarHoje, progressoTratamento } from '../nucleo/pendencias.js';
import { rotuloMed } from '../nucleo/medicacoes.js';
import { foraDaFaixaHoje, MEDIDAS } from '../nucleo/faixas.js';

const comRes = (txt, res) => txt + (res ? ' — ' + res : '');

function msgDoFeito(id) {
  const chave = chaveFeito(id);
  const regra = chave === 'corticoide'
    ? REGRAS_GLOBAIS.find(r => r.id.startsWith('corticoide'))
    : REGRAS_GLOBAIS.find(r => r.id === chave);
  return regra ? regra.msg : id;
}

function fimDoTratamento(dur) {
  if (dur.unidade === 'dias') return addDias(dur.inicio, dur.total);
  if (dur.unidade === 'horas') {
    const [d, h = '0:0'] = dur.inicio.split('T');
    const [y, mo, dia] = d.split('-').map(Number);
    const [hh, mm] = h.split(':').map(Number);
    return hojeISO(new Date(new Date(y, mo - 1, dia, hh, mm).getTime() + dur.total * 3600000));
  }
  const doses = dur.doses ?? [];
  return doses[doses.length - 1] ?? dur.inicio;
}

// `agora` (opcional): inclui tratamentos já terminados e ainda abertos.
export function linhaDoTempo(pac, agora) {
  const e = [];
  if (pac.int) e.push({ data: pac.int, texto: 'Internação', tipo: 'internacao' });
  for (const p of pac.pend ?? []) {
    if (p.done) e.push({ data: p.doneAt, texto: comRes(p.texto, p.res), tipo: 'pendencia' });
  }
  for (const f of pac.alertasFeitos ?? []) e.push({ data: f.data, texto: comRes(msgDoFeito(f.id), f.res), tipo: 'alerta' });
  if (agora) {
    for (const p of pac.pend ?? []) {
      if (p.done || !p.dur) continue;
      const pr = progressoTratamento(p, agora);
      if (pr?.terminado) e.push({ data: fimDoTratamento(p.dur), texto: p.texto + ' concluído', tipo: 'tratamento' });
    }
  }
  return e.map((x, i) => ({ x, i }))
    .sort((a, b) => (a.x.data < b.x.data ? -1 : a.x.data > b.x.data ? 1 : a.i - b.i))
    .map(o => o.x);
}

const fmtValor = v => (v && typeof v === 'object' ? `${v.s}x${v.d}` : String(v));

export function resumoPaciente(pac, hoje, ctx, agora = new Date()) {
  const ig = igHoje(pac, hoje);
  const cl = classificarHoje(pac, hoje);
  const nomes = Object.fromEntries(MEDIDAS.map(m => [m.id, m.nome]));
  return {
    leito: pac.leito,
    ig: ig === null ? 'IG não informada' : fmtIG(ig),
    dia: pac.int ? diffDias(pac.int, hoje) + 1 : null,
    idade: pac.idade ?? null,
    gpca: pac.par || null,
    dxCurto: pac.dxs.map(rotuloCurto),
    dxExtenso: pac.dxs.map(rotuloExtenso),
    alerg: pac.alerg ?? '',
    obs: pac.obs ?? '',
    meds: (pac.meds ?? []).filter(m => !m?.fim).map(m => rotuloMed(m, hoje)),
    prog: pac.prog ?? '',
    alertas: ordenarAlertas(avaliarAlertas(pac, hoje, ctx.regras)),
    hoje: cl.hoje,
    atrasadas: cl.atrasadas,
    aguardando: cl.aguardando,
    tratamentos: pac.pend.filter(p => !p.done && p.dur)
      .map(p => [p.texto, progressoTratamento(p, agora)?.texto].filter(Boolean).join(' ')),
    foraFaixa: foraDaFaixaHoje(pac, hoje, ctx.faixas)
      .map(f => `${nomes[f.registro.medida] ?? f.registro.medida} ${fmtValor(f.registro.valor)}`),
    linhaTempo: linhaDoTempo(pac, agora),
  };
}
