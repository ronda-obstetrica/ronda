// Compartilhar arquivo, copiar texto e carregar script sob demanda. Somente navegador (sem DOM no topo).
export async function compartilharArquivo(blob, nome, titulo) {
  const file = new File([blob], nome, { type: blob.type });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: titulo });
      return 'compartilhado';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'baixado';
}

// Copia texto para a área de transferência; sem a API (ou sem permissão), usa um textarea selecionado.
export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(texto); return true; }
  } catch { /* cai no plano B */ }
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, texto.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

// Carrega um script clássico uma única vez (ex.: a biblioteca da planilha, só quando pedida).
const carregando = new Map();
export function carregarScript(src) {
  if (!carregando.has(src)) {
    carregando.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => { carregando.delete(src); s.remove(); reject(new Error(`Falha ao carregar ${src}`)); };
      document.head.appendChild(s);
    }));
  }
  return carregando.get(src);
}
