# Rumo ao Revalida

Aplicativo web para organizar os estudos do **Revalida (INEP)**. É um site estático: funciona em qualquer navegador, pode ser instalado no celular (PWA) e funciona sem internet.

## O que ele faz

**Temas e estudo**
- **84 temas** das 5 grandes áreas da prova (Clínica Médica, Cirurgia, Pediatria, Ginecologia e Obstetrícia, Medicina de Família e Preventiva), em Nível 1 (alta incidência), Nível 2 (média) e Nível 3 (complementar). Inclui emergências, doenças tropicais, hanseníase, psiquiatria, especialidades, trauma torácico, cirurgia pediátrica, ortopedia e indicadores de saúde.
- Em cada tema: explicação breve, onde estudar (protocolos do Ministério da Saúde, diretrizes, livros, provas anteriores), buscas de vídeo no YouTube e anotações.
- **Porcentagem estudada**: aula 20% · leitura/resumo 20% · questões 20% · revisões R1, R2 e R3 40%.
- **Revisão espaçada**: R1 em 24 h, R2 em 7 dias, R3 em 30 dias e depois manutenção a cada 60 dias, ajustada pelo seu acerto.

**Plano semanal automático**
- Você informa as horas disponíveis em cada dia da semana; o app monta os próximos 7 dias com revisões, caderno de erros, flashcards, um simulado por semana, temas em andamento, temas novos (Nível 1 primeiro, alternando áreas), reforço dos pontos fracos e questões mistas.
- O plano é recalculado sempre: se você pular um dia, o atraso passa para os dias seguintes. Ele avisa quando sua disponibilidade não comporta o ritmo necessário até a prova.

**Questões**
- **Caderno de erros**: registre o que a questão cobrava, por que errou (conteúdo, interpretação, desatenção ou chute) e o que precisa lembrar. Cada erro volta para revisão em 1, 7 e 30 dias até você acertá-lo 3 vezes seguidas.
- **Pontos fracos**: ranking dos temas com pior acerto (mínimo de 5 questões), pior última revisão e mais erros em aberto, com botão para reforçar. Também mostra o acerto por área.
- **Simulados**: registro da nota total e por área, gráfico da evolução com a linha da nota de corte e **cronômetro de simulado** com o ritmo ideal por questão.
- **Incidência**: ao resolver uma prova anterior inteira, registre quantas questões de cada tema caíram. O app calcula a média por prova e sugere o nível de cada tema. Não há contagens prontas porque não existe uma fonte oficial com esses números.

**Flashcards**
- Baralho inicial com 97 cartões de critérios, doses e classificações, mais os cartões que você criar. Repetição espaçada com as notas Errei, Difícil, Bom e Fácil, limite de cartões novos por dia e atalhos de teclado.

**Rotina**
- **Meta diária** de tempo e **cronômetro Pomodoro** (com o tema estudado). Opção de a sequência só contar quando a meta é atingida.
- **Sequência diária**, recorde, mapa das últimas 18 semanas, nível e XP.
- **Lembretes**: notificação no horário escolhido (app aberto ou instalado; no Android, também em segundo plano) e **calendário .ics** para adicionar ao Google Agenda ou ao calendário do iPhone com lembrete diário, dias de revisão e datas das provas.
- **Datas das provas** com contagem regressiva e ritmo sugerido, editáveis.
- **Sincronização entre aparelhos** (opcional, com Supabase) e **backup** em código ou arquivo.

## Datas cadastradas

| Edição | Etapa | Data | Situação |
|---|---|---|---|
| 2026.1 | 1ª etapa | 07/06/2026 | oficial |
| 2026.2 | 1ª etapa | 13/09/2026 | oficial (resultado definitivo previsto para 04/12/2026) |
| 2026.1 | 2ª etapa | 05/12/2026 | provável |
| 2026.2 | 2ª etapa | 15/05/2027 | provável |
| 2027.1 | 1ª etapa | 06/06/2027 | provável |
| 2027.2 | 1ª etapa | 12/09/2027 | provável |

As datas prováveis são estimativas feitas a partir das edições anteriores. Confirme sempre no [site do INEP](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/revalida) e ajuste no app.

## Publicar na Vercel

1. Em vercel.com/new, escolha **Import Git Repository** e este repositório.
2. **Framework Preset**: Other. Sem comando de build; diretório raiz `./`.
3. Se o código não estiver na branch padrão, ajuste em *Settings → Git → Production Branch*.
4. Clique em **Deploy**. O `vercel.json` já configura o service worker para atualizar sem cache.

## Sincronização (opcional)

Sem isto, o progresso fica só no navegador de cada aparelho (use o backup para levar de um para outro).

1. Crie um projeto gratuito em supabase.com.
2. Em **SQL Editor → New query**, cole o conteúdo de `supabase.sql` e clique em **Run**. Isso cria a tabela `progresso` com regras para que cada pessoa só veja os próprios dados.
3. Em **Authentication → URL Configuration**, coloque o endereço do seu site (ex.: `https://seu-projeto.vercel.app`) em **Site URL** e em **Redirect URLs**.
4. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
5. Cole os dois em `config.js` (vale para todo mundo que usar o seu site) ou na aba **Ajustes → Sincronização** do app (vale só para aquele navegador).
6. No app, informe seu e-mail, abra o link recebido no mesmo aparelho e repita em cada aparelho.

A chave anon é pública por natureza; a proteção dos dados vem das regras de segurança (RLS) do `supabase.sql`.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html`, `styles.css` | Estrutura e visual (tema claro e escuro automáticos) |
| `data.js` | Áreas, temas, resumos, fontes e calendário de provas |
| `cards.js` | Baralho inicial de flashcards |
| `core.js` | Estado salvo, datas, sequência, nível e eventos |
| `temas.js` | Progresso, revisões, lista de temas e detalhe do tema |
| `plano.js` | Plano semanal automático |
| `questoes.js` | Caderno de erros, pontos fracos, simulados e incidência |
| `flashcards.js` | Flashcards com repetição espaçada |
| `painel.js` | Painel, meta diária e Pomodoro |
| `ajustes.js` | Provas, ajustes, calendário .ics e backup |
| `sync.js`, `config.js`, `supabase.sql` | Sincronização entre aparelhos |
| `pwa.js`, `sw.js`, `manifest.webmanifest`, `icons/` | App instalável, modo offline e lembretes |

Para testar localmente com o modo offline, sirva a pasta por HTTP (por exemplo `python3 -m http.server`) e abra `http://localhost:8000`.
