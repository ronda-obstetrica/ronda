// Aba Protocolos: protocolo por diagnóstico, regras de alerta e faixas dos controles do serviço.
// Salvar grava só o texto; linhas com erro são ignoradas na avaliação e continuam visíveis aqui.
import { esc } from './util.js';
import { copiarTexto } from './compartilhar.js';
import { DIAGNOSTICOS } from '../nucleo/diagnosticos.js';
import { parseProtocolo, PROT_PADRAO } from '../nucleo/pendencias.js';
import { parseRegras, REGRAS_GLOBAIS_TEXTO } from '../nucleo/regras.js';
import { parseFaixas, FAIXAS_GLOBAIS_TEXTO } from '../nucleo/faixas.js';

export const AVISO_PROTOCOLOS = 'Os protocolos e regras que acompanham o app são um rascunho com fonte. Confira com os protocolos da sua instituição antes de usar.';

const PARSERS = { prot: parseProtocolo, regras: parseRegras, faixas: parseFaixas };
const GLOBAIS = {
  regras: { titulo: 'Regras de alerta globais', texto: REGRAS_GLOBAIS_TEXTO.trim() },
  faixas: { titulo: 'Faixas dos controles globais', texto: FAIXAS_GLOBAIS_TEXTO.trim() },
};

// Diagnósticos com a seção aberta (sobrevive ao redesenho depois de salvar).
const abertos = new Set();

export function errosDe(tipo, texto) {
  return PARSERS[tipo](texto).erros;
}

export function htmlErros(erros) {
  if (!erros.length) return '';
  const n = erros.length;
  return `<p class="erros-tit">${n} ${n === 1 ? 'linha com erro (ignorada)' : 'linhas com erro (ignoradas)'}:</p>
    <ul class="erros-lista">${erros.map((e) => `<li>Linha ${esc(e.n)}: ${esc(e.msg)}</li>`).join('')}</ul>`;
}

function htmlEditor({ tipo, dx = '', texto, rotulo, rows = 8, extra = '' }) {
  const id = `ed-${tipo}${dx ? `-${dx}` : ''}`;
  return `<form class="editor" data-submit="prot-salvar" data-tipo="${esc(tipo)}" data-dx="${esc(dx)}">
    <label class="campo" for="${esc(id)}">${esc(rotulo)}</label>
    <textarea id="${esc(id)}" name="texto" rows="${rows}" spellcheck="false" autocapitalize="off" data-input="prot-validar">${esc(texto)}</textarea>
    <div class="erros" aria-live="polite">${htmlErros(errosDe(tipo, texto))}</div>
    <div class="acoes-linha"><button type="submit" class="primario">Salvar</button>${extra}</div>
  </form>`;
}

function htmlProtDx(estado) {
  return Object.entries(DIAGNOSTICOS).map(([dx, def]) => {
    const texto = estado.prot?.[dx] ?? '';
    const { itens, erros } = parseProtocolo(texto);
    const resumo = `${itens.length} ${itens.length === 1 ? 'item' : 'itens'}${erros.length ? ` · ⚠ ${erros.length} com erro` : ''}`;
    const extra = PROT_PADRAO[dx] !== undefined
      ? `<button type="button" class="sec" data-act="prot-modelo" data-dx="${esc(dx)}">Restaurar modelo</button>` : '';
    return `<details class="prot-dx"${abertos.has(dx) ? ' open' : ''}>
      <summary data-act="prot-secao" data-dx="${esc(dx)}"><b>${esc(def.nome)}</b> <span class="nota">${resumo}</span></summary>
      ${htmlEditor({ tipo: 'prot', dx, texto, rotulo: `Protocolo — ${def.nome}`, extra })}
    </details>`;
  }).join('');
}

