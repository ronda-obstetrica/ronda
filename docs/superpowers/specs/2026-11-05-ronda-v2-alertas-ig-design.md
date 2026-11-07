# Ronda Obstétrica v2 — PWA, múltiplos diagnósticos, alertas por IG e relatórios

Data: 2026-11-05
Status: aprovado pela usuária em 2026-11-07

## 1. Intenção e porquê

Ronda Obstétrica é um app de bolso para quem passa visita na enfermaria de gestação de alto risco. A usuária (médica, plantonista/residente) descreve o problema assim: as internações são longas, cada paciente tem muitos exames, medicações e condutas diferentes, e o censo é refeito à mão todo dia pelo prescritor, impresso em planilha. Na visita diária às mesmas pacientes vira "copia e cola", e o olho humano deixa passar detalhes — sobretudo quando a IG cruza uma janela (corticoide, neuroproteção, IG-alvo de resolução).

Objetivo central, nas palavras dela: **substituir o censo diário, diminuir erros correlacionando checklists e protocolos, e facilitar a passagem de plantão.** Toda decisão de construção deve ser medida contra esses três pontos.

Existe um protótipo v1 (`ronda.html`, arquivo único, HTML/CSS/JS puro), descrito em `RONDA_OBSTETRICA.md`. Esta v2 parte dele.

## 2. Objetivos

1. Separar o protótipo em `index.html`, `styles.css`, `app.js` (mesmo comportamento).
2. Tornar o app um PWA instalável que funciona offline.
3. Permitir **vários diagnósticos por paciente**, cada um com **modificadores** ligáveis com um toque.
4. **Alertas automáticos por IG**, calculados a partir de regras (diagnóstico + modificadores + IG de hoje), em duas camadas: global (vem com o app) e do serviço (editável pela usuária).
5. Ao concluir uma pendência ou um alerta, registrar data e um **resultado em frase curta**, formando uma **linha do tempo** da internação.
6. Três saídas de relatório: **texto** (WhatsApp/e-mail), **PDF imprimível** no formato "ficha por leito", **planilha .xlsx**.

## 3. Não-objetivos (agora)

- Uso em equipe, login, sincronização entre aparelhos, servidor. Fica para uma fase 2, condicionada a revisão de LGPD com a instituição (DPO/comitê).
- IA lendo o caso. As "conferências" são regras pré-estabelecidas.
- Sugestão automática de ciclo de resgate de corticoide (pode entrar como regra do serviço).
- Notificações push.
- Integração com escala da residência.

## 4. Anti-objetivos (seria falha mesmo funcionando)

- Qualquer dado identificável da paciente (nome, iniciais, prontuário, nascimento, telefone, hospital) ou qualquer dado saindo do aparelho.
- Alerta clínico sem fonte visível. Toda regra global mostra de onde veio.
- Alerta que some depois de resolvido sem deixar rastro (quem recebe o plantão precisa ver que já foi feito e quando).
- Pendências duplicadas quando dois diagnósticos pedem a mesma coisa.
- Folha/texto de plantão com abreviações que um colega não entenda (no texto do Plantão e no PDF, modificadores por extenso).
- Perder dados de quem já usa a v1 ao atualizar.

## 5. Restrições

- **LGPD**: paciente identificada só pelo leito; observação livre ≤ 240 caracteres com aviso de não usar nomes; resultado de pendência ≤ 80 caracteres com o mesmo aviso. Dados apenas no navegador do aparelho.
- **Sem servidor.** Tudo roda no cliente; deve funcionar offline depois de instalado (inclusive geração de PDF e xlsx).
- **Celular primeiro**, modo claro/escuro (manter tokens `:root` e `data-theme` da v1).
- **Dependências**: a v1 só usa duas fontes do Google Fonts. Qualquer biblioteca nova (ex.: para xlsx) precisa ser servida localmente/cacheada pelo service worker para funcionar offline.
- **Migração**: dados existentes em `localStorage` sob `ronda-obstetrica-v1` devem ser migrados automaticamente para o novo formato sem perda.
- **Conteúdo clínico**: as regras globais deste documento são um rascunho com fonte. A usuária revisa antes de qualquer uso real; o app continua exibindo o aviso de que protocolos devem ser conferidos com os da instituição.
- **Atualização de 2026-11-07:** o `ronda.html` da v1 não existe mais. A v2 será construída **do zero**, seguindo a descrição da v1 (`RONDA_OBSTETRICA.md`, recriado a partir do texto da usuária) e este documento. Não há dados antigos de usuárias, então **a migração da v1 sai do escopo**, assim como o objetivo 1 (separar o arquivo único). Os itens deste documento sobre migração e backup JSON da v1 ficam sem efeito. O backup e a restauração em JSON **da própria v2** continuam valendo. A v2 já nasce dividida em `index.html`, `styles.css` e `app.js` (ou em mais módulos, a critério de quem constrói).

