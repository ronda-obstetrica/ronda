// Aba Dados: aviso de LGPD, backup em JSON (exportar/restaurar), apagar exemplos e apagar tudo.
import { esc, ddmm } from './util.js';
import { compartilharArquivo } from './compartilhar.js';
import { exportarJSON, importarJSON, apagarExemplos, novoEstado } from '../nucleo/estado.js';
import { contexto } from '../nucleo/contexto.js';
import { definirDxCustom, obterDxCustom, obterDxOcultos } from '../nucleo/diagnosticos.js';
import { htmlCenso } from './censo.js';
import { htmlHoje } from './hoje.js';

export const AVISO_LGPD_DADOS = 'Os dados ficam só neste aparelho, no navegador. Nada é enviado a servidor. As pacientes são identificadas apenas pelo leito: não escreva nomes, prontuário ou outros dados que as identifiquem. O backup e os relatórios saem do aparelho só quando você os compartilha.';
export const PALAVRA_APAGAR = 'APAGAR';
export const nomeBackup = (hoje) => `ronda-backup-${hoje}.json`;

export function htmlDados({ estado }) {
  const nEx = estado.pac.filter((p) => p.ex).length;
  const nPac = estado.pac.length;
  const ult = estado.ultimoBackup ? `Último backup: ${ddmm(estado.ultimoBackup)}.` : 'Nenhum backup feito ainda.';
  return `<h1 class="titulo-aba">Dados</h1>
    <p class="banner banner-aviso">${esc(AVISO_LGPD_DADOS)}</p>
    <section class="bloco">
      <h2 class="sec-tit">Backup</h2>
      <p class="nota">${ult} No iPhone, o sistema pode apagar os dados do site; guarde o backup em lugar seguro.</p>
      <button type="button" class="primario" data-act="backup-exportar">Exportar backup</button>
    </section>
    <section class="bloco">
      <h2 class="sec-tit">Restaurar backup</h2>
      <form class="restaurar" data-submit="backup-restaurar" novalidate>
        <label class="campo">Arquivo do backup (.json)<input type="file" name="arquivo" accept=".json,application/json"></label>
        <label class="campo">ou cole o texto do backup<textarea name="texto" rows="4" spellcheck="false" autocapitalize="off"></textarea></label>
        <p class="nota">Restaurar substitui todos os dados atuais deste aparelho.</p>
        <div class="acoes-linha"><button type="submit" class="sec">Restaurar</button></div>
      </form>
    </section>
    <section class="bloco">
      <h2 class="sec-tit">Apagar</h2>
      <button type="button" class="sec" data-act="apagar-exemplos"${nEx ? '' : ' disabled'}>Apagar exemplos${nEx ? ` (${nEx})` : ''}</button>
      <form class="apagar-tudo" data-submit="apagar-tudo" novalidate>
        <label class="campo">Para apagar tudo (${nPac} ${nPac === 1 ? 'leito' : 'leitos'}, protocolos e regras do serviço), digite ${PALAVRA_APAGAR}
          <input name="confirma" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
        <div class="acoes-linha"><button type="submit" class="sec perigo">Apagar tudo</button></div>
      </form>
    </section>`;
}

export function render(raiz, dados) {
  raiz.innerHTML = htmlDados(dados);
}

// Ensaio da restauração: lê, calcula e desenha Censo e Hoje sem gravar nada.
// Lança 'Backup inválido' se o backup não puder ser usado pelo app.
export function ensaiarRestauracao(texto, hoje) {
  const novo = importarJSON(texto);
  const registro = obterDxCustom();
  const ocultos = obterDxOcultos();
  try {
    const c = contexto(novo);
    const pronto = novo;
    htmlCenso({ estado: pronto, ctx: c, hoje });
    htmlHoje({ estado: pronto, ctx: c, hoje });
  } catch (e) {
    console.error(e);
    throw new Error('Backup inválido');
  } finally {
    definirDxCustom(registro, ocultos);
  }
  return novo;
}

// O backup não leva as iniciais: avisar antes de substituir os dados.
export const textoConfirmaRestaurar = (n) => `Substituir os dados atuais por este backup (${n} ${n === 1 ? 'leito' : 'leitos'})? Os leitos voltam sem as iniciais.`;

export const confirmaApagar = (txt) => String(txt ?? '').trim() === PALAVRA_APAGAR;

export const acoes = {
  'backup-exportar': async (ev, el, api) => {
    const hoje = api.hoje;
    try {
      const blob = new Blob([exportarJSON(api.estado)], { type: 'application/json' });
      const r = await compartilharArquivo(blob, nomeBackup(hoje), 'Backup Ronda Obstétrica');
      if (r !== 'compartilhado' && r !== 'baixado') return;
      if (api.atualizar((e) => ({ ...e, ultimoBackup: hoje }))) api.avisar(r === 'baixado' ? 'Backup baixado.' : 'Backup compartilhado.');
    } catch (e) {
      console.error(e);
      api.avisar('Não foi possível exportar o backup.');
    }
  },
  'backup-restaurar': async (ev, form, api) => {
    const arq = form.elements.arquivo.files?.[0];
    let texto;
    try {
      texto = arq ? await arq.text() : form.elements.texto.value;
    } catch {
      api.avisar('Não foi possível ler o arquivo.');
      return;
    }
    if (!String(texto ?? '').trim()) { api.avisar('Escolha um arquivo ou cole o texto do backup.'); return; }
    let novo;
    try { novo = ensaiarRestauracao(texto, api.hoje); } catch { api.avisar('Backup inválido'); return; }
    const n = novo.pac.length;
    if (!globalThis.confirm(textoConfirmaRestaurar(n))) return;
    if (api.atualizar(() => novo)) api.avisar('Backup restaurado.');
  },
  'apagar-exemplos': (ev, el, api) => {
    if (!api.estado.pac.some((p) => p.ex)) return;
    if (!globalThis.confirm('Apagar os leitos de exemplo?')) return;
    if (api.atualizar(apagarExemplos)) api.avisar('Exemplos apagados.');
  },
  'apagar-tudo': (ev, form, api) => {
    if (!confirmaApagar(form.elements.confirma.value)) {
      api.avisar(`Digite ${PALAVRA_APAGAR} para confirmar.`);
      form.elements.confirma.focus();
      return;
    }
    if (api.atualizar(() => novoEstado())) api.avisar('Todos os dados foram apagados.');
  },
};
