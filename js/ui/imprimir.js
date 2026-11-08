// Camada de impressão: preenche #impressao, abre a impressão do navegador e limpa depois.
// No iOS, "Salvar PDF" do diálogo de impressão é o caminho (sem biblioteca de PDF).
let aoImprimir = null;

export function imprimirHtml(html, doc = document, win = window) {
  let camada = doc.getElementById('impressao');
  if (!camada) {
    camada = doc.createElement('div');
    camada.id = 'impressao';
    doc.body.appendChild(camada);
  }
  camada.innerHTML = html;
  // iOS pode não disparar afterprint: remove o ouvinte anterior antes de registrar outro.
  if (aoImprimir) win.removeEventListener('afterprint', aoImprimir);
  aoImprimir = () => { camada.innerHTML = ''; win.removeEventListener('afterprint', aoImprimir); aoImprimir = null; };
  win.addEventListener('afterprint', aoImprimir);
  win.print();
}