## 6. O que foi decidido

### 6.1 Diagnósticos e modificadores

- Uma paciente tem **um ou mais diagnósticos** (lista atual: dheg, dmg, tpp, rpmo, placenta, rcf, colestase, outro).
- Cada diagnóstico tem seus **modificadores**, ligáveis/desligáveis com **um toque direto no cartão do leito**, sem reabrir o cadastro. Eles mudam durante a internação (PE que passa a ter gravidade; DMG que passa a usar insulina) e os alertas são recalculados na hora.
- Modificadores definidos:
  - **DHEG**: tipo — pré-eclâmpsia · hipertensão gestacional · hipertensão crônica · HAC com PE sobreposta (escolha única); "com sinais de gravidade" (liga/desliga).
  - **DMG**: "em uso de medicação" (A2) · "controle glicêmico ruim" · "DM prévio (pré-gestacional)".
  - **RCF**: grau (escolha única) — PFE P3–P10 · PFE < P3 · IP AU > P95 com diástole presente · diástole zero · diástole reversa; "condição concomitante" (liga/desliga).
  - **Colestase**: "ácidos biliares ≥ 100 µmol/L".
  - **Placenta**: "suspeita de acretismo".
  - **TPP, RPMO, Outro**: sem modificadores por enquanto.
- No cartão: etiquetas curtas. No texto do Plantão e no PDF: por extenso (ex.: "DMG em uso de insulina, controle glicêmico ruim").
- Pendências de protocolos de diagnósticos diferentes não se duplicam (mesmo texto/categoria em aberto = um item só). A regra "Aplicar protocolo" da v1 continua.

### 6.2 Alertas por IG

- Duas camadas:
  - **Global**: vem embutida no app (atualiza junto com o app). Cada regra tem fonte.
  - **Do serviço**: texto editável pela usuária (mesmo espírito da aba Protocolos). Uma regra do serviço com o **mesmo identificador** de uma global **substitui** a global (não aparecem as duas). Regras do serviço com identificador novo se somam.
- Estados visuais de um alerta:
  - **Vermelho — agir**: janela aberta ou IG-alvo atingida.
  - **Amarelo — atenção**: janela se aproximando ou informação condicional (ex.: "<32 sem: MgSO₄ se indicar parto").
  - **Cinza — feito**: "Corticoide feito em 24/10". O alerta **não some**; passa a informativo com a data (e frase curta, se houver).
- Onde aparecem: cartão do leito, aba Hoje, texto do Plantão, PDF, xlsx.
- Um alerta pode virar pendência com um toque (ex.: "iniciar corticoide" entra na lista com prazo hoje).
- Registrar um alerta como feito pede data (padrão hoje) e frase curta opcional.
- **Múltiplos diagnósticos com IG-alvo diferentes**: o app mostra a **mais precoce como principal** e lista as demais abaixo, cada uma com sua fonte (seguindo o próprio ACOG CO 831: a condição complicadora tem precedência).

### 6.3 Pendências concluídas e linha do tempo

- Ao marcar uma pendência como feita: campo opcional de resultado em frase curta (≤ 80 caracteres, aviso de não usar nomes). Só tocar em "feito" também vale (registra data).
- O comportamento de recorrência da v1 continua (feito → cria próxima ocorrência; desmarcar remove a criada).
- A linha do tempo da paciente = internação + pendências concluídas + alertas registrados como feitos, em ordem de data, com o resultado curto.

### 6.4 Relatórios

