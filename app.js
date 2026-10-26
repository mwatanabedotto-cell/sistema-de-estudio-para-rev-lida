// Rumo ao Revalida — lógica do app. Tudo fica salvo no navegador (localStorage).

const CHAVE = "rumo-revalida-v1";
const INTERVALOS = [1, 7, 30];      // R1 em 24h, R2 em 7 dias, R3 em 30 dias
const MANUTENCAO = 60;              // depois da R3, revisão de manutenção a cada 60 dias
const PESOS = { aula: 20, leitura: 20, questoes: 20, revisoes: 40 };
const ETAPAS = [
  { k: "aula", t: "Assisti à aula / videoaula" },
  { k: "leitura", t: "Li o material e fiz meu resumo" },
  { k: "questoes", t: "Resolvi questões do tema" },
];
const XP = { etapa: 10, revisao: 20 };
const TITULOS = [
  [1, "Calouro"], [2, "Interno"], [4, "Residente R1"], [6, "Residente R2"],
  [8, "Residente R3"], [10, "Preceptor"], [13, "Pronto para o Revalida"],
];

// ── Datas (sempre no fuso local, formato AAAA-MM-DD) ───────────
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const hoje = () => iso(new Date());
const addDias = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000); // dias de a até b
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmt = (s) => { const d = parse(s); return `${String(d.getDate()).padStart(2, "0")} ${MESES[d.getMonth()]} ${d.getFullYear()}`; };
const fmtCurto = (s) => { const d = parse(s); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
const quando = (s) => {
  const n = diff(hoje(), s);
  if (n < 0) return `atrasada há ${-n} dia${n === -1 ? "" : "s"}`;
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  return `em ${n} dias (${fmtCurto(s)})`;
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ── Estado ─────────────────────────────────────────────────────
function estadoNovo() {
  return { v: 1, temas: {}, dias: {}, xp: 0, provas: PROVAS_PADRAO.map((p) => ({ ...p })), alvo: null, removidas: [] };
}
function carregar() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { s = null; }
  if (!s || s.v !== 1) s = estadoNovo();
  s.removidas = s.removidas || [];
  // Acrescenta provas novas do calendário padrão sem apagar as editadas pelo usuário.
  for (const p of PROVAS_PADRAO) {
    if (!s.provas.some((x) => x.id === p.id) && !s.removidas.includes(p.id)) s.provas.push({ ...p });
  }
  return s;
}
let S = carregar();
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) { /* armazenamento indisponível: o app segue funcionando nesta sessão */ }
}
const T = (id) => (S.temas[id] ||= { aula: false, leitura: false, questoes: false, inicio: null, prox: null, revisoes: [], qFeitas: 0, qAcertos: 0, notas: "" });
const temaInfo = (id) => TEMAS.find((t) => t.id === id);
const area = (id) => AREAS.find((a) => a.id === id);

// ── Progresso e revisões ──────────────────────────────────────
function pct(id) {
  const t = S.temas[id];
  if (!t) return 0;
  let p = 0;
  for (const e of ETAPAS) if (t[e.k]) p += PESOS[e.k];
  p += (Math.min(t.revisoes.length, INTERVALOS.length) / INTERVALOS.length) * PESOS.revisoes;
  return Math.round(p);
}
const iniciado = (id) => !!S.temas[id]?.inicio;
function pctGeral(lista = TEMAS) {
  if (!lista.length) return 0;
  return Math.round(lista.reduce((a, t) => a + pct(t.id), 0) / lista.length);
}
function intervalo(t, acerto) {
  const i = t.revisoes.length; // revisões já feitas, incluindo a de hoje
  let n = INTERVALOS[i] ?? MANUTENCAO;
  if (acerto != null && acerto < 60) n = Math.max(1, Math.round(n / 2));      // errou muito: revisa antes
  else if (acerto != null && acerto >= 85) n = Math.round(n * 1.5); // dominou: espaça mais
  return n;
}
function estadoRevisao(id) {
  const t = S.temas[id];
  if (!t?.prox) return null;
  const n = diff(hoje(), t.prox);
  return n < 0 ? "late" : n === 0 ? "today" : "soon";
}
function rotuloRevisao(t) {
  const i = t.revisoes.length;
  return i < INTERVALOS.length ? `R${i + 1}` : "Manutenção";
}

