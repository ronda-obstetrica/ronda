// Pendência manual ("+ pendência" no cartão): folha com texto, categoria, prazo, repetição e duração.
// HTML e validação puros (testados no Node); DOM só dentro das ações.
import { esc, campoLivre, acharPac, mudarPac } from './util.js';
import { cortar } from '../nucleo/estado.js';
import { CATEGORIAS, novaPendencia, chavePend, lerDuracao, inicioDur } from '../nucleo/pendencias.js';

export const LIMITE_TEXTO_PEND = 120;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function htmlNovaPend(pac, hoje) {
  const ops = CATEGORIAS.map((c) => `<option value="${esc(c)}"${c === 'Outro' ? ' selected' : ''}>${esc(c)}</option>`).join('');
  return `<form data-submit="pend-nova-salvar" data-id="${esc(pac.id)}" novalidate>
    <h2>Nova pendência</h2>
    <p class="nota">Leito ${esc(pac.leito)}</p>
    ${campoLivre({ nome: 'texto', rotulo: 'O que fazer *', max: LIMITE_TEXTO_PEND })}
    <div class="linha2">
      <label class="campo">Categoria<select name="cat">${ops}</select></label>
      <label class="campo">Prazo<input type="date" name="prazo" value="${esc(hoje)}"></label>
    </div>
    <div class="linha2">
      <label class="campo">Repetir a cada N dias (0 = não)<input type="number" name="rep" inputmode="numeric" min="0" max="365" value="0"></label>
      <label class="campo">Duração (opcional)<input name="dur" autocomplete="off" placeholder="7d, 24h, 2doses@1"></label>
    </div>
    <div class="acoes-form">
      <button type="button" class="sec" data-act="fechar-folha">Cancelar</button>
      <button type="submit" class="primario">Adicionar</button>
    </div>
  </form>`;
}

// Valida os campos e devolve { pend } ou { erro }. Mesmas regras de duração do protocolo.
export function lerNovaPend({ texto, cat, prazo, rep, dur }, hoje) {
  const t = cortar(texto, LIMITE_TEXTO_PEND);
  if (!t) return { erro: 'Escreva o que fazer.' };
  if (!CATEGORIAS.includes(cat)) return { erro: 'Escolha uma categoria.' };
  const due = String(prazo ?? '').trim() || hoje;
  if (!RE_DATA.test(due)) return { erro: 'Prazo inválido.' };
  const repTxt = String(rep ?? '').trim() || '0';
  if (!/^\d+$/.test(repTxt) || Number(repTxt) > 365) return { erro: 'Repetir: use um número inteiro de 0 a 365.' };
  const durTxt = String(dur ?? '').trim();
  let d = null;
  if (durTxt) {
    d = lerDuracao(durTxt);
    if (!d) return { erro: `Duração inválida: "${durTxt}" (use 7d, 24h ou 2doses@1).` };
  }
  return {
    pend: novaPendencia({ texto: t, cat, due, rep: Number(repTxt), origem: 'manual', dur: d ? inicioDur(d, due) : null }),
  };
}

export const acoes = {
  'pend-nova': (ev, el, api) => {
    const pac = acharPac(api.estado, el.dataset.id);
    if (pac) api.abrirFolha(htmlNovaPend(pac, api.hoje));
  },
  'pend-nova-salvar': (ev, form, api) => {
    const pac = acharPac(api.estado, form.dataset.id);
    if (!pac) { api.fecharFolha(); return; }
    const el = form.elements;
    const r = lerNovaPend({ texto: el.texto.value, cat: el.cat.value, prazo: el.prazo.value, rep: el.rep.value, dur: el.dur.value }, api.hoje);
    if (r.erro) { api.avisar(r.erro); return; }
    const k = chavePend(r.pend);
    if (pac.pend.some((p) => !p.done && chavePend(p) === k)) { api.avisar('Essa pendência já está aberta neste leito.'); return; }
    const ok = api.atualizar(mudarPac(pac.id, (p) => ({ ...p, pend: [...p.pend, r.pend] })));
    api.fecharFolha();
    if (ok) api.avisar(`Pendência adicionada ao leito ${pac.leito}.`);
  },
};
