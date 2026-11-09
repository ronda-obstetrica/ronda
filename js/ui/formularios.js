// Formulários na folha inferior: cadastro/edição de paciente, "Feito" de alerta e de pendência,
// e a lista pequena das escolhas de modificador. HTML puro + ações; DOM só dentro das ações.
import { esc, campoLivre, acharPac, mudarPac, modVisivel } from './util.js';
import { NOME_ESCOLHA } from './cartao.js';
import { dxDef, listaDx, validarNovoDx, criarDx, alternarMod } from '../nucleo/diagnosticos.js';
import { parseIG, fmtIG, lerIGDigitada, igHoje } from '../nucleo/datas.js';
import { sugerirDatacao, aplicarDatacao } from '../nucleo/datacao.js';
import { novaPaciente, cortar, LIMITE_OBS, LIMITE_RES, LIMITE_PAR, LIMITE_INICIAIS } from '../nucleo/estado.js';
import { concluir, remover } from '../nucleo/pendencias.js';
import { registrarAlertaFeito } from '../nucleo/alertas.js';

const LIMITE_LEITO = 6;
const LIMITE_ALERG = 120;
// focoNoBotao: o resultado é opcional, então a folha abre sem puxar o teclado.
const botoesForm = (salvar = 'Salvar', focoNoBotao = false) => `<div class="acoes-form">
  <button type="button" class="sec" data-act="fechar-folha">Cancelar</button>
  <button type="submit" class="primario"${focoNoBotao ? ' data-foco' : ''}>${salvar}</button></div>`;

// ---------- Datação (DUM x 1ª USG) ----------

// Texto "pela DUM: X · pela USG: Y · sugerido: Z (diferença N dias > L)" e a datação pronta para aplicar.
export function textoDatacao({ dum = '', usgData = '', usgIG = '', igHoje = '' }, hoje) {
  const igTxt = String(usgIG ?? '').trim();
  const igDias = igTxt ? parseIG(igTxt) : null;
  let erro = null;
  if (dum && dum > hoje) erro = 'A DUM está no futuro.';
  else if (usgData && usgData > hoje) erro = 'A data da USG está no futuro.';
  else if (igTxt && igDias === null) erro = 'IG da USG inválida — use semanas+dias, ex.: 31+2.';
  else if (Boolean(usgData) !== Boolean(igTxt)) erro = 'Para usar a 1ª USG, preencha a data e a IG naquele dia.';
  const usg = usgData && igDias !== null ? { data: usgData, igDias } : null;
  const ig = lerIGDigitada(igHoje);
  if (ig.erro && !erro) erro = ig.erro;
  const igDigitada = ig.dias ?? null;
  let sug = sugerirDatacao({ dum: dum || null, usg }, hoje);
  if (!sug && igDigitada !== null) sug = { fonte: 'ig', igDumHoje: null, igUsgHoje: null, diferenca: null, limite: null };
  if (!sug) return { texto: '', erro, sug: null, dum: dum || null, usg, igDigitada };
  const partes = [];
  if (sug.igDumHoje !== null) partes.push(`pela DUM: ${fmtIG(sug.igDumHoje)}`);
  if (sug.igUsgHoje !== null) partes.push(`pela USG: ${fmtIG(sug.igUsgHoje)}`);
  if (sug.diferenca !== null) {
    partes.push(`sugerido: ${sug.fonte.toUpperCase()} (diferença ${sug.diferenca} dias ${sug.diferenca > sug.limite ? '>' : '≤'} ${sug.limite})`);
  }
  if (igDigitada !== null) partes.push(`IG hoje: ${fmtIG(igDigitada)}`);
  const disponiveis = [dum && 'dum', usg && 'usg', igDigitada !== null && 'ig'].filter(Boolean);
  return { texto: partes.join(' · '), erro, sug, dum: dum || null, usg, igDigitada, disponiveis };
}

function lerDatacao(form) {
  return { dum: form.elements.dum.value, usgData: form.elements.usgData.value, usgIG: form.elements.usgIG.value, igHoje: form.elements.igHoje?.value ?? '' };
}

