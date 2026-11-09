# Ronda Obstétrica v2.1 — ajustes após o primeiro uso

**Status:** rascunho para aprovação da usuária (2026-11-08)
**Base:** v2 publicada em https://ronda-obstetrica.github.io/ronda/ (branch `main`, 216 testes). Spec original: `docs/superpowers/specs/2026-11-05-ronda-v2-alertas-ig-design.md`; esta spec **altera** a original nos pontos abaixo e prevalece onde houver conflito.

## Por quê

A usuária (obstetra, uso pessoal na enfermaria de alto risco) usou o app pela primeira vez e encontrou: tela com informação demais, pendências criadas sozinhas (a ideia sempre foi **o app sugerir e ela escolher**), falta de lugar para medicações e para a programação do dia seguinte, e campos rígidos (IG só por seleção, paridade em 4 campos, diagnósticos fixos). O objetivo continua: substituir o censo diário, reduzir erros cruzando protocolos e IG, e facilitar a passagem de plantão.

## Mudanças (decididas pela usuária, salvo quando marcado "decisão do Claude")

### 1. Pendências: tudo vira sugestão
- Protocolos **não criam mais pendências sozinhos**. Nem os itens do protocolo do diagnóstico, nem as pendências recorrentes que nasciam das regras por IG (ex.: exames de PE a cada 7 dias, CTG semanal na DMG a partir da IG).
- Esses itens aparecem num quadro **"Sugestões"** na página da paciente. Cada sugestão tem **"+"** (vira pendência, com a recorrência/duração que o protocolo define) e **"dispensar"** (some daquele leito). Há **"adicionar todas"**.
- Sugestões das regras por IG só aparecem quando a IG entra na janela da regra (mesma lógica de hoje, só que gerando sugestão em vez de pendência).
- Uma sugestão já aceita (pendência existente com a mesma chave) ou dispensada não reaparece. Dispensar é por leito e pode ser desfeito (decisão do Claude: lista "dispensadas" já existe no modelo; reaproveitar ou criar `sugDispensadas`).
- **Alertas por IG continuam automáticos** (corticoide, MgSO₄, resolução etc.) — são avisos, não tarefas. O "marcar como feito" do alerta continua.
- O botão **"+ Pendência"** (criar do zero) fica visível e óbvio na página da paciente.
- Pendências automáticas já existentes nos dados atuais permanecem (não apagar dados da usuária).

### 2. IG digitável
- No cadastro/edição, a IG pode ser **digitada** (formato `31+2`, também aceitar `31` = 31+0) **ou** selecionada como hoje. Entrada inválida mostra erro curto e não salva. A datação por DUM/USG continua.

### 3. Medicações em uso
- Lista por paciente: cada item = **texto livre** (nome + posologia, ex.: "Cefalexina 12/12h", até ~60 caracteres), **data de início** (padrão hoje) e **dias previstos** (opcional).
- Exibição: `💊 Cefalexina 12/12h · D3/7`; sem dias previstos, `D3`. Decisão do Claude: cada medicação tem a opção "contar dias" (ligada por padrão); desligada = sem quadradinho e os dias previstos ficam ocultos/ignorados (ex.: "Metildopa 500mg 8/8h"). O início é obrigatório quando "contar dias" está ligado (padrão hoje).
- `D` = dias desde o início, com o dia de início = D1. No último dia previsto, destaque "último dia"; depois do último dia, destaque "terminou — suspender?" (decisão do Claude: aviso amarelo no cartão/página, não alerta clínico).
- Ações: adicionar, editar, suspender/remover.
- Entra no texto de plantão, na ficha PDF e na planilha (coluna "Medicações").

### 4. Paridade num campo único
- Um campo de texto livre (ex.: `G2P1C1A0`, até ~20 caracteres) substitui os 4 campos numéricos. Migração: pacientes existentes com g/p/c/a viram o texto `G{g}P{p}C{c}A{a}`. Relatórios mostram o texto como está.

### 5. Diagnósticos criados pela usuária
- Na escolha de diagnósticos, **"+ Novo diagnóstico"**: nome por extenso (ex.: "Pielonefrite") e sigla curta para a etiqueta (ex.: "PNF").
- O diagnóstico novo vale para todas as pacientes (fica no estado global, entra no backup) e a aba **Protocolos** ganha um protocolo **em branco** com o nome dele, editável como os outros (itens viram sugestões, item 1).
- Decisão do Claude: diagnósticos criados não têm modificadores nem regras por IG próprias nesta versão; podem ser renomeados e excluídos (excluir só se nenhuma paciente estiver usando; pedir confirmação).

### 6. Iniciais da paciente (só na tela)
- Campo opcional "Iniciais" no leito, até ~10 caracteres. Aparece **somente na tela** (lista e página da paciente).
- **Nunca** sai em texto de plantão, ficha PDF, planilha, nem no **backup JSON** (decisão do Claude: restaurar um backup traz os leitos sem iniciais). Isso mantém a regra original da usuária de não exportar dado identificável.
- Aviso discreto no campo: "Fica só neste celular; não vai para relatórios nem backup."
- Exceção consciente à spec original (que proibia iniciais) — autorizada pela usuária em 2026-11-08.

### 7. Programação
- Campo livre **"Programação"** em cada paciente (ex.: "USG amanhã + reavaliar ATB + se PA ok, alta"), até ~240 caracteres. Não se apaga sozinho.
- Nova aba **"Programação"** que junta os campos de todos os leitos, em ordem de leito (leitos sem programação aparecem com "—" ou são omitidos — decisão do Claude: omitidos, com contagem "N leitos sem programação").
- Entra no texto de plantão e na ficha PDF (e na planilha, coluna "Programação").