- **Texto do Plantão** (já existe): mantém; passa a incluir diagnósticos com modificadores por extenso, alertas ativos e feitos, pendências de hoje/atrasadas, e uma linha do tempo resumida. Mesma ordem da ficha do PDF.
- **PDF — ficha por leito** (escolhido entre três modelos): A4, 4 a 6 fichas por folha. Topo da folha: enfermaria, data e hora de geração. Rodapé: aviso LGPD e lista das fontes dos alertas. Cada ficha:
  - cabeçalho: leito · IG de hoje · dia de internação (D7) · idade · G/P/C/A;
  - diagnósticos + modificadores; alergias em destaque;
  - alertas ativos (vermelho/amarelo) e feitos (cinza);
  - "Hoje": pendências do dia com caixinha para marcar à caneta; atrasadas em vermelho com dias de atraso;
  - "Já feito na internação": linha do tempo curta; se não couber, os mais recentes + "+N anteriores".
  - Deve ficar legível impresso em preto e branco (cor nunca é o único sinal: usar também texto/negrito).
- **Planilha .xlsx**: uma linha por leito; colunas: leito, idade, G/P/C/A, IG hoje, dia de internação, diagnósticos, modificadores, alergias, alertas ativos, alertas feitos (com data), pendências abertas, pendências atrasadas, observação. Sem dados identificáveis.
- Público dos relatórios: a própria usuária (conferir censo), o colega que recebe o plantão, chefia/preceptoria, e registro pessoal das internações ao longo do tempo.

### 6.5 Rascunho da camada global de regras

Fontes lidas na íntegra e salvas em `fontes/`:
- **RBEHG** — Peraçoli JC et al. *Pré-eclâmpsia – Protocolo 03, 2023.* (`RBEHG_Pre-eclampsia_Protocolo03_2023.pdf`)
- **DMG-BR** — OPAS/MS/FEBRASGO/SBD. *Cuidados obstétricos em diabetes mellitus gestacional no Brasil*, 2021. (`OPAS-MS-FEBRASGO-SBD_Cuidados_obstetricos_DMG_2021.pdf`)
- **ACOG** — ACOG/SMFM Committee Opinion 831, *Medically Indicated Late-Preterm and Early-Term Deliveries*, 2021 (interim update). (`ACOG_CO831_Momento_do_parto_2021.pdf` — direitos reservados: referência, não redistribuir com o app.)
- Salvo e **ainda não lido**: MS, *Manual de Gestação de Alto Risco*, 2022 (`MS_Manual_Gestacao_Alto_Risco_2022.pdf`).

Regra de prevalência da camada global: quando houver fonte brasileira, ela prevalece.

**Janelas transversais**

| id | Alerta | IG | Aplica a | Nível | Fonte |
|---|---|---|---|---|---|
| corticoide | Janela de corticoide — já recebeu ciclo? | 24+0 a 33+6 | tpp, rpmo, placenta, dheg+gravidade, rcf | vermelho | RBEHG p.41/44 (23–34); OMS 2022 24–34 (vista só em resumos) |
| mgso4-neuro | Se indicar parto: MgSO₄ para neuroproteção | < 32+0 | todos | amarelo | RBEHG p.34, 41 |

**Momento da resolução (vermelho ao atingir o início da faixa; amarelo 7 dias antes — chamada minha)**