function atualizarDatacao(form, hoje) {
  const r = textoDatacao(lerDatacao(form), hoje);
  const prev = form.querySelector('.datacao-preview');
  prev.textContent = r.erro ? `${r.texto ? r.texto + ' — ' : ''}${r.erro}` : r.texto;
  prev.classList.toggle('erro', Boolean(r.erro));
  const disp = r.disponiveis ?? [];
  form.querySelector('.datacao-escolha').hidden = disp.length < 2;
  for (const rd of form.querySelectorAll('input[name="escolhida"]')) rd.closest('label').hidden = !disp.includes(rd.value);
  if (disp.length >= 2) {
    const marcado = form.querySelector('input[name="escolhida"]:checked')?.value;
    const alvo = form.dataset.escolhaManual === '1' && disp.includes(marcado) ? marcado : r.sug.fonte;
    form.querySelector(`input[name="escolhida"][value="${alvo}"]`).checked = true;
  }
}

// ---------- Diagnósticos no formulário ----------

export function htmlModsForm(item) {
  const def = dxDef(item?.dx);
  if (!def) return '';
  const mods = item.mods || {};
  return def.mods.filter((m) => modVisivel(m, mods)).map((m) => {
    if (m.tipo === 'escolha') {
      const ops = m.opcoes.map((o) => `<option value="${esc(o.id)}"${mods[m.id] === o.id ? ' selected' : ''}>${esc(o.curto)} — ${esc(o.extenso)}</option>`).join('');
      return `<label class="campo">${esc(NOME_ESCOLHA[m.id] ?? m.id)}
        <select data-mod="${esc(m.id)}" data-input="dx-form"><option value="">—</option>${ops}</select></label>`;
    }
    return `<label class="chip"><input type="checkbox" data-mod="${esc(m.id)}"${mods[m.id] === true ? ' checked' : ''}> ${esc(m.curto)}</label>`;
  }).join('');
}

function htmlDxBloco(item) {
  const ops = listaDx().map(([id, d]) => `<option value="${esc(id)}"${item?.dx === id ? ' selected' : ''}>${esc(d.nome)}</option>`).join('');
  // Dx já gravado mas removido do registro: mantém a opção para não perder a escolha ao reabrir.
  const orfao = item?.dx && !dxDef(item.dx) ? `<option value="${esc(item.dx)}" selected>Diagnóstico removido</option>` : '';
  return `<div class="dx-bloco">
    <div class="linha">
      <select data-campo="dx" data-input="dx-form" aria-label="Diagnóstico"><option value="">— diagnóstico —</option>${ops}${orfao}</select>
      <button type="button" class="icone" data-act="dx-remover" aria-label="Remover diagnóstico">×</button>
    </div>
    <div class="dx-mods">${htmlModsForm(item)}</div>
  </div>`;
}

function lerDx(bloco) {
  const dx = bloco.querySelector('[data-campo="dx"]').value;
  const mods = {};
  for (const el of bloco.querySelectorAll('[data-mod]')) {
    if (el.type === 'checkbox') { if (el.checked) mods[el.dataset.mod] = true; } else if (el.value) mods[el.dataset.mod] = el.value;
  }
  return { dx, mods };
}

function criarDxForm(mini, api) {
  const dados = { nome: mini.querySelector('[data-dx-nome]').value, sigla: mini.querySelector('[data-dx-sigla]').value };
  const erro = validarNovoDx(api.estado, dados);
  const alvo = mini.querySelector('.dx-novo-erro');
  alvo.textContent = erro ?? '';
  if (erro) return;
  if (!api.atualizar((estado) => criarDx(estado, dados))) return;
  const novo = api.estado.dxCustom.at(-1);
  const form = mini.closest('form');
  const opcao = (sel) => {
    const o = globalThis.document.createElement('option');
    o.value = novo.id; o.textContent = novo.sigla;
    sel.append(o);
  };
  const selects = [...form.querySelectorAll('select[data-campo="dx"]')];
  for (const sel of selects) opcao(sel);
  let livre = selects.find((s) => !s.value);
  if (!livre) {
    form.querySelector('.dx-lista').insertAdjacentHTML('beforeend', htmlDxBloco(null));
    livre = form.querySelector('.dx-lista .dx-bloco:last-child select[data-campo="dx"]');
  }
  livre.value = novo.id;
  livre.closest('.dx-bloco').querySelector('.dx-mods').innerHTML = '';
  mini.hidden = true;
  mini.querySelector('[data-dx-nome]').value = '';
  mini.querySelector('[data-dx-sigla]').value = '';
  api.avisar(`Diagnóstico ${novo.sigla} criado.`);
}