export function htmlProtocolos({ estado }) {
  const verGlobais = (tipo) => `<button type="button" class="sec" data-act="ver-globais" data-tipo="${tipo}">Ver ${tipo === 'regras' ? 'regras' : 'faixas'} globais</button>`;
  return `<h1 class="titulo-aba">Protocolos</h1>
    <p class="banner banner-aviso">${esc(AVISO_PROTOCOLOS)}</p>
    <section class="bloco">
      <h2 class="sec-tit">Protocolos por diagnóstico</h2>
      <p class="nota">Uma linha por item: <code>texto | categoria | dias até o 1º prazo | repetir a cada N dias (0 = não) | duração opcional (7d, 24h, 2doses@1)</code>. Linhas com # são comentários. O protocolo entra nas pendências quando o diagnóstico é cadastrado no leito.</p>
      ${htmlProtDx(estado)}
    </section>
    <section class="bloco">
      <h2 class="sec-tit">Regras de alerta do serviço</h2>
      <p class="nota">Uma regra por linha: <code>id | diagnóstico+mod!mod | IG início | IG fim | vermelho/amarelo | mensagem | fonte | antecedência | repetir</code>. Mesmo id de uma regra global a substitui; <code>-id</code> desliga uma global.</p>
      ${htmlEditor({ tipo: 'regras', texto: estado.regrasServico ?? '', rotulo: 'Regras do serviço', extra: verGlobais('regras') })}
    </section>
    <section class="bloco">
      <h2 class="sec-tit">Faixas dos controles do serviço</h2>
      <p class="nota">Uma faixa por linha: <code>id | diagnóstico | medida | limite | vermelho/amarelo | mensagem | fonte</code>. Mesmo id de uma faixa global a substitui; <code>-id</code> desliga uma global.</p>
      ${htmlEditor({ tipo: 'faixas', texto: estado.faixasServico ?? '', rotulo: 'Faixas do serviço', rows: 6, extra: verGlobais('faixas') })}
    </section>`;
}

export function htmlGlobais(tipo) {
  const g = GLOBAIS[tipo];
  return `<h2>${esc(g.titulo)}</h2>
    <p class="nota">Somente leitura. Copie uma linha para as do serviço e altere lá (mesmo id substitui a global).</p>
    <textarea class="previa" readonly rows="14" spellcheck="false">${esc(g.texto)}</textarea>
    <div class="acoes-form">
      <button type="button" class="sec" data-act="fechar-folha">Fechar</button>
      <button type="button" class="primario" data-act="copiar-globais" data-tipo="${esc(tipo)}" data-foco>Copiar</button>
    </div>`;
}

export function render(raiz, dados) {
  raiz.innerHTML = htmlProtocolos(dados);
}

// Mutação que grava o texto bruto no lugar certo do estado.
export function gravarTexto(tipo, dx, texto) {
  return (estado) => {
    if (tipo === 'prot') return { ...estado, prot: { ...estado.prot, [dx]: texto } };
    if (tipo === 'regras') return { ...estado, regrasServico: texto };
    if (tipo === 'faixas') return { ...estado, faixasServico: texto };
    return null;
  };
}

export const acoes = {
  'prot-secao': (ev, el) => {
    const dx = el.dataset.dx;
    if (abertos.has(dx)) abertos.delete(dx); else abertos.add(dx);
  },
  'prot-validar': (ev, el) => {
    const form = el.form;
    form.querySelector('.erros').innerHTML = htmlErros(errosDe(form.dataset.tipo, el.value));
  },
  'prot-salvar': (ev, form, api) => {
    const { tipo, dx } = form.dataset;
    if (!PARSERS[tipo] || (tipo === 'prot' && !DIAGNOSTICOS[dx])) return;
    const texto = form.elements.texto.value;
    const n = errosDe(tipo, texto).length;
    if (tipo === 'prot') abertos.add(dx);
    if (api.atualizar(gravarTexto(tipo, dx, texto))) {
      api.avisar(n ? `Salvo. ${n} ${n === 1 ? 'linha com erro será ignorada' : 'linhas com erro serão ignoradas'}.` : 'Salvo.');
    }
  },
  'prot-modelo': (ev, el, api) => {
    const dx = el.dataset.dx;
    if (PROT_PADRAO[dx] === undefined) return;
    if (!globalThis.confirm('Substituir este protocolo pelo modelo que acompanha o app?')) return;
    abertos.add(dx);
    if (api.atualizar(gravarTexto('prot', dx, PROT_PADRAO[dx]))) api.avisar('Modelo restaurado.');
  },
  'ver-globais': (ev, el, api) => {
    if (GLOBAIS[el.dataset.tipo]) api.abrirFolha(htmlGlobais(el.dataset.tipo));
  },
  'copiar-globais': async (ev, el, api) => {
    const g = GLOBAIS[el.dataset.tipo];
    if (!g) return;
    api.avisar((await copiarTexto(g.texto)) ? 'Copiado.' : 'Não foi possível copiar. Selecione o texto e copie manualmente.');
  },
};
