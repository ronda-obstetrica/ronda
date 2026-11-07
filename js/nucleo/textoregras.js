// Utilitários genéricos para formatos de texto de regras (sem conhecer campos específicos).
import { DIAGNOSTICOS, tokens } from './diagnosticos.js';

export function dividirLinhas(texto) {
  const saida = [];
  String(texto ?? '').split(/\r?\n/).forEach((linha, i) => {
    const t = linha.trim();
    if (!t || t.startsWith('#')) return;
    saida.push({ n: i + 1, campos: t.split('|').map(c => c.trim()) });
  });
  return saida;
}

export function parseAlvo(txt) {
  const s = String(txt ?? '').trim();
  const [parteExige, ...proib] = s.split('!');
  const [dxTxt, ...exige] = parteExige.split('+');
  const dx = dxTxt.trim();
  if (dx && !Object.hasOwn(DIAGNOSTICOS, dx)) return new Error(`diagnóstico desconhecido: "${dx}"`);
  const limpa = l => l.map(x => x.trim()).filter(Boolean);
  return { dx: dx || null, exige: limpa(exige), proibe: limpa(proib) };
}

export function casaAlvo(alvo, dxs) {
  const lista = dxs || [];
  const ok = toks => alvo.exige.every(t => toks.includes(t)) && !alvo.proibe.some(t => toks.includes(t));
  if (alvo.dx === null) {
    if (!alvo.exige.length && !alvo.proibe.length) return true;
    return ok(lista.flatMap(item => tokens(item)));
  }
  return lista.some(item => item.dx === alvo.dx && ok(tokens(item)));
}

export function especificidade(alvo) { return alvo.exige.length + alvo.proibe.length; }

export function grupo(id) { return String(id).split('-').slice(0, 2).join('-'); }

export function mesclarPorId(globais, servico) {
  const itens = servico?.itens || [];
  const desligar = new Set(servico?.desligar || []);
  const porId = new Map(itens.map(i => [i.id, i]));
  const usados = new Set();
  const saida = [];
  for (const g of globais) {
    if (desligar.has(g.id)) continue;
    const s = porId.get(g.id);
    if (!s) { saida.push(g); continue; }
    usados.add(g.id);
    const m = { ...s };
    for (const k of Object.keys(m)) if (m[k] === null && g[k] !== undefined) m[k] = g[k];
    saida.push(m);
  }
  for (const s of itens) if (!usados.has(s.id) && !desligar.has(s.id)) { usados.add(s.id); saida.push(s); }
  return saida;
}
