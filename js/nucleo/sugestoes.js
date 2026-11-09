// Sugestões: itens de protocolo e regras por IG que só viram pendência com o toque da usuária.
import { addDias, igHoje } from './datas.js';
import { catDaRegra, chavePend, inicioDur, novaPendencia, parseProtocolo, regraNaJanela } from './pendencias.js';

// Mesma normalização de chavePend (sem a categoria).
const norm = (t) => chavePend({ texto: t, cat: '' }).slice(0, -1);

export const chaveSugProt = (dxId, texto) => `prot:${dxId}:${norm(texto)}`;
export const chaveSugRegra = (regraId) => `regra:${regraId}`;

export function sugestoes(pac, estado, hoje, ctx) {
  const dispensadas = new Set(pac.sugDispensadas ?? []);
  const chavesPend = new Set((pac.pend ?? []).map(chavePend));
  const usadas = new Set((pac.pend ?? []).map((p) => p.sug).filter(Boolean));
  const origens = new Set((pac.pend ?? []).map((p) => p.origem));
  const livre = (chave, texto, cat) => !dispensadas.has(chave) && !usadas.has(chave)
    && !chavesPend.has(chavePend({ texto, cat }));
  const out = [];
  const vistos = new Set();
  for (const { dx } of pac.dxs ?? []) {
    if (vistos.has(dx)) continue;
    vistos.add(dx);
    for (const it of parseProtocolo(estado.prot?.[dx] ?? '').itens) {
      const chave = chaveSugProt(dx, it.texto);
      if (!livre(chave, it.texto, it.cat) || out.some((s) => s.chave === chave)) continue;
      out.push({ chave, texto: it.texto, cat: it.cat, dias: it.dias, rep: it.rep, dur: it.dur, fonte: 'protocolo', dxId: dx });
    }
  }
  const ig = igHoje(pac, hoje);
  for (const r of ctx?.regras ?? []) {
    if (!regraNaJanela(r, pac, ig)) continue;
    const chave = chaveSugRegra(r.id);
    const cat = catDaRegra(r);
    if (!livre(chave, r.msg, cat) || origens.has(r.id)) continue;
    out.push({ chave, texto: r.msg, cat, dias: 0, rep: r.repetir ?? 0, dur: null, fonte: 'regra', regraId: r.id });
  }
  return out;
}

export function aceitarSugestao(pac, sug, hoje) {
  const due = addDias(hoje, sug.dias ?? 0);
  const p = novaPendencia({
    texto: sug.texto, cat: sug.cat, due, rep: sug.rep ?? 0,
    origem: sug.fonte === 'regra' ? sug.regraId : 'protocolo',
    dur: sug.dur ? inicioDur(sug.dur, due) : null,
    sug: sug.chave,
  });
  return { ...pac, pend: [...pac.pend, p] };
}

export function aceitarTodas(pac, lista, hoje) {
  return lista.reduce((acc, s) => aceitarSugestao(acc, s, hoje), pac);
}

export function dispensarSugestao(pac, chave) {
  const d = pac.sugDispensadas ?? [];
  return d.includes(chave) ? pac : { ...pac, sugDispensadas: [...d, chave] };
}

export function restaurarSugestao(pac, chave) {
  return { ...pac, sugDispensadas: (pac.sugDispensadas ?? []).filter((c) => c !== chave) };
}