| id | Condição | IG-alvo | Fonte |
|---|---|---|---|
| res-pe | PE sem gravidade | a partir de 37+0 | RBEHG p.39 (ACOG igual) |
| res-pe-grave | PE com gravidade, estável | 34–37: postergar se estável; avaliar ao termo | RBEHG p.41 ⚠️ ACOG diz 34+0 |
| res-hg | Hipertensão gestacional | ≥ 37+0 individualizar; não ultrapassar 39+6 | RBEHG p.42 |
| res-hac | HAC controlada com medicação | 37+0 a 39+6 | ACOG Tab.1 |
| res-dmg-a1 | DMG sem medicação, bom controle | 39+0 a 40+6 | DMG-BR fig.6.2 p.84 |
| res-dmg-a2 | DMG com medicação, bom controle | 39+0 a 39+6 | DMG-BR fig.6.2 |
| res-dmg-ruim | DMG controle ruim | 37+0 a 38+6 | DMG-BR fig.6.2 |
| res-dm-previo | DM prévio, bom controle | 38+0 a 39+6 | DMG-BR fig.6.2 |
| res-dm-previo-ruim | DM prévio, controle ruim | considerar até 37+0 | DMG-BR fig.6.2 |
| res-rcf-p3p10 | RCF PFE P3–P10 isolada | 38+0 a 39+0 | ACOG |
| res-rcf-p3 | RCF PFE < P3 ou IP AU > P95 com diástole | 37+0 | ACOG |
| res-rcf-dz | RCF diástole zero | 33+0 a 34+0 | ACOG |
| res-rcf-dr | RCF diástole reversa | 30+0 a 32+0 | ACOG |
| res-rcf-conc | RCF com condição concomitante | 34+0 a 37+6 | ACOG |
| res-colestase | Colestase, ácidos biliares < 100 | 36+0 a 39+0 | ACOG |
| res-colestase-100 | Colestase, ácidos biliares ≥ 100 | 36+0 | ACOG |
| res-rpmo | RPMO pré-termo | 34+0 a 36+6; não passar de 37+0 | ACOG (interim update) |
| res-previa | Placenta prévia | 36+0 a 37+6 | ACOG |
| res-acretismo | Suspeita de acretismo | 34+0 a 35+6 | ACOG |

**Pendências recorrentes disparadas por IG**

| id | Pendência | A partir de | Repetir | Fonte |
|---|---|---|---|---|
| ctg-dmg-a1 | CTG | 34+0 | 7 dias | DMG-BR p.73 |
| ctg-dmg-a2 | CTG | 32+0 | 7 dias | DMG-BR p.73 |
| ctg-dm-previo | CTG | 28+0 | 7 dias | DMG-BR p.75 |
| lab-pe | Hemograma/plaquetas, creatinina, TGO, DHL | internação | 7 dias | RBEHG p.25–26, 39 |

Lacunas conhecidas (ficam com ACOG até a usuária trazer a fonte): protocolo FEBRASGO de RPMO 2024 (link oficial retornou 404), protocolo FEBRASGO de RCF 2018, fonte brasileira para colestase.

### 6.6 O que já se sabe da v1 (do resumo da usuária)

- Chave `ronda-obstetrica-v1`; formato `{ v:1, prot:{dx:texto}, pac:[{ id, leito, idade, igDays, igRef, g,p,c,a, dx, int, alerg, obs, ex, pend:[{ id, texto, cat, due, rep, done, doneAt, spawn }] }] }`.
- IG guardada como `igDays` (IG em dias) na data `igRef`; IG de hoje = `igDays + (hoje − igRef)`. A v2 mantém isso.
- Protocolo em texto, uma linha por item: `texto | categoria | dias até o 1º prazo | repetir a cada N dias (0 = não)`.
- Recorrência: marcar feito cria a próxima ocorrência (hoje + rep); desmarcar remove a criada (`spawn`).
- "Aplicar protocolo" adiciona só o que ainda não existe em aberto.
- A aba Dados já tem backup/restauração em JSON (colar/restaurar) e "apagar tudo". **Backup JSON continua permitido** — é a usuária quem decide tirar o dado do aparelho, como ao enviar o texto do Plantão. O anti-objetivo se refere a envio automático/servidor, não a exportação feita por ela.
- **Migração**: se a v2 rodar na mesma origem da v1, migra sozinha do `localStorage`. Se a origem mudar (ex.: v1 aberta como arquivo local, v2 hospedada), a migração é pela restauração do backup JSON da v1, que a v2 deve aceitar e converter.
- Hospedagem (chamada minha): site estático em HTTPS (ex.: GitHub Pages) — exigido pelo service worker; o código não contém dado de paciente.

### 6.6.1 Alta/parto e plataformas (decisões da usuária)