### 8. Visual: menos informação, letras menores
- **Censo (1ª tela)** vira uma lista enxuta: uma faixa por leito com `Leito 04 · 31+2 · iniciais · etiquetas dos dx · nº de alertas vermelhos · nº de pendências de hoje/atrasadas`.
- **Tocar na faixa abre a página da paciente** com tudo: diagnósticos e modificadores, alertas, medicações, programação, sugestões, pendências, controles (glicemia/PA), dados de cadastro, alta. Decisão do Claude: essa página é o modo visita atual (deslizar para o próximo/anterior leito; botão voltar para a lista).
- Letras e espaçamentos menores, hierarquia clara (leito e IG em destaque; secundário discreto); seções secundárias podem ficar recolhidas.
- Limites mantidos: campos de digitação com fonte ≥16px (evita zoom no iOS) e áreas de toque ≥44px (podem parecer menores visualmente).
- Continua legível em tema claro e escuro e em P&B na ficha impressa.

## Decisões de detalhe (do Claude, após a revisão do documento)

**Sugestões (item 1)**
- Chave da sugestão: item de protocolo = `prot:<dxId>:<texto normalizado>`; regra por IG = `regra:<idDaRegra>`. Editar o texto de um item no protocolo gera uma sugestão nova (aceitável e previsível).
- "Dispensar" grava a chave numa lista própria da paciente, `sugDispensadas` (separada de `dispensadas`, que continua para os alertas). "Desfazer" fica disponível num link "ver dispensadas" no quadro.
- Uma sugestão fica oculta enquanto existir, naquela paciente, qualquer pendência vinda dela (aberta ou concluída, inclusive a série recorrente que se renova como hoje). Apagar a pendência/série faz a sugestão voltar — como nada mais é automático, isso não cria trabalho sozinho.
- Desde a primeira execução da v2.1, a geração automática para de rodar para todas as pacientes. Pendências que já existem ficam como estão; a sugestão correspondente fica oculta porque já existe pendência com a mesma origem/chave (`chavePend`).
- Tirar um diagnóstico do leito: as pendências ficam; as sugestões daquele diagnóstico somem.

**Medicações (item 3)**
- `D = dias desde o início + 1` (início = D1), mesma conta de `progressoTratamento`. "Último dia" quando D = previstos; "terminou — suspender?" quando D > previstos.

**Dados, migração e backup (itens 4, 5, 6)**
- O estado ganha um número de versão do formato; `carregar` e a restauração de backup passam pela mesma migração (g/p/c/a → texto de paridade; campos novos vazios).
- Restaurar um backup substitui o estado inteiro, então os leitos voltam **sem** iniciais (o backup nunca as carrega). O aviso de restauração diz isso.
- Leito que referencia um diagnóstico criado que não existe mais: mostra "Diagnóstico removido" e permite tirar; não quebra.

**Diagnósticos criados (item 5)**
- Sigla de 1 a 6 caracteres, única sem diferenciar maiúsculas (nem igual às siglas da lista padrão nem a outra criada). O protocolo em branco usa a mesma estrutura e o mesmo lugar onde os protocolos editados já são guardados no estado. "Em uso" = algum leito atual (alta já remove a paciente).

**Programação (item 7)**
- Só leitos atuais (a alta remove a paciente e a programação junto). Texto inteiro na aba, sem cortar.

**Navegação (item 8)**
- Abas finais: **Censo, Hoje, Programação, Plantão, Protocolos, Dados**. A aba "Visita" sai da barra: a página da paciente é a evolução da tela de visita, aberta ao tocar numa faixa do Censo (ou num leito da aba Hoje/Programação), com deslizar para próximo/anterior e "voltar à lista". Os blocos de `cartao.js` são reaproveitados dentro dela. Arquivos novos entram em `ARQUIVOS` do `sw.js`.

**IG digitada (item 2)**
- Aceita `31+2`, `31 2` e `31` (= 31+0); semanas 0–44, dias 0–6; `31+7`, `31+`, `31,2` mostram erro "Use semanas+dias, ex.: 31+2". Funciona como a seleção atual: grava a IG de hoje (`igDays`, `igRef` = hoje) e passa a ser a IG usada, como já acontece ao selecionar.

**Iniciais (item 6)**
- Aparecem em todas as telas do app (Censo, Hoje, Programação, página da paciente). Nunca na ficha impressa, no texto copiado/compartilhado, na planilha nem no backup.

## Restrições que continuam
- Offline, sem servidor, dados só no localStorage do aparelho; sem envio automático.
- Nada identificável em relatórios/exportações (as iniciais ficam só na tela).
- Escapar todo texto da usuária em HTML.
- Migração de dados existentes sem perda (paridade, novos campos com padrão vazio).
- Ao publicar, trocar `VERSAO` no `sw.js` (aviso de nova versão) e incluir arquivos novos em `ARQUIVOS`.

## Não-objetivos
- Compartilhamento entre usuárias/equipe.
- Horário de início em tratamentos (a usuária usa MgSO₄ 12h e não precisa de contador de horas).
- Modificadores e regras por IG para diagnósticos criados pela usuária.

## Deixado para quem constrói
- Layout exato, tipografia e cores dentro da direção do item 8 (usar a skill de design de frontend).
- Nomes de campos no modelo de dados e a migração (versão do formato no estado).
- Onde ficam os botões de editar cadastro na página da paciente.
