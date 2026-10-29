// Temas: porcentagem estudada, revisão espaçada, lista por nível e gaveta de detalhe.

const INTERVALOS = [1, 7, 30];      // R1 em 24h, R2 em 7 dias, R3 em 30 dias
const MANUTENCAO = 60;              // depois da R3, revisão de manutenção a cada 60 dias
const PESOS = { aula: 20, leitura: 20, questoes: 20, revisoes: 40 };
const ETAPAS = [
  { k: "aula", t: "Assisti à aula / videoaula" },
  { k: "leitura", t: "Li o material e fiz meu resumo" },
  { k: "questoes", t: "Resolvi questões do tema" },
];

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
  if (acerto != null && acerto < 60) n = Math.max(1, Math.round(n / 2));  // errou muito: revisa antes
  else if (acerto != null && acerto >= 85) n = Math.round(n * 1.5);       // dominou: espaça mais
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
const temasPendentes = () => TEMAS.filter((t) => ["late", "today"].includes(estadoRevisao(t.id)));
const pendentesHoje = () => temasPendentes().length + errosPendentes().length;
function iniciarTema(st) {
  if (st.inicio) return false;
  st.inicio = hoje();
  st.prox = addDias(hoje(), INTERVALOS[0]);
  return true;
}

// ── Aba Temas ─────────────────────────────────────────────────
let filtro = { area: "todas", nivel: "todos", busca: "" };

VIEWS.temas = function renderTemas() {
  const b = filtro.busca.trim().toLowerCase();
  const lista = TEMAS.filter((t) =>
    (filtro.area === "todas" || t.area === filtro.area) &&
    (filtro.nivel === "todos" || String(t.nivel) === filtro.nivel) &&
    (!b || (t.nome + " " + t.resumo).toLowerCase().includes(b)));

  const el = $("#temas");
  if (!el.dataset.pronto) {
    el.innerHTML = `
      <div class="card" style="display:grid;gap:var(--s-3)">
        <div class="filters">
          <button class="chip" data-acao="filtro-area" data-v="todas">Todas as áreas</button>
          ${AREAS.map((a) => `<button class="chip" data-acao="filtro-area" data-v="${a.id}"><span class="dot" style="--c:${a.cor}"></span>${a.nome}</button>`).join("")}
        </div>
        <div class="filters">
          <button class="chip" data-acao="filtro-nivel" data-v="todos">Todos os níveis</button>
          ${Object.entries(NIVEIS).map(([k, n]) => `<button class="chip" data-acao="filtro-nivel" data-v="${k}">${n.nome}</button>`).join("")}
          <input id="busca" class="search" type="search" placeholder="Buscar tema (ex.: sífilis, ATLS)" aria-label="Buscar tema" data-digitar="busca-tema">
        </div>
      </div>
      <div id="lista-temas" style="display:grid;gap:var(--s-5)"></div>`;
    el.dataset.pronto = "1";
  }
  for (const c of el.querySelectorAll("[data-acao=filtro-area]")) c.setAttribute("aria-pressed", c.dataset.v === filtro.area);
  for (const c of el.querySelectorAll("[data-acao=filtro-nivel]")) c.setAttribute("aria-pressed", c.dataset.v === filtro.nivel);

  const grupos = [1, 2, 3].map((n) => ({ n, itens: lista.filter((t) => t.nivel === n) })).filter((g) => g.itens.length);
  $("#lista-temas").innerHTML = grupos.map((g) => `
    <div class="level-group">
      <header><h2>${NIVEIS[g.n].nome}</h2><span class="muted">${NIVEIS[g.n].desc} · ${plural(g.itens.length, "tema", "temas")} · ${pctGeral(g.itens)}% estudado</span></header>
      <div class="topics">${g.itens.map(cartaoTema).join("")}</div>
    </div>`).join("") || `<p class="empty">Nenhum tema encontrado com esses filtros.</p>`;
};
ACOES["filtro-area"] = (el) => { filtro.area = el.dataset.v; VIEWS.temas(); };
ACOES["filtro-nivel"] = (el) => { filtro.nivel = el.dataset.v; VIEWS.temas(); };
MUDANCAS["busca-tema"] = (el) => { filtro.busca = el.value; VIEWS.temas(); };

