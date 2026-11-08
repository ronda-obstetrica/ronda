// Camada de impressão: preenche #impressao, abre a impressão do navegador e limpa depois.
// No iOS, "Salvar PDF" do diálogo de impressão é o caminho (sem biblioteca de PDF).
export function imprimirHtml(html, doc = document, win = window) {
  let camada = doc.getElementById('impressao');
  if (!camada) {
    camada = doc.createElement('div');
    camada.id = 'impressao';
    doc.body.appendChild(camada);
  }
  camada.innerHTML = html;
  const limpar = () => { camada.innerHTML = ''; win.removeEventListener('afterprint', limpar); };
  win.addEventListener('afterprint', limpar);
  win.print();
}