// ── Atividade, sequência e nível ──────────────────────────────
function registrar(xp) {
  const d = hoje();
  S.dias[d] = (S.dias[d] || 0) + 1;
  S.xp += xp;
}
function sequencia() {
  let d = hoje();
  if (!S.dias[d]) d = addDias(d, -1);
  let n = 0;
  while (S.dias[d]) { n++; d = addDias(d, -1); }
  return n;
}
function melhorSequencia() {
  const dias = Object.keys(S.dias).filter((d) => S.dias[d]).sort();
  let best = 0, cur = 0, prev = null;
  for (const d of dias) { cur = prev && diff(prev, d) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
  return best;
}
function nivel() {
  let L = 1, base = 0, custo = 100;
  while (S.xp >= base + custo) { base += custo; L++; custo = 100 + 50 * (L - 1); }
  const titulo = TITULOS.filter(([n]) => L >= n).pop()[1];
  return { L, titulo, dentro: S.xp - base, custo };
}

// ── Provas ────────────────────────────────────────────────────
const provasOrdenadas = () => [...S.provas].sort((a, b) => a.data.localeCompare(b.data));
function provaAlvo() {
  const futuras = provasOrdenadas().filter((p) => diff(hoje(), p.data) >= 0);
  return futuras.find((p) => p.id === S.alvo) || futuras.find((p) => p.etapa.startsWith("1ª")) || futuras[0] || null;
}

// ── Renderização ──────────────────────────────────────────────
const $ = (sel, el = document) => el.querySelector(sel);
const FOGO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 1.5s1 3.2-1.4 6.1C10 10.1 8 11.6 8 15a4 4 0 0 0 8 0c0-1.3-.5-2.4-1-3.2 2.1.9 4 3.3 4 6.2A7 7 0 0 1 5 18c0-5.2 3.4-7.3 5.4-10C12.6 5 13.5 1.5 13.5 1.5z"/></svg>`;
let filtro = { area: "todas", nivel: "todos", busca: "" };
let aba = "painel";

function render() {
  const seq = sequencia();
  $("#streak").innerHTML = `${FOGO}<span class="num">${seq}</span> dia${seq === 1 ? "" : "s"}`;
  $("#streak").title = S.dias[hoje()] ? "Você já estudou hoje" : "Estude hoje para manter a sequência";
  const pend = TEMAS.filter((t) => ["late", "today"].includes(estadoRevisao(t.id))).length;
  $("#badge-rev").textContent = pend;
  $("#badge-rev").hidden = !pend;
  for (const b of document.querySelectorAll(".tab")) b.setAttribute("aria-selected", b.dataset.aba === aba);
  for (const s of document.querySelectorAll("section[role=tabpanel]")) s.hidden = s.id !== aba;
  ({ painel: renderPainel, temas: renderTemas, revisoes: renderRevisoes, provas: renderProvas })[aba]();
}

function renderPainel() {
  const p = provaAlvo();
  const seq = sequencia();
  const nv = nivel();
  const naoIniciados = TEMAS.filter((t) => !iniciado(t.id));
  const pendentes = TEMAS.filter((t) => ["late", "today"].includes(estadoRevisao(t.id)));
  const sugerido = [...naoIniciados].sort((a, b) => a.nivel - b.nivel)[0];

  let ritmo = "";
  if (p) {
    const dias = diff(hoje(), p.data);
    const semanas = Math.max(1, dias / 7);
    ritmo = naoIniciados.length
      ? `Para começar os ${naoIniciados.length} temas restantes até lá: <b>${Math.ceil(naoIniciados.length / semanas)} tema${Math.ceil(naoIniciados.length / semanas) === 1 ? "" : "s"} novo${Math.ceil(naoIniciados.length / semanas) === 1 ? "" : "s"} por semana</b>, mais as revisões.`
      : "Todos os temas já foram iniciados. Foque nas revisões e em simulados.";
  }

  $("#painel").innerHTML = `
    <div class="hero">
      <div class="card countdown">
        ${p ? `
          <span class="eyebrow">Próxima prova · ${esc(p.edicao)}</span>
          <div class="big num">${diff(hoje(), p.data)}<small>dias</small></div>
          <div><b>${esc(p.etapa)}</b> · ${fmt(p.data)} <span class="tag">${p.tipo === "confirmada" ? "data oficial" : "data provável"}</span></div>
          <p class="pace">${ritmo}</p>
        ` : `<span class="eyebrow">Próxima prova</span><p>Nenhuma prova futura cadastrada. Adicione uma data na aba Provas.</p>`}
      </div>
      <div class="card stats">
        <div class="stat"><span class="eyebrow">Sequência</span><span class="v flame num">${seq}</span><span class="muted">${S.dias[hoje()] ? "dias seguidos · hoje ok" : seq ? "estude hoje para manter" : "comece hoje"}</span></div>
        <div class="stat"><span class="eyebrow">Recorde</span><span class="v num">${melhorSequencia()}</span><span class="muted">dias seguidos</span></div>
        <div class="stat"><span class="eyebrow">Estudado</span><span class="v num">${pctGeral()}%</span><span class="muted">de ${TEMAS.length} temas</span></div>
        <div class="stat"><span class="eyebrow">Nível ${nv.L}</span><span class="v" style="font-size:1.15rem">${nv.titulo}</span>
          <div class="level-bar" title="${nv.dentro} de ${nv.custo} XP"><i style="width:${(nv.dentro / nv.custo) * 100}%"></i></div>
          <span class="muted num" style="font-size:.8rem">${nv.dentro}/${nv.custo} XP</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <header><h3>Para hoje</h3><span class="muted">${pendentes.length} revis${pendentes.length === 1 ? "ão" : "ões"}</span></header>
        <div class="agenda">
          ${pendentes.slice(0, 5).map(itemAgenda).join("") || `<p class="empty">Nenhuma revisão pendente hoje.</p>`}
          ${sugerido ? `
            <div class="agenda-item">
              <span class="pill new">novo</span>
              <div class="t"><b>${esc(sugerido.nome)}</b><div class="muted" style="font-size:.82rem">Sugestão: ${area(sugerido.area).nome} · ${NIVEIS[sugerido.nivel].nome}</div></div>
              <button class="btn small primary" data-abrir="${sugerido.id}">Estudar</button>
            </div>` : ""}
        </div>
      </div>
      <div class="card">
        <header><h3>Sequência diária</h3><span class="muted">últimas 18 semanas</span></header>
        ${heatmap()}
      </div>
    </div>

    <div class="card">
      <header><h3>Progresso por área</h3><span class="muted">média dos temas</span></header>
      <div class="area-rows">
        ${AREAS.map((a) => {
          const l = TEMAS.filter((t) => t.area === a.id);
          const v = pctGeral(l);
          return `<div class="area-row" style="--c:${a.cor}">
            <span><span class="dot"></span><b>${a.nome}</b> <span class="muted" style="font-size:.82rem">${l.filter((t) => iniciado(t.id)).length}/${l.length} iniciados</span></span>
            <span class="num">${v}%</span>
            <div class="bar"><i style="width:${v}%"></i></div></div>`;
        }).join("")}
      </div>
    </div>`;
}

function heatmap() {
  const semanas = 18;
  const fim = hoje();
  // Colunas = semanas (domingo a sábado); a última coluna termina hoje.
  const inicio = addDias(fim, -parse(fim).getDay() - (semanas - 1) * 7);
  let cells = "";
  for (let d = inicio; diff(d, fim) >= 0; d = addDias(d, 1)) {
    const n = S.dias[d] || 0;
    const l = n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : 3;
    cells += `<i data-l="${l}" class="${d === fim ? "today" : ""}" title="${fmt(d)}: ${n} atividade${n === 1 ? "" : "s"}"></i>`;
  }
  return `<div class="heat" role="img" aria-label="Dias estudados nas últimas ${semanas} semanas">${cells}</div>
    <div class="heat-legend">menos <i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i> mais
    <span style="margin-left:auto">Qualquer etapa ou revisão marcada conta o dia.</span></div>`;
}

function itemAgenda(t) {
  const st = S.temas[t.id];
  const e = estadoRevisao(t.id);
  return `<div class="agenda-item">
    <span class="pill ${e}">${rotuloRevisao(st)}</span>
    <div class="t"><b>${esc(t.nome)}</b><div class="muted" style="font-size:.82rem">${area(t.area).nome} · ${quando(st.prox)}</div></div>
    <button class="btn small" data-abrir="${t.id}">Revisar</button>
  </div>`;
}

function renderTemas() {
  const b = filtro.busca.trim().toLowerCase();
  const lista = TEMAS.filter((t) =>
    (filtro.area === "todas" || t.area === filtro.area) &&
    (filtro.nivel === "todos" || String(t.nivel) === filtro.nivel) &&
    (!b || (t.nome + " " + t.resumo).toLowerCase().includes(b)));

  const el = $("#temas");
  if (!el.dataset.pronto) {
    el.innerHTML = `
      <div class="card" style="display:grid;gap:var(--s-3)">
        <div class="filters" id="f-area">
          <button class="chip" data-area="todas">Todas as áreas</button>
          ${AREAS.map((a) => `<button class="chip" data-area="${a.id}"><span class="dot" style="--c:${a.cor}"></span>${a.nome}</button>`).join("")}
        </div>
        <div class="filters">
          <span id="f-nivel" class="filters">
            <button class="chip" data-nivel="todos">Todos os níveis</button>
            ${Object.entries(NIVEIS).map(([k, n]) => `<button class="chip" data-nivel="${k}">${n.nome}</button>`).join("")}
          </span>
          <input id="busca" class="search" type="search" placeholder="Buscar tema (ex.: sífilis, ATLS)" aria-label="Buscar tema">
        </div>
      </div>
      <div id="lista-temas" style="display:grid;gap:var(--s-5)"></div>`;
    el.dataset.pronto = "1";
    $("#busca").addEventListener("input", (e) => { filtro.busca = e.target.value; renderTemas(); });
  }
  for (const c of el.querySelectorAll("[data-area]")) c.setAttribute("aria-pressed", c.dataset.area === filtro.area);
  for (const c of el.querySelectorAll("[data-nivel]")) c.setAttribute("aria-pressed", c.dataset.nivel === filtro.nivel);

  const grupos = [1, 2, 3].map((n) => ({ n, itens: lista.filter((t) => t.nivel === n) })).filter((g) => g.itens.length);
  $("#lista-temas").innerHTML = grupos.map((g) => `
    <div class="level-group">
      <header><h2>${NIVEIS[g.n].nome}</h2><span class="muted">${NIVEIS[g.n].desc} · ${pctGeral(g.itens)}% estudado</span></header>
      <div class="topics">${g.itens.map(cartaoTema).join("")}</div>
    </div>`).join("") || `<p class="empty">Nenhum tema encontrado com esses filtros.</p>`;
}

function cartaoTema(t) {
  const st = S.temas[t.id];
  const p = pct(t.id);
  const e = estadoRevisao(t.id);
  let pill = `<span class="pill new">não iniciado</span>`;
  if (st?.inicio) {
    pill = e === "late" || e === "today"
      ? `<span class="pill ${e}">${rotuloRevisao(st)} ${quando(st.prox)}</span>`
      : `<span class="pill ${st.revisoes.length >= INTERVALOS.length ? "done" : "soon"}">${rotuloRevisao(st)} ${quando(st.prox)}</span>`;
  }
  return `<button class="topic" style="--c:${area(t.area).cor}" data-abrir="${t.id}">
    <span class="stripe"></span>
    <span style="min-width:0">
      <span class="name">${esc(t.nome)}</span>
      <span class="meta"><span>${area(t.area).nome}</span>${pill}</span>
      <span class="bar"><i style="width:${p}%"></i></span>
    </span>
    <span class="pct">${p}%</span>
  </button>`;
}

function renderRevisoes() {
  const ativos = TEMAS.filter((t) => S.temas[t.id]?.prox).sort((a, b) => S.temas[a.id].prox.localeCompare(S.temas[b.id].prox));
  const atras = ativos.filter((t) => estadoRevisao(t.id) === "late");
  const hj = ativos.filter((t) => estadoRevisao(t.id) === "today");
  const semana = ativos.filter((t) => { const n = diff(hoje(), S.temas[t.id].prox); return n > 0 && n <= 7; });
  const depois = ativos.filter((t) => diff(hoje(), S.temas[t.id].prox) > 7);
  const bloco = (titulo, l, vazio) => `<div class="card"><header><h3>${titulo}</h3><span class="muted num">${l.length}</span></header>
    <div class="agenda">${l.map(itemAgenda).join("") || `<p class="empty">${vazio}</p>`}</div></div>`;
  $("#revisoes").innerHTML = `
    <div class="card"><p class="note">Revisão espaçada: ao iniciar um tema, a 1ª revisão (R1) fica para o dia seguinte, a R2 para 7 dias depois e a R3 para 30 dias depois. Em seguida, revisões de manutenção a cada 60 dias. Se você acertar menos de 60% das questões na revisão, o próximo intervalo cai pela metade; acima de 85%, ele aumenta 50%.</p></div>
    ${bloco("Atrasadas", atras, "Nada atrasado.")}
    ${bloco("Hoje", hj, "Nenhuma revisão para hoje.")}
    ${bloco("Próximos 7 dias", semana, "Nada agendado para esta semana.")}
    ${bloco("Mais adiante", depois, "Inicie temas para agendar revisões.")}`;
}

function renderProvas() {
  const alvo = provaAlvo();
  $("#provas").innerHTML = `
    <div class="card">
      <header><h3>Calendário do Revalida (INEP)</h3><a href="https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/revalida" target="_blank" rel="noopener">Ver editais no site do INEP</a></header>
      <p class="note" style="margin-bottom:var(--s-3)">O Revalida tem duas edições por ano. A 1ª etapa é a prova teórica e a 2ª etapa é a prova de habilidades clínicas, só para quem foi aprovado na 1ª. Datas marcadas como “provável” são estimativas feitas a partir das edições anteriores: confirme sempre no edital e ajuste aqui.</p>
      <div class="exam-list">
        ${provasOrdenadas().map((p) => {
          const d = parse(p.data);
          const passada = diff(hoje(), p.data) < 0;
          return `<div class="exam ${passada ? "past" : ""} ${alvo && alvo.id === p.id ? "target" : ""}">
            <div class="date"><b>${String(d.getDate()).padStart(2, "0")}</b>${MESES[d.getMonth()]} ${d.getFullYear()}</div>
            <div style="min-width:0">
              <b>${esc(p.edicao)}</b> · ${esc(p.etapa)}
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin:3px 0">
                <span class="pill ${p.tipo === "confirmada" ? "done" : "soon est"}">${p.tipo === "confirmada" ? "data oficial" : "data provável"}</span>
                <span class="pill soon">${passada ? "realizada" : diff(hoje(), p.data) === 0 ? "é hoje" : `faltam ${diff(hoje(), p.data)} dias`}</span>
              </div>
              <div class="muted" style="font-size:.85rem">${esc(p.obs)}</div>
            </div>
            <div class="actions">
              ${passada ? "" : `<button class="btn small ${alvo && alvo.id === p.id ? "primary" : ""}" data-alvo="${p.id}">${alvo && alvo.id === p.id ? "Minha meta" : "Definir como meta"}</button>`}
              <button class="btn small" data-editar="${p.id}">Editar</button>
              <button class="btn small danger" data-remover="${p.id}">Remover</button>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>
    <form class="card" id="form-prova" style="display:grid;gap:var(--s-3)">
      <h3 id="form-titulo">Adicionar ou corrigir data</h3>
      <input type="hidden" id="p-id">
      <div class="form-row">
        <label>Edição<input id="p-edicao" required placeholder="Revalida 2027.1"></label>
        <label>Etapa<select id="p-etapa"><option>1ª etapa (teórica)</option><option>2ª etapa (habilidades clínicas)</option><option>Inscrições</option><option>Resultado</option></select></label>
        <label>Data<input id="p-data" type="date" required></label>
        <label>Situação<select id="p-tipo"><option value="estimativa">Data provável</option><option value="confirmada">Data oficial (edital)</option></select></label>
      </div>
      <label class="form-row" style="display:grid"><span class="muted" style="font-size:.82rem;font-weight:700">Observação</span><input id="p-obs" placeholder="Ex.: edital publicado no DOU em..." style="padding:7px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface)"></label>
      <div style="display:flex;gap:var(--s-2)"><button class="btn primary" type="submit">Salvar data</button><button class="btn" type="reset" id="p-cancelar">Limpar</button></div>
    </form>
    <div class="card" style="display:grid;gap:var(--s-3)">
      <header><h3>Backup do progresso</h3></header>
      <p class="note">Seu progresso fica salvo só neste navegador. Copie o código abaixo para guardar ou levar para outro aparelho, e cole-o lá para restaurar.</p>
      <textarea id="backup" aria-label="Código de backup" spellcheck="false"></textarea>
      <div style="display:flex;gap:var(--s-2);flex-wrap:wrap">
        <button class="btn" id="b-gerar">Gerar código</button>
        <button class="btn" id="b-copiar">Copiar</button>
        <button class="btn" id="b-importar">Restaurar do código colado</button>
        <button class="btn danger" id="b-zerar">Apagar todo o progresso</button>
      </div>
    </div>`;
}

// ── Gaveta de detalhe do tema ─────────────────────────────────
let aberto = null;
function abrir(id) { aberto = id; renderGaveta(); }
function fechar() { aberto = null; $("#gaveta").hidden = true; $("#gaveta-bg").hidden = true; render(); }
function renderGaveta() {
  const t = temaInfo(aberto);
  const st = S.temas[t.id] || T(t.id);
  const a = area(t.area);
  const p = pct(t.id);
  const taxa = st.qFeitas ? Math.round((st.qAcertos / st.qFeitas) * 100) : null;
  const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  const videos = [
    [`Aula completa: ${t.nome}`, t.busca],
    [`Questões comentadas do Revalida`, `${t.nome} questões comentadas revalida INEP`],
    [`Resumo rápido para revisão`, `${t.nome} resumo revisão rápida`],
  ];
  const marcos = [...INTERVALOS.map((_, i) => `R${i + 1}`), "Manutenção"];
  const g = $("#gaveta");
  g.innerHTML = `
    <button class="btn small close" id="fechar" aria-label="Fechar">Fechar</button>
    <div style="display:grid;gap:6px">
      <span class="eyebrow"><span class="dot" style="--c:${a.cor}"></span>${a.nome} · ${NIVEIS[t.nivel].nome}</span>
      <h2>${esc(t.nome)}</h2>
    </div>
    <div class="card" style="display:grid;gap:8px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><b>Quanto você estudou</b><span class="num" style="font-size:1.4rem;font-weight:700">${p}%</span></div>
      <div class="bar"><i style="width:${p}%;background:${a.cor}"></i></div>
    </div>
    <div style="display:grid;gap:8px">
      <h3>Em resumo</h3>
      <p class="resumo">${esc(t.resumo)}</p>
    </div>
    <div style="display:grid;gap:8px">
      <h3>Etapas de estudo</h3>
      <div class="steps">
        ${ETAPAS.map((e) => `<label class="step"><input type="checkbox" data-etapa="${e.k}" ${st[e.k] ? "checked" : ""}> ${e.t}<span class="w">+${PESOS[e.k]}%</span></label>`).join("")}
      </div>
    </div>
    <div class="card" style="display:grid;gap:10px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline">
        <h3>Revisões</h3>
        <span class="muted">${st.prox ? `Próxima (${rotuloRevisao(st)}): <b>${quando(st.prox)}</b>` : "Marque uma etapa para agendar a 1ª revisão."}</span>
      </div>
      <div class="timeline">${marcos.map((m, i) => `<span class="${st.revisoes.length > i ? "on" : ""}">${m}${st.revisoes[i] ? " · " + fmtCurto(st.revisoes[i].data) : ""}</span>`).join("")}</div>
      <p class="note">As revisões R1, R2 e R3 valem ${PESOS.revisoes}% do tema. Informe seu acerto nas questões da revisão para ajustar o próximo intervalo.</p>
      <div class="form-row">
        <label>Acerto na revisão (%)<input id="r-acerto" type="number" min="0" max="100" placeholder="opcional"></label>
        <button class="btn primary" id="r-feita" ${st.inicio ? "" : "disabled"}>Revisei hoje</button>
      </div>
    </div>
    <div class="card" style="display:grid;gap:10px">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline">
        <h3>Questões</h3>
        <span class="muted num">${st.qFeitas ? `${st.qAcertos}/${st.qFeitas} · ${taxa}% de acerto` : "nenhuma registrada"}</span>
      </div>
      <div class="form-row">
        <label>Feitas<input id="q-feitas" type="number" min="1" placeholder="20"></label>
        <label>Acertos<input id="q-acertos" type="number" min="0" placeholder="15"></label>
        <button class="btn" id="q-add">Registrar</button>
      </div>
    </div>
    <div style="display:grid;gap:8px">
      <h3>Onde estudar</h3>
      <ul class="links">
        ${t.fontes.map((f) => `<li>${f.u ? `<a href="${f.u}" target="_blank" rel="noopener">${esc(f.t)}</a>` : esc(f.t)}</li>`).join("")}
        <li><a href="${F.provas.u}" target="_blank" rel="noopener">${F.provas.t}</a>: filtre as questões deste tema.</li>
      </ul>
    </div>
    <div style="display:grid;gap:8px">
      <h3>Vídeos recomendados</h3>
      <ul class="links">
        ${videos.map(([rot, q]) => `<li><a href="${yt(q)}" target="_blank" rel="noopener">${esc(rot)}</a> <span class="muted">· busca no YouTube</span></li>`).join("")}
      </ul>
      <p class="note">Dê preferência a aulas recentes (protocolos mudam) e de professores ou cursinhos voltados ao Revalida e à residência. Assista em velocidade 1,25× a 1,5× e pause para fazer seu resumo.</p>
    </div>
    <div style="display:grid;gap:8px">
      <h3>Minhas anotações</h3>
      <textarea id="notas" placeholder="Pontos que você erra, mnemônicos, condutas..." style="font-family:var(--f-body);font-size:.95rem">${esc(st.notas)}</textarea>
    </div>
    ${st.inicio ? `<button class="btn small danger" id="t-zerar" style="justify-self:start">Recomeçar este tema</button>` : ""}`;
  g.hidden = false;
  $("#gaveta-bg").hidden = false;
}

// ── Ações ─────────────────────────────────────────────────────
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2400);
}
function marcarEtapa(k, v) {
  const st = T(aberto);
  st[k] = v;
  if (v) {
    registrar(XP.etapa);
    if (!st.inicio) { st.inicio = hoje(); st.prox = addDias(hoje(), INTERVALOS[0]); toast("Tema iniciado. 1ª revisão agendada para amanhã."); }
    else toast(`+${XP.etapa} XP`);
  } else if (!ETAPAS.some((e) => st[e.k]) && !st.revisoes.length) {
    st.inicio = null; st.prox = null;
  }
  salvar(); renderGaveta();
}
function revisar() {
  const st = T(aberto);
  const v = $("#r-acerto").value;
  const acerto = v === "" ? null : Math.max(0, Math.min(100, Number(v)));
  st.revisoes.push({ data: hoje(), acerto });
  const n = intervalo(st, acerto);
  st.prox = addDias(hoje(), n);
  registrar(XP.revisao);
  salvar(); renderGaveta();
  toast(`Revisão registrada. Próxima em ${n} dia${n === 1 ? "" : "s"}.`);
}
function addQuestoes() {
  const f = parseInt($("#q-feitas").value, 10), a = parseInt($("#q-acertos").value, 10);
  if (!(f > 0) || !(a >= 0) || a > f) { toast("Informe questões feitas e acertos (acertos não podem passar das feitas)."); return; }
  const st = T(aberto);
  st.qFeitas += f; st.qAcertos += a;
  if (!st.questoes) { st.questoes = true; if (!st.inicio) { st.inicio = hoje(); st.prox = addDias(hoje(), INTERVALOS[0]); } }
  registrar(Math.round(a / 2) + 5);
  salvar(); renderGaveta();
  toast(`${a}/${f} registradas.`);
}

let confirmando = null; // confirmação em dois cliques para ações destrutivas
function confirmar(btn, chave, rotulo, acao) {
  if (confirmando === chave) { confirmando = null; acao(); return; }
  confirmando = chave;
  btn.textContent = rotulo;
  setTimeout(() => { if (confirmando === chave) { confirmando = null; render(); if (aberto) renderGaveta(); } }, 4000);
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("button, [data-abrir]");
  if (!el) return;
  if (el.matches(".tab")) { aba = el.dataset.aba; try { history.replaceState(null, "", "#" + aba); } catch (_) {} render(); return; }
  if (el.dataset.abrir) { abrir(el.dataset.abrir); return; }
  if (el.dataset.area) { filtro.area = el.dataset.area; renderTemas(); return; }
  if (el.dataset.nivel) { filtro.nivel = el.dataset.nivel; renderTemas(); return; }
  if (el.dataset.alvo) { S.alvo = el.dataset.alvo; salvar(); render(); toast("Prova definida como meta."); return; }
  if (el.dataset.editar) {
    const p = S.provas.find((x) => x.id === el.dataset.editar);
    $("#p-id").value = p.id; $("#p-edicao").value = p.edicao; $("#p-etapa").value = p.etapa;
    $("#p-data").value = p.data; $("#p-tipo").value = p.tipo; $("#p-obs").value = p.obs || "";
    $("#form-titulo").textContent = `Editando: ${p.edicao} · ${p.etapa}`;
    $("#form-prova").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (el.dataset.remover) {
    const id = el.dataset.remover;
    confirmar(el, "rm-" + id, "Confirmar remoção", () => {
      S.provas = S.provas.filter((x) => x.id !== id);
      if (PROVAS_PADRAO.some((p) => p.id === id)) S.removidas.push(id);
      salvar(); render(); toast("Data removida.");
    });
    return;
  }
  switch (el.id) {
    case "fechar": fechar(); break;
    case "r-feita": revisar(); break;
    case "q-add": addQuestoes(); break;
    case "t-zerar":
      confirmar(el, "tz", "Clique de novo para recomeçar", () => { delete S.temas[aberto]; salvar(); renderGaveta(); toast("Tema reiniciado."); });
      break;
    case "b-gerar": $("#backup").value = JSON.stringify(S); toast("Código gerado."); break;
    case "b-copiar": {
      const ta = $("#backup");
      if (!ta.value) ta.value = JSON.stringify(S);
      navigator.clipboard?.writeText(ta.value).then(() => toast("Código copiado."), () => { ta.select(); toast("Selecionei o código: copie com Ctrl+C."); })
        ?? (ta.select(), toast("Selecionei o código: copie com Ctrl+C."));
      break;
    }
    case "b-importar": {
      let novo;
      try { novo = JSON.parse($("#backup").value); } catch (_) { novo = null; }
      if (!novo || novo.v !== 1 || typeof novo.temas !== "object") { toast("Código inválido. Cole o código completo gerado pelo app."); break; }
      confirmar(el, "imp", "Substituir progresso atual?", () => { S = novo; S.removidas ||= []; salvar(); render(); toast("Progresso restaurado."); });
      break;
    }
    case "b-zerar":
      confirmar(el, "zerar", "Clique de novo para apagar tudo", () => { S = estadoNovo(); salvar(); render(); toast("Progresso apagado."); });
      break;
  }
});
document.addEventListener("change", (e) => {
  if (e.target.dataset.etapa) marcarEtapa(e.target.dataset.etapa, e.target.checked);
});
document.addEventListener("input", (e) => {
  if (e.target.id === "notas") { T(aberto).notas = e.target.value; salvar(); }
});
document.addEventListener("submit", (e) => {
  if (e.target.id !== "form-prova") return;
  e.preventDefault();
  const id = $("#p-id").value || "u-" + Date.now();
  const dados = { id, edicao: $("#p-edicao").value.trim(), etapa: $("#p-etapa").value, data: $("#p-data").value, tipo: $("#p-tipo").value, obs: $("#p-obs").value.trim() };
  const i = S.provas.findIndex((x) => x.id === id);
  if (i >= 0) S.provas[i] = dados; else S.provas.push(dados);
  salvar(); render(); toast("Data salva.");
});
document.addEventListener("reset", (e) => {
  if (e.target.id === "form-prova") { $("#p-id").value = ""; $("#form-titulo").textContent = "Adicionar ou corrigir data"; }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && aberto) fechar(); });
$("#gaveta-bg").addEventListener("click", fechar);

const inicial = (location.hash || "").slice(1);
if (["painel", "temas", "revisoes", "provas"].includes(inicial)) aba = inicial;
render();
