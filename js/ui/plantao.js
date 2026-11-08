// Aba Plantão: prévia do texto da passagem, copiar, planilha .xlsx e impressão das fichas (PDF).
// Gerar texto/planilha marca o plantão (marcarPlantao): o próximo "o que mudou" parte daqui.
import { esc, ddmm } from './util.js';
import { compartilharArquivo, copiarTexto, carregarScript } from './compartilhar.js';
import { textoPlantao } from '../relatorios/texto.js';
import { linhasPlanilha, gerarXlsx } from '../relatorios/planilha.js';
import { htmlFichas } from '../relatorios/ficha.js';
import { imprimirHtml } from './imprimir.js';
import { marcarPlantao } from '../nucleo/mudancas.js';

export const SRC_XLSX = 'vendor/xlsx.mini.min.js';
export const nomePlanilha = (hoje) => `censo-${hoje}.xlsx`;

export function htmlPlantao({ estado, ctx, hoje }) {
  const texto = textoPlantao(estado, hoje, ctx);
  const ult = estado.ultimoPlantao?.data;
  const base = ult
    ? `O "o que mudou" compara com o último plantão gerado (${ddmm(ult)}).`
    : 'Ainda não há plantão gerado: o "o que mudou" aparece a partir do próximo.';
  return `<h1 class="titulo-aba">Plantão</h1>
    <p class="nota">${base} Copiar o texto ou compartilhar a planilha marca um novo plantão.</p>
    <div class="acoes-linha acoes-plantao">
      <button type="button" class="primario" data-act="plantao-copiar">Copiar texto</button>
      <button type="button" class="sec" data-act="plantao-pdf">Imprimir / salvar PDF</button>
      <button type="button" class="sec" data-act="plantao-planilha">Compartilhar planilha</button>
    </div>
    <p class="nota">O texto e os arquivos não têm identificação das pacientes. Confira antes de enviar.</p>
    <label class="campo">Prévia do texto
      <textarea class="previa" readonly rows="18" spellcheck="false">${esc(texto)}</textarea>
    </label>`;
}

export function render(raiz, dados) {
  raiz.innerHTML = htmlPlantao(dados);
  // Pré-carrega a biblioteca da planilha ao abrir a aba (não na partida do app): assim o primeiro
  // "Compartilhar planilha" não espera a rede e o Safari mantém o gesto para o compartilhamento.
  carregarScript(SRC_XLSX).catch(() => { /* tenta de novo no clique */ });
}

const marcar = (api) => api.atualizar((e) => marcarPlantao(e, api.hoje, api.ctx));

export const acoes = {
  'plantao-copiar': async (ev, el, api) => {
    let copiou = false;
    try {
      copiou = await copiarTexto(textoPlantao(api.estado, api.hoje, api.ctx));
    } catch (e) {
      console.error(e);
    }
    if (!copiou) {
      api.avisar('Não foi possível copiar. Selecione o texto da prévia e copie manualmente.');
      return;
    }
    if (marcar(api)) api.avisar('Texto copiado.');
  },
  'plantao-pdf': (ev, el, api) => imprimirHtml(htmlFichas(api.estado, api.hoje, api.ctx)),
  'plantao-planilha': async (ev, el, api) => {
    el.disabled = true;
    try {
      await carregarScript(SRC_XLSX);
      const blob = gerarXlsx(linhasPlanilha(api.estado, api.hoje, api.ctx));
      const r = await compartilharArquivo(blob, nomePlanilha(api.hoje), 'Censo');
      if (r === 'cancelado') return;
      if (marcar(api)) api.avisar(r === 'baixado' ? 'Planilha baixada.' : 'Planilha compartilhada.');
    } catch (e) {
      console.error(e);
      api.avisar('Não foi possível gerar a planilha.');
    } finally {
      el.disabled = false;
    }
  },
};