// ---------- Cadastro ----------

export function htmlCadastro(pac, hoje) {
  const d = pac?.datacao ?? {};
  const num = (nome, rot, v, max) => `<label class="campo">${rot}<input type="number" name="${nome}" inputmode="numeric" min="0" max="${max}" value="${esc(v ?? '')}"></label>`;
  const igAtual = d.escolhida === 'ig' && pac ? igHoje(pac, hoje) : null;
  const igTxt = igAtual != null && igAtual >= 0 ? fmtIG(igAtual) : '';
  const dat = textoDatacao({ dum: d.dum ?? '', usgData: d.usg?.data ?? '', usgIG: d.usg ? fmtIG(d.usg.igDias) : '', igHoje: igTxt }, hoje);
  const disp = dat.disponiveis ?? [];
  const escolhida = disp.includes(d.escolhida) ? d.escolhida : dat.sug?.fonte ?? 'dum';
  const radio = (v, rot) => `<label class="chip"${disp.includes(v) ? '' : ' hidden'}><input type="radio" name="escolhida" value="${v}" data-input="datacao-escolha"${escolhida === v ? ' checked' : ''}> ${rot}</label>`;
  return `<form class="form-pac" data-submit="paciente-salvar" data-id="${esc(pac?.id ?? '')}"${d.escolhida ? ' data-escolha-manual="1"' : ''} novalidate>
    <h2>${pac ? `Editar leito ${esc(pac.leito)}` : 'Nova paciente'}</h2>
    <p class="nota">Identifique só pelo leito. Obrigatórios: leito e um diagnóstico.</p>
    <label class="campo">Leito *<input name="leito" maxlength="${LIMITE_LEITO}" autocomplete="off" value="${esc(pac?.leito ?? '')}"></label>
    <fieldset><legend>Diagnósticos *</legend>
      <div class="dx-lista">${(pac?.dxs?.length ? pac.dxs : [null]).map(htmlDxBloco).join('')}</div>
      <button type="button" class="sec" data-act="dx-add">+ diagnóstico</button>
      <button type="button" class="sec" data-act="dx-novo">+ Novo diagnóstico</button>
      <div class="dx-novo" hidden>
        <label class="campo">Nome por extenso<input form="sem-form" data-dx-nome maxlength="40" autocomplete="off"></label>
        <label class="campo">Sigla<input form="sem-form" data-dx-sigla maxlength="6" autocomplete="off"></label>
        <p class="erro dx-novo-erro" role="alert" aria-live="polite"></p>
        <div class="acoes-form">
          <button type="button" class="sec" data-act="dx-novo-cancelar">Cancelar</button>
          <button type="button" class="primario" data-act="dx-novo-salvar">Criar</button>
        </div>
      </div>
    </fieldset>
    <fieldset><legend>Idade gestacional</legend>
      <label class="campo">DUM<input type="date" name="dum" max="${esc(hoje)}" value="${esc(d.dum ?? '')}" data-input="datacao"></label>
      <div class="linha2">
        <label class="campo">1ª USG — data<input type="date" name="usgData" max="${esc(hoje)}" value="${esc(d.usg?.data ?? '')}" data-input="datacao"></label>
        <label class="campo">IG na USG<input name="usgIG" placeholder="31+2" autocomplete="off" value="${esc(d.usg ? fmtIG(d.usg.igDias) : '')}" data-input="datacao"></label>
      </div>
      <label class="campo">IG hoje<input name="igHoje" placeholder="31+2" inputmode="text" autocomplete="off" value="${esc(igTxt)}" data-input="datacao"></label>
      <p class="datacao-preview${dat.erro ? ' erro' : ''}" aria-live="polite">${esc(dat.erro ? `${dat.texto ? dat.texto + ' — ' : ''}${dat.erro}` : dat.texto)}</p>
      <div class="datacao-escolha"${disp.length >= 2 ? '' : ' hidden'}><span>Usar:</span>${radio('dum', 'DUM')}${radio('usg', 'USG')}${radio('ig', 'IG hoje')}</div>
    </fieldset>
    ${num("idade", "Idade", pac?.idade, 70)}
    <label class="campo">Paridade<input name="par" maxlength="${LIMITE_PAR}" placeholder="G2P1C1A0" autocomplete="off" value="${esc(pac?.par ?? '')}"></label>
    <label class="campo">Iniciais<input name="iniciais" maxlength="${LIMITE_INICIAIS}" autocomplete="off" value="${esc(pac?.iniciais ?? '')}"><span class="nota">Fica só neste celular; não vai para relatórios nem backup.</span></label>
    <label class="campo">Internação<input type="date" name="int" max="${esc(hoje)}" value="${esc(pac?.int || hoje)}"></label>
    <label class="campo">Alergias<input name="alerg" maxlength="${LIMITE_ALERG}" autocomplete="off" value="${esc(pac?.alerg ?? '')}"></label>
    ${campoLivre({ nome: 'obs', rotulo: 'Observação', valor: pac?.obs ?? '', max: LIMITE_OBS, multilinha: true })}
    ${botoesForm()}
  </form>`;
}

