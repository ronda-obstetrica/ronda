// Pendência manual ("+ pendência" no cartão): folha com texto, categoria, prazo, repetição e duração.
// HTML e validação puros (testados no Node); DOM só dentro das ações.
import { esc, campoLivre, acharPac, mudarPac } from './util.js';
import { cortar } from '../nucleo/estado.js';
import { CATEGORIAS, novaPendencia, chavePend, lerDuracao, inicioDur, interpretarPendencias } from '../nucleo/pendencias.js';
import { addDias } from '../nucleo/datas.js';

export const LIMITE_TEXTO_PEND = 120;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function htmlNovaPend(pac, hoje) {
  const ops = CATEGORIAS.map((c) => `<option value="${esc(c)}"${c === 'Outro' ? ' selected' : ''}>${esc(c)}</option>`).join('');
  return `<form data-submit="pend-nova-salvar" data-id="${esc(pac.id)}" novalidate>
    <h2>Nova pendência</h2>
    <p class="nota">Leito ${esc(pac.leito)}</p>
    <div class="rapido">
      <label class="campo">Escreva e eu agendo<input name="rapido" maxlength="160" autocomplete="off" placeholder="rotina infecciosa a cada 48h, USG semanal" data-input="pend-rapido"></label>
      <p class="nota rapido-previa" aria-live="polite">Separe várias com vírgula. Entendo “a cada 48h”, “semanal”, “diário” e “amanhã”.</p>
      <button type="button" class="primario" data-act="pend-rapida-salvar" data-id="${esc(pac.id)}">Adicionar</button>
    </div>
    <p class="nota">Ou preencha manualmente:</p>
    ${campoLivre({ nome: 'texto', rotulo: 'O que fazer *', max: LIMITE_TEXTO_PEND })}
    <div class="linha2">
      <label class="campo">Categoria<select name="cat">${ops}</select></label>
      <label class="campo">Prazo<input type="date" name="prazo" value="${esc(hoje)}"></label>
    </div>
    <div class="linha2">
      <label class="campo">Repetir a cada N dias (0 = não)<input type="number" name="rep" inputmode="numeric" min="0" max="365" value="0"></label>
      <label class="campo">Duração (opcional)<input name="dur" autocomplete="off" placeholder="7d, 24h, 2doses@1"></label>
    </div>
    <div class="acoes-linha" role="group" aria-label="Repetição rápida">
      <button type="button" class="sec" data-act="pend-rep" data-n="0">Não repete</button>
      <button type="button" class="sec" data-act="pend-rep" data-n="1">Todo dia</button>
      <button type="button" class="sec" data-act="pend-rep" data-n="2">A cada 48h</button>
      <button type="button" class="sec" data-act="pend-rep" data-n="3">A cada 72h</button>
      <button type="button" class="sec" data-act="pend-rep" data-n="7">Semanal</button>
      <button type="button" class="sec" data-act="pend-rep" data-n="14">Quinzenal</button>
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

// Cria as pendências escritas em texto livre (várias de uma vez), já com repetição. Não duplica as abertas.
function adicionarRapidas(pac, texto, api) {
  const itens = interpretarPendencias(texto);
  if (!itens.length) { api.avisar('Escreva a pendência primeiro.'); return; }
  const abertas = [...pac.pend];
  const novas = [];
  let repetidas = 0;
  for (const it of itens) {
    const p = novaPendencia({ texto: cortar(it.texto, LIMITE_TEXTO_PEND), cat: it.cat, due: addDias(api.hoje, it.dias), rep: it.rep, origem: 'manual' });
    if (abertas.some((x) => !x.done && chavePend(x) === chavePend(p))) { repetidas++; continue; }
    abertas.push(p);
    novas.push(p);
  }
  if (!novas.length) { api.avisar('Essas pendências já estão abertas neste leito.'); return; }
  if (!api.atualizar(mudarPac(pac.id, (p) => ({ ...p, pend: [...p.pend, ...novas] })))) return;
  api.fecharFolha();
  const nome = novas.length === 1 ? '1 pendência adicionada' : `${novas.length} pendências adicionadas`;
  api.avisar(`${nome} ao leito ${pac.leito}.${repetidas ? ` ${repetidas} já ${repetidas === 1 ? 'existia' : 'existiam'}.` : ''}`);
}

export const acoes = {
  'pend-nova': (ev, el, api) => {
    const pac = acharPac(api.estado, el.dataset.id);
    if (pac) api.abrirFolha(htmlNovaPend(pac, api.hoje));
  },
  'pend-rep': (ev, el) => { el.closest('form').elements.rep.value = el.dataset.n; },
  // Prévia do que o texto livre vai criar.
  'pend-rapido': (ev, el) => {
    const previa = el.closest('form').querySelector('.rapido-previa');
    const itens = interpretarPendencias(el.value);
    previa.textContent = itens.length
      ? itens.map((i) => `• ${i.texto} · ${i.cat} · ${i.rep ? `repete a cada ${i.rep} ${i.rep === 1 ? 'dia' : 'dias'}` : 'não repete'} · 1º prazo ${i.dias === 0 ? 'hoje' : i.dias === 1 ? 'amanhã' : `em ${i.dias} dias`}`).join('\n')
      : 'Separe várias com vírgula. Entendo “a cada 48h”, “semanal”, “diário” e “amanhã”.';
    previa.style.whiteSpace = 'pre-line';
  },
  'pend-rapida-salvar': (ev, el, api) => {
    const form = el.closest('form');
    const pac = acharPac(api.estado, el.dataset.id);
    if (pac) adicionarRapidas(pac, form.elements.rapido.value, api);
  },
  'pend-nova-salvar': (ev, form, api) => {
    const pac = acharPac(api.estado, form.dataset.id);
    if (!pac) { api.fecharFolha(); return; }
    const el = form.elements;
    // Enter no campo "Escreva e eu agendo" (com o manual em branco) cria as pendências do texto livre.
    if (el.rapido?.value.trim() && !el.texto.value.trim()) { adicionarRapidas(pac, el.rapido.value, api); return; }
    const r = lerNovaPend({ texto: el.texto.value, cat: el.cat.value, prazo: el.prazo.value, rep: el.rep.value, dur: el.dur.value }, api.hoje);
    if (r.erro) { api.avisar(r.erro); return; }
    const k = chavePend(r.pend);
    if (pac.pend.some((p) => !p.done && chavePend(p) === k)) { api.avisar('Essa pendência já está aberta neste leito.'); return; }
    // Em falha, a folha continua aberta com o que foi digitado (o aviso de erro já está na tela).
    if (!api.atualizar(mudarPac(pac.id, (p) => ({ ...p, pend: [...p.pend, r.pend] })))) return;
    api.fecharFolha();
    api.avisar(`Pendência adicionada ao leito ${pac.leito}.`);
  },
};