- **Quando a paciente tem o parto ou recebe alta, ela sai do app.** Não existe arquivo de altas. O registro ao longo do tempo fica nos relatórios que a usuária exporta. Chamada minha: antes de remover, o app oferece gerar o texto ou o PDF da ficha daquela paciente.
- **Plataformas: iPhone (Safari) e Android (Chrome).** Os dois precisam funcionar como app instalado. PDF e xlsx saem pelo compartilhamento nativo do celular (Web Share API com arquivo), e o download direto fica como alternativa quando o compartilhamento não estiver disponível. O PDF também precisa funcionar pela impressão do navegador. Como o iOS pode apagar os dados do site, o app lembra periodicamente de fazer o backup em JSON (chamada minha).

### 6.7 Semântica das regras (chamadas minhas, a usuária pode rever)

- **Casamento de modificadores**: `dmg+medicacao` exige o modificador; `dmg!medicacao` exige a ausência. Dentro de um mesmo grupo de regras (os dois primeiros segmentos do id, ex. `res-dmg-a2` e `res-dmg-ruim` → grupo `res-dmg`; empates disparam todas), **a mais específica vence** (a que exige mais modificadores). Ex.: DMG com medicação e controle ruim → só `res-dmg-ruim`.
- HAC com PE sobreposta usa as regras de PE (o ACOG inclui sobreposta). HAC ganha um modificador "difícil controle" (ACOG: 36+0 a 37+6); sem ele, vale 37+0 a 39+6.
- "PE com gravidade, estável" vira duas regras: amarelo 34+0 ("postergar se estável, reavaliar diariamente") e vermelho 37+0.
- Hipertensão gestacional: amarelo 37+0 ("individualizar"), vermelho 39+6 ("não ultrapassar").
- **Depois do fim da janela**:
  - regras de resolução (`res-*`) continuam vermelhas, com o texto "IG-alvo ultrapassada em N dias";
  - janelas de tratamento (corticoide, MgSO₄) somem quando fecham. Se o corticoide não foi registrado, o alerta aparece uma única vez, em cinza: "janela encerrada sem registro".
- **Antecedência do amarelo**: é um campo opcional da regra (padrão de 7 dias nas `res-*` globais). Uma regra do serviço que substitui outra herda esse valor se deixar o campo vazio.
- **Pendências por IG** (CTG, labs): são criadas automaticamente quando a IG chega, sujeitas à deduplicação. Se o modificador mudar, por exemplo DMG A1 → A2, a série nova entra e a antiga não é apagada; a usuária remove se quiser. Uma pendência apagada por ela não volta a ser criada (o app guarda o id da regra dispensada). `lab-pe` vale para pré-eclâmpsia e HAC com PE sobreposta.

### 6.8 Rodada final — o que entrou (decisões da usuária)

- **IG pela DUM e pela 1ª USG.** Dois campos no cadastro:
  - **DUM:** a usuária informa a data.
  - **1ª USG:** a usuária informa a data do exame e a IG naquele dia.
  - O app calcula a IG de hoje pelas duas e mostra lado a lado.
  - Chamada minha: o app sugere qual usar seguindo a regra de datação do ACOG (Committee Opinion 700). A USG prevalece quando a diferença passa do limite para a IG em que foi feita: > 5 dias antes de 9+0; > 7 dias de 9+0 a 13+6; > 7 dias de 14+0 a 15+6; > 10 dias de 16+0 a 21+6; > 14 dias de 22+0 a 27+6; > 21 dias a partir de 28+0.
  - A usuária confirma qual vale. A IG escolhida alimenta `igDays`/`igRef`.
  - Basta um dos dois campos para cadastrar.