function cartaoTema(t) {
  const st = S.temas[t.id];
  const p = pct(t.id);
  const e = estadoRevisao(t.id);
  let pill = `<span class="pill new">não iniciado</span>`;
  if (st?.inicio) {
    const cls = e === "late" || e === "today" ? e : st.revisoes.length >= INTERVALOS.length ? "done" : "soon";
    pill = `<span class="pill ${cls}">${rotuloRevisao(st)} ${quando(st.prox)}</span>`;
  }
  const taxa = st?.qFeitas >= 5 ? Math.round((st.qAcertos / st.qFeitas) * 100) : null;
  return `<button class="topic" style="--c:${area(t.area).cor}" data-abrir="${t.id}">
    <span class="stripe"></span>
    <span style="min-width:0">
      <span class="name">${esc(t.nome)}</span>
      <span class="meta"><span>${area(t.area).nome}</span>${pill}${taxa != null ? `<span class="pill ${taxa < 60 ? "late" : "soon"}">${taxa}% de acerto</span>` : ""}</span>
      <span class="bar"><i style="width:${p}%"></i></span>
    </span>
    <span class="pct">${p}%</span>
  </button>`;
}

// ── Aba Revisões ──────────────────────────────────────────────
function itemAgenda(t) {
  const st = S.temas[t.id];
  const e = estadoRevisao(t.id);
  return `<div class="agenda-item">
    <span class="pill ${e}">${rotuloRevisao(st)}</span>
    <div class="t"><b>${esc(t.nome)}</b><div class="muted small">${area(t.area).nome} · ${quando(st.prox)}</div></div>
    <button class="btn small" data-abrir="${t.id}">Revisar</button>
  </div>`;
}
VIEWS.revisoes = function renderRevisoes() {
  const ativos = TEMAS.filter((t) => S.temas[t.id]?.prox).sort((a, b) => S.temas[a.id].prox.localeCompare(S.temas[b.id].prox));
  const atras = ativos.filter((t) => estadoRevisao(t.id) === "late");
  const hj = ativos.filter((t) => estadoRevisao(t.id) === "today");
  const semana = ativos.filter((t) => { const n = diff(hoje(), S.temas[t.id].prox); return n > 0 && n <= 7; });
  const depois = ativos.filter((t) => diff(hoje(), S.temas[t.id].prox) > 7);
  const erros = errosPendentes();
  const bloco = (titulo, l, vazio) => `<div class="card"><header><h3>${titulo}</h3><span class="muted num">${l.length}</span></header>
    <div class="agenda">${l.map(itemAgenda).join("") || `<p class="empty">${vazio}</p>`}</div></div>`;
  $("#revisoes").innerHTML = `
    <div class="card"><p class="note">Revisão espaçada: ao iniciar um tema, a 1ª revisão (R1) fica para o dia seguinte, a R2 para 7 dias depois e a R3 para 30 dias depois. Em seguida, revisões de manutenção a cada 60 dias. Se você acertar menos de 60% das questões na revisão, o próximo intervalo cai pela metade; acima de 85%, ele aumenta 50%.</p></div>
    ${bloco("Atrasadas", atras, "Nada atrasado.")}
    ${bloco("Hoje", hj, "Nenhuma revisão de tema para hoje.")}
    <div class="card"><header><h3>Caderno de erros para revisar</h3><span class="muted num">${erros.length}</span></header>
      <div class="agenda">${erros.slice(0, 6).map(itemErro).join("") || `<p class="empty">Nenhum erro para revisar hoje.</p>`}</div>
      ${erros.length > 6 ? `<button class="btn small" data-acao="ir" data-aba="questoes" style="margin-top:var(--s-2)">Ver todos os ${erros.length}</button>` : ""}
    </div>
    ${bloco("Próximos 7 dias", semana, "Nada agendado para esta semana.")}
    ${bloco("Mais adiante", depois, "Inicie temas para agendar revisões.")}`;
};
ACOES.ir = (el) => { if (aberto) fecharGaveta(false); irPara(el.dataset.aba); };

// ── Gaveta de detalhe do tema ─────────────────────────────────
let aberto = null;
function abrir(id) { aberto = id; renderGaveta(); }
function fecharGaveta(redesenhar = true) {
  aberto = null; $("#gaveta").hidden = true; $("#gaveta-bg").hidden = true;
  if (redesenhar) render();
}
const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

