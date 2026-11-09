// Aba Programação: o plano de cada paciente (campo "prog"), em ordem de leito, texto inteiro.
// Tocar numa linha abre a página da paciente (ação global abrir-paciente).
import { esc } from './util.js';
import { ordenarPacientes } from '../nucleo/estado.js';

export function htmlProgramacao({ estado }) {
  const pacs = ordenarPacientes(estado.pac);
  const com = pacs.filter((p) => String(p.prog ?? '').trim());
  const sem = pacs.length - com.length;
  const itens = com.map((p) => {
    const ini = p.iniciais ? ` · ${esc(p.iniciais)}` : '';
    return `<li><button type="button" class="prog-linha" data-act="abrir-paciente" data-id="${esc(p.id)}"><b class="pend-leito">Leito ${esc(p.leito)}${ini}</b> — <span class="prog-txt">${esc(p.prog)}</span></button></li>`;
  }).join('');
  const vazio = !pacs.length
    ? '<p class="vazio">Nenhuma paciente cadastrada.</p>'
    : !com.length ? '<p class="vazio">Nenhuma programação escrita. Abra um leito para escrever.</p>' : '';
  const rodape = sem ? `<p class="nota prog-sem">${sem} ${sem === 1 ? 'leito sem programação' : 'leitos sem programação'}</p>` : '';
  return `<h1 class="titulo-aba">Programação</h1>
    ${vazio}
    ${itens ? `<ul class="prog-lista">${itens}</ul>` : ''}
    ${rodape}`;
}

export function render(raiz, dados) {
  raiz.innerHTML = htmlProgramacao(dados);
}

export const acoes = {};
