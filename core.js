// Rumo ao Revalida — núcleo: datas, estado salvo, sequência, nível e despacho de eventos.
// Os demais arquivos registram suas telas em VIEWS e suas ações em ACOES.

const CHAVE = "rumo-revalida-v1";
const XP = { etapa: 10, revisao: 20, erro: 8, card: 2, simulado: 30 };
const TITULOS = [
  [1, "Calouro"], [2, "Interno"], [4, "Residente R1"], [6, "Residente R2"],
  [8, "Residente R3"], [10, "Preceptor"], [13, "Pronto para o Revalida"],
];
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

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
const fmtMin = (m) => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? String(r).padStart(2, "0") : ""}` : `${r} min`; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ── Estado ─────────────────────────────────────────────────────
const CFG_PADRAO = {
  metaMin: 120,            // meta diária de estudo, em minutos
  metaExigida: false,      // se true, o dia só conta na sequência quando a meta é atingida
  foco: 25, pausa: 5,      // Pomodoro, em minutos
  dispo: [120, 180, 180, 180, 180, 180, 240], // minutos disponíveis por dia da semana (domingo a sábado)
  novosCardsDia: 20,
  lembretesOn: false, lembrete: "19:00", ultimoLembrete: null,
};
function estadoNovo() {
  return {
    v: 1, temas: {}, dias: {}, xp: 0, provas: PROVAS_PADRAO.map((p) => ({ ...p })), alvo: null, removidas: [],
    minutos: {}, erros: [], cards: {}, cardsUser: [], cardsHoje: { data: null, novos: 0 }, simulados: [],
    timer: null, simTimer: null, cfg: { ...CFG_PADRAO }, atualizadoEm: 0, syncBase: 0,
  };
}
// Completa campos que versões antigas não tinham (também usado ao restaurar backup e ao baixar da nuvem).
function normalizar(s) {
  const base = estadoNovo();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  s.cfg = { ...CFG_PADRAO, ...s.cfg };
  for (const p of PROVAS_PADRAO) {
    if (!s.provas.some((x) => x.id === p.id) && !s.removidas.includes(p.id)) s.provas.push({ ...p });
  }
  return s;
}
function carregar() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { s = null; }
  if (!s || s.v !== 1) s = estadoNovo();
  return normalizar(s);
}
let S = carregar();
const AO_SALVAR = []; // ganchos (sincronização, lembretes)
function salvar(opts = {}) {
  if (!opts.semCarimbo) S.atualizadoEm = Date.now();
  try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) { /* armazenamento indisponível: o app segue funcionando nesta sessão */ }
  if (!opts.semGanchos) for (const f of AO_SALVAR) { try { f(); } catch (e) { console.error(e); } }
}
function substituirEstado(novo) { S = normalizar(novo); }

const T = (id) => (S.temas[id] ||= { aula: false, leitura: false, questoes: false, inicio: null, prox: null, revisoes: [], qFeitas: 0, qAcertos: 0, notas: "", minutos: 0, incid: {} });
const temaInfo = (id) => TEMAS.find((t) => t.id === id);
const area = (id) => AREAS.find((a) => a.id === id);
const opcoesTemas = (sel) => AREAS.map((a) => `<optgroup label="${a.nome}">${TEMAS.filter((t) => t.area === a.id)
  .map((t) => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${esc(t.nome)}</option>`).join("")}</optgroup>`).join("");

// ── Atividade, sequência e nível ──────────────────────────────
function registrar(xp) {
  const d = hoje();
  S.dias[d] = (S.dias[d] || 0) + 1;
  S.xp += xp;
}
const minutosDia = (d) => S.minutos[d] || 0;
const diaConta = (d) => S.cfg.metaExigida ? minutosDia(d) >= S.cfg.metaMin : !!(S.dias[d] || minutosDia(d));
function sequencia() {
  let d = hoje();
  if (!diaConta(d)) d = addDias(d, -1);
  let n = 0;
  while (diaConta(d)) { n++; d = addDias(d, -1); }
  return n;
}
function melhorSequencia() {
  const dias = [...new Set([...Object.keys(S.dias), ...Object.keys(S.minutos)])].filter(diaConta).sort();
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

// ── Renderização e eventos ────────────────────────────────────
const $ = (sel, el = document) => el.querySelector(sel);
const VIEWS = {};       // id da aba -> função que desenha a aba
const ACOES = {};       // data-acao -> função(el, evento)
const MUDANCAS = {};    // data-mudar -> função(el, evento), para change/input
const ENVIOS = {};      // id do formulário -> função(form)
const TICKS = [];       // funções chamadas a cada segundo (cronômetros)
const ABAS = ["painel", "plano", "temas", "revisoes", "questoes", "flashcards", "provas", "ajustes"];
let aba = "painel";

function irPara(nova) {
  aba = nova;
  try { history.replaceState(null, "", "#" + aba); } catch (_) {}
  render();
  window.scrollTo({ top: 0 });
}
function render() {
  const seq = sequencia();
  $("#streak").innerHTML = `${FOGO}<span class="num">${seq}</span> dia${seq === 1 ? "" : "s"}`;
  $("#streak").title = diaConta(hoje()) ? "O dia de hoje já conta na sequência" : "Estude hoje para manter a sequência";
  const pend = pendentesHoje();
  $("#badge-rev").textContent = pend;
  $("#badge-rev").hidden = !pend;
  for (const b of document.querySelectorAll(".tab")) b.setAttribute("aria-selected", b.dataset.aba === aba);
  for (const s of document.querySelectorAll("section[role=tabpanel]")) s.hidden = s.id !== aba;
  VIEWS[aba]?.();
}
const FOGO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 1.5s1 3.2-1.4 6.1C10 10.1 8 11.6 8 15a4 4 0 0 0 8 0c0-1.3-.5-2.4-1-3.2 2.1.9 4 3.3 4 6.2A7 7 0 0 1 5 18c0-5.2 3.4-7.3 5.4-10C12.6 5 13.5 1.5 13.5 1.5z"/></svg>`;

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600);
}
let confirmando = null; // confirmação em dois cliques para ações destrutivas
function confirmar(btn, chave, rotulo, acao) {
  if (confirmando === chave) { confirmando = null; acao(); return; }
  confirmando = chave;
  btn.textContent = rotulo;
  setTimeout(() => { if (confirmando === chave) { confirmando = null; render(); if (aberto) renderGaveta(); } }, 4000);
}
function baixarArquivo(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-acao], [data-abrir], .tab");
  if (!el) return;
  if (el.matches(".tab")) { irPara(el.dataset.aba); return; }
  if (el.dataset.abrir) { abrir(el.dataset.abrir); return; }
  const f = ACOES[el.dataset.acao];
  if (f) f(el, e);
});
document.addEventListener("change", (e) => { const f = MUDANCAS[e.target.dataset.mudar]; if (f) f(e.target, e); });
document.addEventListener("input", (e) => { const f = MUDANCAS[e.target.dataset.digitar]; if (f) f(e.target, e); });
document.addEventListener("submit", (e) => {
  const f = ENVIOS[e.target.id];
  if (!f) return;
  e.preventDefault();
  f(e.target);
});
setInterval(() => { for (const f of TICKS) { try { f(); } catch (err) { console.error(err); } } }, 1000);