- **Exames com estado.** Pendência de categoria Exame passa por solicitado → aguardando resultado → visto. "Aguardando" aparece em destaque (cartão, Hoje, Plantão, PDF) até alguém registrar o resultado curto.
- **Contador de tratamento.** Pendência/item com duração ("Antibiótico", 7 dias; "MgSO₄", 24 h; "Corticoide", 2 doses) mostra o ponto em que está: "D3/7", "18h/24h", "2ª dose amanhã". Ao terminar, vira registro na linha do tempo. Durações em dias, horas ou doses.
- **Controles com faixas de alerta.** A usuária digita os valores; o app marca o que sai da faixa.
  - **DMG**: perfil glicêmico de 6 pontos por dia.
  - **Hipertensão**: registros de PA (sistólica/diastólica, quantos quiser por dia).
  - Faixas **definidas em protocolo** (camada global com fonte + camada do serviço editável em texto, mesma lógica de substituição por id). Globais iniciais: glicemia jejum < 95, 1h pós < 140, 2h pós < 120, qualquer valor < 70 = hipoglicemia (DMG-BR p.46); PA ≥ 160 e/ou ≥ 110 = crise hipertensiva (RBEHG p.10, 27); PA ≥ 140 e/ou ≥ 90 = hipertensão (RBEHG p.8).
  - Valor fora da faixa aparece em destaque no cartão, no modo visita, no Plantão e no PDF; crise hipertensiva/hipoglicemia = vermelho.
  - Formato de texto das faixas (chamada minha): `id | diagnóstico+modificadores | medida | limite | nível | mensagem | fonte`, ex. `glic-jejum | dmg | jejum | >=95 | amarelo | Jejum acima da meta | DMG-BR p.46`.
  - Valores são dados clínicos sem identificação; ficam só no aparelho e saem da ficha junto com a paciente na alta.
- **Modo visita.** Uma tela por leito, deslizando para o próximo, na ordem dos leitos. Mostra: cabeçalho (leito, IG, D), alertas, controles do dia (com campo para digitar), pendências de hoje/atrasadas/aguardando resultado, contadores. Ações com um toque: marcar feito (+ resultado curto), registrar valor, ligar modificador.
- **O que mudou desde ontem** (chamada minha, mantida até a usuária dizer o contrário). Por leito, destaca o que é novo desde o último Plantão gerado: modificador alterado, alerta aberto, resultado registrado, valor fora da faixa, pendência que atrasou. Aparece no topo do modo visita e numa seção do texto do Plantão.
- **Fora**: horário nas pendências (só data).

## 7. Modelo de dados (direção, não contrato)

Nova chave `ronda-obstetrica-v2`, migrando da v1:

- `pac[].dx` (string) → `pac[].dxs: [{ dx: "dheg", mods: { tipo: "pe", gravidade: true } }]`.
- `pac[].pend[]` ganha `res` (string ≤ 80) ao concluir.
- `pac[].alertasFeitos: [{ id: "corticoide", data: "2026-10-24", res: "" }]`.
- `regrasServico`: texto bruto editado pela usuária (as regras globais vivem no código, não no storage).
- Alertas ativos são **sempre calculados** (dxs + mods + IG de hoje + regras), nunca guardados.

## 8. Formato de texto das regras do serviço (chamada minha)

Uma regra por linha, campos separados por `|`, no estilo dos protocolos da v1:

```
id | diagnóstico+modificadores | IG início | IG fim | nível | mensagem | fonte | antecedência (dias, opcional) | repetir (dias, opcional → vira pendência recorrente)
res-colestase | colestase | 37+0 | 37+6 | vermelho | Resolução da colestase | Protocolo HU-X 2025
corticoide-resgate | tpp | 24+0 | 33+6 | amarelo | Avaliar ciclo de resgate (≥7 dias do 1º) | Protocolo HU-X
```

- `diagnóstico+modificadores`: ex. `dheg+gravidade`, `dmg+medicacao+controle-ruim`; vazio = todos.
- `IG fim` vazio = sem fim. IG em `semanas+dias`.
- Linha com `id` igual a uma regra global a substitui; `-id` sozinho desliga a regra global.
- Linhas inválidas são mostradas com o erro, sem quebrar o app.
- Um botão mostra a lista das regras globais nesse mesmo formato, para copiar e ajustar.

## 9. O que fica para quem constrói

- Mecanismo de geração do PDF (ex.: folha de estilo de impressão + `window.print()`, ou biblioteca) — desde que funcione offline no celular.
- Geração do .xlsx (biblioteca local ou SpreadsheetML/XLSX escrito à mão).
- Estratégia de cache do service worker e versionamento (atualização das regras globais = nova versão do app).
- Layout exato dos toques de modificador no cartão.
- Testes: testes automatizados para cálculo de IG, avaliação das regras (incluindo substituição/desligamento pela camada do serviço), deduplicação de pendências e migração v1→v2; teste manual real no celular.
