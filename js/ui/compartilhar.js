// Compartilha um arquivo (Web Share) ou baixa como alternativa. Somente navegador.
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
