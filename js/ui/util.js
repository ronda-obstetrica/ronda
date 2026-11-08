// Utilitários da interface: escape de HTML, campos de texto livre com contador e aviso de LGPD.
// Sem acesso ao DOM no topo do módulo (importável no Node).

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(txt) {
  return String(txt ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

// Já escapado: as datas vêm do estado, que pode ter sido restaurado de um backup.
export const ddmm = (iso) => (iso ? esc(`${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`) : '');

export const AVISO_LGPD = 'Não escreva nomes ou dados que identifiquem a paciente.';

export const acharPac = (estado, id) => estado.pac.find((p) => p.id === id);

// Mutação para api.atualizar que altera só uma paciente.
export const mudarPac = (id, fn) => (estado) => ({
  ...estado,
  pac: estado.pac.map((p) => (p.id === id ? fn(p) : p)),
});

// Avalia ModDef.visivelSe contra os modificadores atuais do diagnóstico.
export function modVisivel(mod, mods = {}) {
  if (!mod.visivelSe) return true;
  return Object.entries(mod.visivelSe).every(([k, v]) => mods[k] === v);
}

// Campo de texto livre limitado: maxlength, contador "N/max" e aviso de LGPD.
export function campoLivre({ nome, rotulo, valor = '', max, multilinha = false }) {
  const v = String(valor ?? '').slice(0, max);
  const id = `campo-${nome}`;
  const campo = multilinha
    ? `<textarea id="${id}" name="${esc(nome)}" maxlength="${max}" rows="3" data-contador>${esc(v)}</textarea>`
    : `<input id="${id}" name="${esc(nome)}" maxlength="${max}" autocomplete="off" value="${esc(v)}" data-contador>`;
  return `<div class="campo campo-livre">
    <label for="${id}">${esc(rotulo)}</label>
    ${campo}
    <div class="campo-rodape"><span class="aviso-lgpd">${esc(AVISO_LGPD)}</span><span class="contador" aria-live="polite">${v.length}/${max}</span></div>
  </div>`;
}

// Atualiza o contador de um campo criado por campoLivre (chamado no evento input).
export function atualizarContador(el) {
  const cont = el.closest('.campo')?.querySelector('.contador');
  if (cont) cont.textContent = `${el.value.length}/${el.maxLength}`;
}