function renderGaveta() {
  const t = temaInfo(aberto);
  const st = T(t.id);
  const a = area(t.area);
  const p = pct(t.id);
  const taxa = st.qFeitas ? Math.round((st.qAcertos / st.qFeitas) * 100) : null;
  const videos = [
    [`Aula completa: ${t.nome}`, t.busca],
    [`Questões comentadas do Revalida`, `${t.nome} questões comentadas revalida INEP`],
    [`Resumo rápido para revisão`, `${t.nome} resumo revisão rápida`],
  ];
  const marcos = [...INTERVALOS.map((_, i) => `R${i + 1}`), "Manutenção"];
  const inc = incidenciaTema(t.id);
  const nCards = cardsDoTema(t.id).length;
  const nErros = S.erros.filter((e) => e.tema === t.id && !e.resolvido).length;
  const g = $("#gaveta");
  const rolagem = g.hidden ? 0 : g.scrollTop;
  g.innerHTML = `
    <button class="btn small close" data-acao="fechar-gaveta" aria-label="Fechar">Fechar</button>
    <div style="display:grid;gap:6px">
      <span class="eyebrow"><span class="dot" style="--c:${a.cor}"></span>${a.nome} · ${NIVEIS[t.nivel].nome}</span>
      <h2>${esc(t.nome)}</h2>
    </div>
    <div class="card" style="display:grid;gap:8px">
      <div class="row-between"><b>Quanto você estudou</b><span class="num" style="font-size:1.4rem;font-weight:700">${p}%</span></div>
      <div class="bar"><i style="width:${p}%;background:${a.cor}"></i></div>
      <div class="muted small">${st.minutos ? `${fmtMin(st.minutos)} cronometrados neste tema` : "Use o cronômetro do Painel escolhendo este tema para somar o tempo aqui."}</div>
    </div>
    <div style="display:grid;gap:8px">
      <h3>Em resumo</h3>
      <p class="resumo">${esc(t.resumo)}</p>
    </div>
    <div style="display:grid;gap:8px">
      <h3>Etapas de estudo</h3>
      <div class="steps">
        ${ETAPAS.map((e) => `<label class="step"><input type="checkbox" data-mudar="etapa" data-k="${e.k}" ${st[e.k] ? "checked" : ""}> ${e.t}<span class="w">+${PESOS[e.k]}%</span></label>`).join("")}
      </div>
    </div>
    <div class="card" style="display:grid;gap:10px">
      <div class="row-between">
        <h3>Revisões</h3>
        <span class="muted">${st.prox ? `Próxima (${rotuloRevisao(st)}): <b>${quando(st.prox)}</b>` : "Marque uma etapa para agendar a 1ª revisão."}</span>
      </div>
      <div class="timeline">${marcos.map((m, i) => `<span class="${st.revisoes.length > i ? "on" : ""}">${m}${st.revisoes[i] ? " · " + fmtCurto(st.revisoes[i].data) : ""}</span>`).join("")}</div>
      <p class="note">As revisões R1, R2 e R3 valem ${PESOS.revisoes}% do tema. Informe seu acerto nas questões da revisão para ajustar o próximo intervalo.</p>
      <div class="form-row">
        <label>Acerto na revisão (%)<input id="r-acerto" type="number" min="0" max="100" placeholder="opcional"></label>
        <button class="btn primary" data-acao="revisar" ${st.inicio ? "" : "disabled"}>Revisei hoje</button>
      </div>
    </div>
    <form class="card" id="form-questoes" style="display:grid;gap:10px">
      <div class="row-between">
        <h3>Questões</h3>
        <span class="muted num">${st.qFeitas ? `${st.qAcertos}/${st.qFeitas} · ${taxa}% de acerto` : "nenhuma registrada"}</span>
      </div>
      <div class="form-row">
        <label>Feitas<input id="q-feitas" type="number" min="1" placeholder="20" required></label>
        <label>Acertos<input id="q-acertos" type="number" min="0" placeholder="15" required></label>
        <label>Origem<select id="q-origem" data-mudar="q-origem">
          <option value="banco">Banco de questões</option>
          <option value="prova">Prova anterior do INEP (prova inteira)</option>
          <option value="simulado">Simulado</option>
        </select></label>
        <label id="q-edicao-l" hidden>Edição da prova<input id="q-edicao" list="lista-edicoes" placeholder="2024/1"></label>
        <button class="btn" type="submit">Registrar</button>
      </div>
      <p class="note">Ao registrar questões de uma prova anterior inteira, a quantidade também entra na incidência deste tema.</p>
    </form>
    <div class="card" style="display:grid;gap:10px">
      <div class="row-between">
        <h3>Incidência nas provas anteriores</h3>
        <span class="muted">${inc.provas ? `${inc.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} questões por prova · ${plural(inc.provas, "prova mapeada", "provas mapeadas")}` : "ainda sem dados"}</span>
      </div>
      ${inc.provas ? `<div class="timeline">${Object.entries(st.incid).sort().map(([ed, n]) => `<span class="on">${esc(ed)}: ${n}</span>`).join("")}</div>` : ""}
      <form class="form-row" id="form-incid">
        <label>Edição<input id="i-edicao" list="lista-edicoes" placeholder="2024/1" required></label>
        <label>Questões deste tema<input id="i-n" type="number" min="0" placeholder="3" required></label>
        <button class="btn" type="submit">Salvar</button>
      </form>
    </div>
    <div class="card" style="display:grid;gap:10px">
      <div class="row-between"><h3>Caderno de erros</h3><span class="muted">${plural(nErros, "erro em aberto", "erros em aberto")}</span></div>
      ${formErro("eg", t.id)}
    </div>
    <div class="row-between card">
      <div><b>Flashcards do tema</b><div class="muted small">${plural(nCards, "cartão", "cartões")}</div></div>
      <button class="btn" data-acao="cards-do-tema" data-tema="${t.id}" ${nCards ? "" : "disabled"}>Estudar cartões</button>
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
      <textarea id="notas" data-digitar="notas" placeholder="Pontos que você erra, mnemônicos, condutas..." class="texto">${esc(st.notas)}</textarea>
    </div>
    ${st.inicio ? `<button class="btn small danger" data-acao="zerar-tema" style="justify-self:start">Recomeçar este tema</button>` : ""}`;
  g.hidden = false;
  $("#gaveta-bg").hidden = false;
  g.scrollTop = rolagem;
}