const inteiro = (v, max) => {
  const t = String(v ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

function salvarPaciente(ev, form, api) {
  const hoje = api.hoje;
  const id = form.dataset.id || null;
  const el = form.elements;
  const leito = cortar(el.leito.value, LIMITE_LEITO);
  if (!leito) { api.avisar('Informe o leito.'); el.leito.focus(); return; }
  const vistos = new Set();
  const dxs = [...form.querySelectorAll('.dx-bloco')].map(lerDx)
    .filter((d) => d.dx && !vistos.has(d.dx) && vistos.add(d.dx));
  if (!dxs.length) { api.avisar('Escolha pelo menos um diagnóstico.'); return; }
  const chave = leito.toLowerCase();
  if (api.estado.pac.some((p) => p.id !== id && String(p.leito).trim().toLowerCase() === chave)) {
    api.avisar(`O leito ${leito} já está cadastrado.`); return;
  }
  const dat = textoDatacao(lerDatacao(form), hoje);
  if (dat.erro) { api.avisar(dat.erro); return; }
  const marcada = form.querySelector('input[name="escolhida"]:checked')?.value;
  const escolhida = (dat.disponiveis?.length ?? 0) >= 2 && dat.disponiveis.includes(marcada) ? marcada : dat.sug?.fonte;
  const dados = {
    leito, dxs,
    idade: inteiro(el.idade.value, 70),
    par: cortar(el.par.value, LIMITE_PAR),
    iniciais: cortar(el.iniciais.value, LIMITE_INICIAIS),
    int: el.int.value || hoje,
    alerg: cortar(el.alerg.value, LIMITE_ALERG),
    obs: cortar(el.obs.value, LIMITE_OBS),
  };
  const ok = api.atualizar((estado) => {
    const antigo = id ? estado.pac.find((p) => p.id === id) : null;
    let pac = antigo ? { ...antigo, ...dados } : novaPaciente(dados);
    if (dat.sug) pac = aplicarDatacao(pac, { dum: dat.dum, usg: dat.usg, escolhida, ...(dat.igDigitada !== null ? { igDigitada: dat.igDigitada } : {}) }, hoje);
    return { ...estado, pac: antigo ? estado.pac.map((p) => (p.id === id ? pac : p)) : [...estado.pac, pac] };
  });
  api.fecharFolha();
  if (ok) api.avisar(`Leito ${leito} salvo.`);
}

// ---------- Folhas pequenas ----------

export function htmlFeitoAlerta(pac, alerta, hoje) {
  return `<form data-submit="alerta-feito-salvar" data-id="${esc(pac.id)}" data-regra="${esc(alerta.regraId)}">
    <h2>Registrar como feito</h2>
    <p class="nota">Leito ${esc(pac.leito)} · ${esc(alerta.msg)}</p>
    <label class="campo">Data<input type="date" name="data" value="${esc(hoje)}" max="${esc(hoje)}"></label>
    ${campoLivre({ nome: 'res', rotulo: 'Resultado curto (opcional)', max: LIMITE_RES })}
    ${botoesForm('Salvar', true)}
  </form>`;
}

export function htmlFeitoPend(pac, pend) {
  return `<form data-submit="pend-feito-salvar" data-id="${esc(pac.id)}" data-pend="${esc(pend.id)}">
    <h2>Concluir pendência</h2>
    <p class="nota">Leito ${esc(pac.leito)} · ${esc(pend.texto)}</p>
    ${campoLivre({ nome: 'res', rotulo: 'Resultado curto (opcional)', max: LIMITE_RES })}
    ${botoesForm('Feito', true)}
    <button type="button" class="sec perigo largo" data-act="pend-remover" data-id="${esc(pac.id)}" data-pend="${esc(pend.id)}">Remover pendência</button>
  </form>`;
}

export function htmlEscolha(pac, i, mod) {
  const atual = pac.dxs[i]?.mods?.[mod.id];
  const op = (valor, rotulo) => `<button type="button" class="opcao${atual === valor || (!atual && !valor) ? ' ligado' : ''}" aria-pressed="${atual === valor || (!atual && !valor)}"
    data-act="mod-op" data-id="${esc(pac.id)}" data-i="${esc(i)}" data-mod="${esc(mod.id)}" data-valor="${esc(valor)}">${rotulo}</button>`;
  return `<h2>${esc(NOME_ESCOLHA[mod.id] ?? mod.id)} — ${esc(dxDef(pac.dxs[i].dx)?.nome ?? '')}</h2>
    <p class="nota">Leito ${esc(pac.leito)}</p>
    <div class="opcoes">${mod.opcoes.map((o) => op(o.id, `<b>${esc(o.curto)}</b> ${esc(o.extenso)}`)).join('')}${op('', 'Não definido')}</div>
    <div class="acoes-form"><button type="button" class="sec" data-act="fechar-folha">Cancelar</button></div>`;
}

// ---------- Ações ----------

export const acoes = {
  novo: (ev, el, api) => api.abrirFolha(htmlCadastro(null, api.hoje)),
  editar: (ev, el, api) => {
    const pac = acharPac(api.estado, el.dataset.id);
    if (pac) api.abrirFolha(htmlCadastro(pac, api.hoje));
  },
  'dx-add': (ev, el) => el.closest('fieldset').querySelector('.dx-lista').insertAdjacentHTML('beforeend', htmlDxBloco(null)),
  'dx-novo': (ev, el) => {
    const mini = el.closest('fieldset').querySelector('.dx-novo');
    mini.hidden = false;
    mini.querySelector('[data-dx-nome]').focus();
  },
  'dx-novo-cancelar': (ev, el) => {
    const mini = el.closest('.dx-novo');
    mini.hidden = true;
    mini.querySelector('.dx-novo-erro').textContent = '';
  },
  'dx-novo-salvar': (ev, el, api) => criarDxForm(el.closest('.dx-novo'), api),
  'dx-remover': (ev, el) => el.closest('.dx-bloco').remove(),
  // input: troca de diagnóstico ou de escolha redesenha os modificadores (visivelSe).
  'dx-form': (ev, el) => {
    if (el.type === 'checkbox') return;
    const bloco = el.closest('.dx-bloco');
    const item = lerDx(bloco);
    if (el.dataset.campo === 'dx') item.mods = {};
    bloco.querySelector('.dx-mods').innerHTML = htmlModsForm(item);
  },
  datacao: (ev, el, api) => atualizarDatacao(el.form, api.hoje),
  'datacao-escolha': (ev, el) => { el.form.dataset.escolhaManual = '1'; },
  'paciente-salvar': salvarPaciente,
  'mod-op': (ev, el, api) => {
    const { id, mod, valor } = el.dataset;
    const i = Number(el.dataset.i);
    api.atualizar(mudarPac(id, (p) => ({ ...p, dxs: p.dxs.map((d, j) => (j === i ? alternarMod(d, mod, valor) : d)) })));
    api.fecharFolha();
  },
  'alerta-feito-salvar': (ev, form, api) => {
    const data = form.elements.data.value || api.hoje;
    if (data > api.hoje) { api.avisar('A data não pode estar no futuro.'); return; }
    const { id, regra } = form.dataset;
    api.atualizar(mudarPac(id, (p) => registrarAlertaFeito(p, regra, data, form.elements.res.value)));
    api.fecharFolha();
  },
  'pend-feito-salvar': (ev, form, api) => {
    const { id, pend } = form.dataset;
    api.atualizar(mudarPac(id, (p) => concluir(p, pend, api.hoje, form.elements.res.value)));
    api.fecharFolha();
  },
  'pend-remover': (ev, el, api) => {
    if (!globalThis.confirm('Remover esta pendência? Se veio de uma regra por IG, ela não será criada de novo.')) return;
    const { id, pend } = el.dataset;
    api.atualizar(mudarPac(id, (p) => remover(p, pend)));
    api.fecharFolha();
  },
};
