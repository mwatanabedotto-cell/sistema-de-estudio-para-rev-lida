// Flashcards com repetição espaçada (variação simples do SM-2).

const todosCards = () => [...CARDS, ...S.cardsUser];
const cardsDoTema = (id) => todosCards().filter((c) => c.tema === id);
let filtroCards = { area: "todas", tema: "" };
let sessao = null; // { fila: [ids], virado: bool, feitos: n }

function novosHoje() {
  if (S.cardsHoje.data !== hoje()) S.cardsHoje = { data: hoje(), novos: 0 };
  return S.cardsHoje.novos;
}
function cardsFiltrados() {
  return todosCards().filter((c) => {
    if (filtroCards.tema) return c.tema === filtroCards.tema;
    return filtroCards.area === "todas" || temaInfo(c.tema)?.area === filtroCards.area;
  });
}
function filaCards() {
  const l = cardsFiltrados();
  const vencidos = l.filter((c) => S.cards[c.id]?.prox && diff(hoje(), S.cards[c.id].prox) <= 0)
    .sort((a, b) => S.cards[a.id].prox.localeCompare(S.cards[b.id].prox));
  const livres = Math.max(0, S.cfg.novosCardsDia - novosHoje());
  // Novos seguem o nível do tema: primeiro o que mais cai.
  const novos = l.filter((c) => !S.cards[c.id]).sort((a, b) => (temaInfo(a.tema)?.nivel || 3) - (temaInfo(b.tema)?.nivel || 3)).slice(0, livres);
  return { vencidos, novos };
}
function cardsVencidosHoje() {
  return todosCards().filter((c) => S.cards[c.id]?.prox && diff(hoje(), S.cards[c.id].prox) <= 0).length;
}
function proximoIntervalo(id, nota) {
  const st = S.cards[id] || { int: 0, ease: 2.5, reps: 0 };
  if (nota === 0) return 1;
  if (st.reps === 0) return [1, 1, 1, 4][nota];
  if (st.reps === 1) return [1, 3, 6, 8][nota];
  return Math.max(1, Math.round(st.int * (nota === 1 ? 1.2 : nota === 2 ? st.ease : st.ease * 1.3)));
}
function avaliar(id, nota) {
  const novo = !S.cards[id];
  const st = S.cards[id] || { int: 0, ease: 2.5, reps: 0, lapsos: 0 };
  st.int = proximoIntervalo(id, nota);
  st.ease = Math.max(1.3, st.ease + [-0.2, -0.15, 0, 0.15][nota]);
  if (nota === 0) { st.reps = 0; st.lapsos = (st.lapsos || 0) + 1; } else st.reps++;
  st.prox = addDias(hoje(), st.int);
  S.cards[id] = st;
  if (novo) { novosHoje(); S.cardsHoje.novos++; }
  registrar(XP.card);
}
const rotuloInt = (n) => (n === 1 ? "1 dia" : n < 30 ? `${n} dias` : `${Math.round(n / 30)} m`);