ACOES["fechar-gaveta"] = () => fecharGaveta();
MUDANCAS.etapa = (el) => {
  const st = T(aberto);
  const k = el.dataset.k;
  st[k] = el.checked;
  if (el.checked) {
    registrar(XP.etapa);
    if (iniciarTema(st)) toast("Tema iniciado. 1ª revisão agendada para amanhã.");
    else toast(`+${XP.etapa} XP`);
  } else if (!ETAPAS.some((e) => st[e.k]) && !st.revisoes.length) {
    st.inicio = null; st.prox = null;
  }
  salvar(); renderGaveta();
};
ACOES.revisar = () => {
  const st = T(aberto);
  const v = $("#r-acerto").value;
  const acerto = v === "" ? null : Math.max(0, Math.min(100, Number(v)));
  st.revisoes.push({ data: hoje(), acerto });
  const n = intervalo(st, acerto);
  st.prox = addDias(hoje(), n);
  registrar(XP.revisao);
  salvar(); renderGaveta();
  toast(`Revisão registrada. Próxima em ${plural(n, "dia", "dias")}.`);
};
MUDANCAS["q-origem"] = (el) => { $("#q-edicao-l").hidden = el.value !== "prova"; };
ENVIOS["form-questoes"] = () => {
  const f = parseInt($("#q-feitas").value, 10), a = parseInt($("#q-acertos").value, 10);
  if (!(f > 0) || !(a >= 0) || a > f) { toast("Os acertos não podem passar do número de questões feitas."); return; }
  const st = T(aberto);
  st.qFeitas += f; st.qAcertos += a;
  if ($("#q-origem").value === "prova") {
    const ed = $("#q-edicao").value.trim();
    if (!ed) { st.qFeitas -= f; st.qAcertos -= a; toast("Informe a edição da prova (ex.: 2024/1)."); return; }
    st.incid[ed] = f;
  }
  st.questoes = true;
  iniciarTema(st);
  registrar(Math.round(a / 2) + 5);
  salvar(); renderGaveta();
  toast(`${a}/${f} registradas.`);
};
ENVIOS["form-incid"] = () => {
  const ed = $("#i-edicao").value.trim(), n = parseInt($("#i-n").value, 10);
  if (!ed || !(n >= 0)) return;
  T(aberto).incid[ed] = n;
  salvar(); renderGaveta(); toast("Incidência salva.");
};
MUDANCAS.notas = (el) => { T(aberto).notas = el.value; salvar(); };
ACOES["zerar-tema"] = (el) => confirmar(el, "tz", "Clique de novo para recomeçar", () => {
  const incid = S.temas[aberto]?.incid || {};
  delete S.temas[aberto]; T(aberto).incid = incid; // a incidência mapeada continua valendo
  salvar(); renderGaveta(); toast("Tema reiniciado.");
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && aberto) fecharGaveta(); });
