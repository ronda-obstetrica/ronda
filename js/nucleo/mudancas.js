// "O que mudou desde ontem": instantâneo do plantão e diferenças por paciente.
import { tokens, rotuloExtenso } from './diagnosticos.js';
import { avaliarAlertas } from './alertas.js';
import { classificarHoje } from './pendencias.js';
import { foraDaFaixaHoje, MEDIDAS } from './faixas.js';

export function instantaneo(estado, hoje, ctx) {
  const snap = {};
  for (const pac of estado.pac) {
    const alertas = {};
    for (const a of avaliarAlertas(pac, hoje, ctx.regras)) alertas[a.regraId] = a.nivel;
    snap[pac.id] = {
      leito: pac.leito,
      tokens: pac.dxs.flatMap(tokens).sort(),
      alertas,
      resultados: pac.pend.filter(p => p.done && p.res).map(p => p.id),
      foraFaixa: foraDaFaixaHoje(pac, hoje, ctx.faixas).map(f => f.registro.id),
      atrasadas: classificarHoje(pac, hoje).atrasadas.map(p => p.id),
    };
  }
  return snap;
}

const fmtValor = v => (v && typeof v === 'object' ? `${v.s}x${v.d}` : v);

// anterior/atual: instantâneos; estado: estado atual (textos); hoje e ctx: os mesmos usados
// ao gerar `atual`, para recalcular mensagens de alerta. Sem anterior => {}.
export function mudancasDesde(anterior, atual, estado, hoje, ctx) {
  if (!anterior) return {};
  const saida = {};
  for (const pacId of Object.keys(atual)) {
    const pac = estado.pac.find(p => p.id === pacId);
    if (!pac) continue;
    const antes = anterior[pacId];
    const agora = atual[pacId];
    const frases = [];
    if (!antes) { saida[pacId] = ['Nova paciente']; continue; }

    const tAntes = new Set(antes.tokens);
    const uniaoMudou = agora.tokens.join('\0') !== [...antes.tokens].sort().join('\0');
    if (uniaoMudou) {
      let itens = pac.dxs.filter(it => tokens(it).some(t => !tAntes.has(t)));
      if (!itens.length) itens = pac.dxs;
      for (const it of itens) frases.push('Diagnóstico/modificador: ' + rotuloExtenso(it));
    }

    for (const a of avaliarAlertas(pac, hoje, ctx.regras)) {
      const antigo = antes.alertas[a.regraId];
      if (a.nivel === 'cinza') continue;
      if (antigo === undefined || (antigo === 'amarelo' && a.nivel === 'vermelho')) frases.push('Novo alerta: ' + a.msg);
    }

    const novos = (lista, velhos) => lista.filter(id => !velhos.includes(id));
    for (const id of novos(agora.resultados, antes.resultados)) {
      const p = pac.pend.find(x => x.id === id);
      if (p) frases.push('Resultado: ' + p.texto + ' — ' + p.res);
    }
    const nomes = Object.fromEntries(MEDIDAS.map(m => [m.id, m.nome]));
    for (const id of novos(agora.foraFaixa, antes.foraFaixa)) {
      const r = pac.registros.find(x => x.id === id);
      if (r) frases.push('Fora da faixa: ' + (nomes[r.medida] ?? r.medida) + ' ' + fmtValor(r.valor));
    }
    for (const id of novos(agora.atrasadas, antes.atrasadas)) {
      const p = pac.pend.find(x => x.id === id);
      if (p) frases.push('Atrasou: ' + p.texto);
    }
    if (frases.length) saida[pacId] = frases;
  }
  return saida;
}

export function marcarPlantao(estado, hoje, ctx) {
  return { ...estado, ultimoPlantao: { data: hoje, snap: instantaneo(estado, hoje, ctx) } };
}