VIEWS.flashcards = function renderFlashcards() {
  const { vencidos, novos } = filaCards();
  const l = cardsFiltrados();
  const meus = S.cardsUser;
  let corpo;
  if (sessao && sessao.fila.length) {
    const c = todosCards().find((x) => x.id === sessao.fila[0]);
    const t = temaInfo(c.tema);
    corpo = `<div class="flash" style="--c:${area(t.area).cor}">
      <div class="row-between"><span class="eyebrow"><span class="dot"></span>${esc(t.nome)}</span><span class="muted num">${sessao.feitos + 1}/${sessao.feitos + sessao.fila.length}</span></div>
      <p class="frente">${esc(c.f)}</p>
      ${sessao.virado ? `<p class="verso">${esc(c.v)}</p>
        <div class="notas">${["Errei", "Difícil", "Bom", "Fácil"].map((r, i) => `<button class="btn ${i === 2 ? "primary" : ""}" data-acao="card-nota" data-n="${i}"><span>${r}</span><span class="muted small num">${rotuloInt(proximoIntervalo(c.id, i))}</span></button>`).join("")}</div>
        <p class="note">Atalhos: 1 a 4.</p>`
      : `<button class="btn primary" data-acao="card-virar" style="justify-self:start">Mostrar resposta</button><p class="note">Atalho: barra de espaço.</p>`}
    </div>`;
  } else {
    corpo = `<div class="row-between">
      <div><b>${plural(vencidos.length, "cartão para revisar", "cartões para revisar")} · ${plural(novos.length, "novo", "novos")}</b>
        <div class="muted small">${sessao ? "Sessão concluída. " : ""}Limite de ${S.cfg.novosCardsDia} cartões novos por dia (${novosHoje()} já vistos hoje).</div></div>
      <button class="btn primary" data-acao="card-sessao" ${vencidos.length + novos.length ? "" : "disabled"}>Começar sessão</button>
    </div>`;
  }
  $("#flashcards").innerHTML = `
    <div class="card" style="display:grid;gap:var(--s-3)">
      <div class="filters">
        <select data-mudar="fc-area" aria-label="Área">${[["todas", "Todas as áreas"], ...AREAS.map((a) => [a.id, a.nome])].map(([k, v]) => `<option value="${k}" ${filtroCards.area === k && !filtroCards.tema ? "selected" : ""}>${v}</option>`).join("")}</select>
        <select data-mudar="fc-tema" aria-label="Tema"><option value="">Todos os temas da área</option>${opcoesTemas(filtroCards.tema)}</select>
        <span class="muted small">${plural(l.length, "cartão", "cartões")} neste filtro · ${plural(todosCards().length, "cartão", "cartões")} no total</span>
      </div>
      ${corpo}
    </div>
    <details class="card add"><summary class="btn">Criar meu flashcard</summary>
      <form id="form-card" style="display:grid;gap:var(--s-3);margin-top:var(--s-3)">
        <label class="campo">Tema<select id="fc-novo-tema" required>${opcoesTemas(filtroCards.tema)}</select></label>
        <label class="campo">Frente (pergunta)<textarea id="fc-f" class="texto curto" required placeholder="Ex.: Dose de ataque do sulfato de magnésio (Zuspan)"></textarea></label>
        <label class="campo">Verso (resposta)<textarea id="fc-v" class="texto curto" required placeholder="Ex.: 4 g IV em 10–20 minutos"></textarea></label>
        <button class="btn primary" type="submit" style="justify-self:start">Salvar cartão</button>
      </form>
      ${meus.length ? `<div class="erros-lista">${meus.map((c) => `<div class="erro-linha"><div class="t"><div class="muted small">${esc(temaInfo(c.tema)?.nome || "")}</div><b>${esc(c.f)}</b><p>${esc(c.v)}</p></div>
        <div class="actions"><button class="btn small danger" data-acao="card-apagar" data-id="${c.id}">Apagar</button></div></div>`).join("")}</div>` : ""}
    </details>`;
};
MUDANCAS["fc-area"] = (el) => { filtroCards = { area: el.value, tema: "" }; sessao = null; VIEWS.flashcards(); };
MUDANCAS["fc-tema"] = (el) => { filtroCards.tema = el.value; sessao = null; VIEWS.flashcards(); };
ACOES["cards-do-tema"] = (el) => { filtroCards = { area: "todas", tema: el.dataset.tema }; sessao = null; fecharGaveta(false); irPara("flashcards"); };
ACOES["card-sessao"] = () => {
  const { vencidos, novos } = filaCards();
  sessao = { fila: [...vencidos, ...novos].map((c) => c.id), virado: false, feitos: 0 };
  VIEWS.flashcards();
};
ACOES["card-virar"] = () => { sessao.virado = true; VIEWS.flashcards(); };
ACOES["card-nota"] = (el) => {
  const id = sessao.fila.shift();
  const nota = Number(el.dataset.n);
  avaliar(id, nota);
  if (nota === 0) sessao.fila.push(id); // errou: volta no fim da sessão
  else sessao.feitos++;
  sessao.virado = false;
  salvar({ semGanchos: false });
  render();
};
ENVIOS["form-card"] = () => {
  S.cardsUser.push({ id: uid("u"), tema: $("#fc-novo-tema").value, f: $("#fc-f").value.trim(), v: $("#fc-v").value.trim() });
  salvar(); VIEWS.flashcards(); toast("Cartão criado.");
};
ACOES["card-apagar"] = (el) => confirmar(el, "ca-" + el.dataset.id, "Confirmar", () => {
  S.cardsUser = S.cardsUser.filter((c) => c.id !== el.dataset.id); delete S.cards[el.dataset.id]; salvar(); VIEWS.flashcards();
});
document.addEventListener("keydown", (e) => {
  if (aba !== "flashcards" || !sessao?.fila.length || aberto || e.target.matches("input, textarea, select")) return;
  if (e.key === " " && !sessao.virado) { e.preventDefault(); ACOES["card-virar"](); }
  else if (sessao.virado && ["1", "2", "3", "4"].includes(e.key)) ACOES["card-nota"]({ dataset: { n: Number(e.key) - 1 } });
});
