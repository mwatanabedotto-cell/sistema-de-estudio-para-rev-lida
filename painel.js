// Painel: contagem regressiva, meta diária, cronômetro Pomodoro, sequência e resumo do dia.

function creditarMinutos(min, temaId) {
  min = Math.round(min);
  if (!(min > 0)) return;
  const d = hoje();
  S.minutos[d] = (S.minutos[d] || 0) + min;
  if (temaId) T(temaId).minutos += min;
  registrar(Math.max(1, Math.round(min / 5)));
}

// ── Pomodoro ──────────────────────────────────────────────────
// S.timer = { fase: "foco" | "pausa", durMin, fim (ms, se rodando), restante (ms, se pausado), tema }
let audio = null;
function bip() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    for (const [i, f] of [[0, 880], [0.25, 1175]]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = f; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, audio.currentTime + i);
      g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + i + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + i + 0.22);
      o.start(audio.currentTime + i); o.stop(audio.currentTime + i + 0.25);
    }
  } catch (_) { /* sem áudio */ }
}
function restanteMs() {
  const t = S.timer;
  if (!t) return 0;
  return t.fim ? Math.max(0, t.fim - Date.now()) : t.restante;
}
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

TICKS.push(() => {
  const t = S.timer;
  const mini = $("#timer-mini");
  if (!t) { mini.hidden = true; return; }
  if (t.fim && Date.now() >= t.fim) {
    if (t.fase === "foco") {
      creditarMinutos(t.durMin, t.tema);
      S.timer = { fase: "pausa", durMin: S.cfg.pausa, fim: Date.now() + S.cfg.pausa * 60000, restante: 0, tema: t.tema };
      notificar("Foco concluído", `${fmtMin(t.durMin)} somados à sua meta. Hora da pausa de ${S.cfg.pausa} min.`);
    } else {
      S.timer = { fase: "foco", durMin: S.cfg.foco, fim: null, restante: S.cfg.foco * 60000, tema: t.tema };
      notificar("Pausa encerrada", "Pronto para mais um bloco de foco?");
    }
    bip(); salvar();
    if (aba === "painel") render();
  }
  const r = mmss(restanteMs());
  mini.hidden = false;
  mini.textContent = `${S.timer.fase === "foco" ? "Foco" : "Pausa"} ${r}${S.timer.fim ? "" : " (pausado)"}`;
  const big = $("#pomo-relogio");
  if (big) big.textContent = r;
  if (S.timer.fim) document.title = `${r} · Rumo ao Revalida`;
  else document.title = "Rumo ao Revalida";
});
ACOES["pomo-iniciar"] = () => {
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch (_) {}
  const tema = $("#pomo-tema")?.value || null;
  if (!S.timer) S.timer = { fase: "foco", durMin: S.cfg.foco, fim: Date.now() + S.cfg.foco * 60000, restante: 0, tema };
  else if (!S.timer.fim) { S.timer.fim = Date.now() + S.timer.restante; S.timer.tema = tema ?? S.timer.tema; }
  salvar(); render();
};
ACOES["pomo-pausar"] = () => { S.timer.restante = restanteMs(); S.timer.fim = null; salvar(); render(); };
ACOES["pomo-parar"] = () => {
  const t = S.timer;
  if (t.fase === "foco") {
    const feito = Math.floor((t.durMin * 60000 - restanteMs()) / 60000);
    creditarMinutos(feito, t.tema);
    if (feito > 0) toast(`${fmtMin(feito)} registrados.`);
  }
  S.timer = null; document.title = "Rumo ao Revalida";
  salvar(); render();
};
MUDANCAS["pomo-tema"] = (el) => { if (S.timer) { S.timer.tema = el.value || null; salvar(); } };
ENVIOS["form-tempo"] = () => {
  const m = parseInt($("#tm-min").value, 10);
  if (!(m > 0)) return;
  creditarMinutos(m, $("#tm-tema").value || null);
  salvar(); render(); toast(`${fmtMin(m)} registrados hoje.`);
};
ACOES["ir-timer-mini"] = () => irPara("painel");

// ── Mapa de calor da sequência ────────────────────────────────
function heatmap() {
  const semanas = 18;
  const fim = hoje();
  const inicio = addDias(fim, -parse(fim).getDay() - (semanas - 1) * 7); // colunas = semanas, a última termina hoje
  let cells = "";
  for (let d = inicio; diff(d, fim) >= 0; d = addDias(d, 1)) {
    const n = S.dias[d] || 0, m = minutosDia(d);
    const porAtiv = n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : 3;
    const porMin = m === 0 ? 0 : m >= S.cfg.metaMin ? 3 : m >= S.cfg.metaMin / 2 ? 2 : 1;
    const l = Math.max(porAtiv, porMin);
    cells += `<i data-l="${l}" class="${d === fim ? "today" : ""}" title="${fmt(d)}: ${plural(n, "atividade", "atividades")}${m ? `, ${fmtMin(m)}` : ""}"></i>`;
  }
  return `<div class="heat" role="img" aria-label="Dias estudados nas últimas ${semanas} semanas">${cells}</div>
    <div class="heat-legend">menos <i style="background:var(--heat-0)"></i><i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i> mais
    <span style="margin-left:auto">${S.cfg.metaExigida ? `O dia conta quando você atinge ${fmtMin(S.cfg.metaMin)}.` : "Qualquer atividade ou tempo registrado conta o dia."}</span></div>`;
}

// ── Prova-meta ────────────────────────────────────────────────
const provasOrdenadas = () => [...S.provas].sort((a, b) => a.data.localeCompare(b.data));
function provaAlvo() {
  const futuras = provasOrdenadas().filter((p) => diff(hoje(), p.data) >= 0);
  return futuras.find((p) => p.id === S.alvo) || futuras.find((p) => p.etapa.startsWith("1ª")) || futuras[0] || null;
}

// ── Aba Painel ────────────────────────────────────────────────
VIEWS.painel = function renderPainel() {
  const p = provaAlvo();
  const seq = sequencia();
  const nv = nivel();
  const naoIniciados = TEMAS.filter((t) => !iniciado(t.id));
  const minHoje = minutosDia(hoje());
  const meta = S.cfg.metaMin;
  const pMeta = Math.min(100, Math.round((minHoje / meta) * 100));
  const plano = gerarPlano()[0];
  const fracos = pontosFracos().slice(0, 3);
  const cardsHoje = cardsVencidosHoje();
  const errosHoje = errosPendentes().length;
  const t = S.timer;

  let ritmo = "";
  if (p) {
    const semanas = Math.max(1, diff(hoje(), p.data) / 7);
    const porSemana = Math.ceil(naoIniciados.length / semanas);
    ritmo = naoIniciados.length
      ? `Para começar os ${naoIniciados.length} temas restantes até lá: <b>${plural(porSemana, "tema novo", "temas novos")} por semana</b>, mais as revisões.`
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
        <div class="stat"><span class="eyebrow">Sequência</span><span class="v flame num">${seq}</span><span class="muted">${diaConta(hoje()) ? "dias seguidos · hoje ok" : seq ? "estude hoje para manter" : "comece hoje"}</span></div>
        <div class="stat"><span class="eyebrow">Recorde</span><span class="v num">${melhorSequencia()}</span><span class="muted">dias seguidos</span></div>
        <div class="stat"><span class="eyebrow">Estudado</span><span class="v num">${pctGeral()}%</span><span class="muted">de ${TEMAS.length} temas</span></div>
        <div class="stat"><span class="eyebrow">Nível ${nv.L}</span><span class="v" style="font-size:1.15rem">${nv.titulo}</span>
          <div class="level-bar" title="${nv.dentro} de ${nv.custo} XP"><i style="width:${(nv.dentro / nv.custo) * 100}%"></i></div>
          <span class="muted num small">${nv.dentro}/${nv.custo} XP</span></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card pomo">
        <header><h3>Meta de hoje</h3><span class="muted num">${fmtMin(minHoje)} de ${fmtMin(meta)}</span></header>
        <div class="bar grossa"><i style="width:${pMeta}%;background:${pMeta >= 100 ? "var(--ok)" : "var(--accent)"}"></i></div>
        <div class="pomo-corpo">
          <div>
            <span class="eyebrow">${t ? (t.fase === "foco" ? "Foco" : "Pausa") : "Pomodoro"} · ${S.cfg.foco}/${S.cfg.pausa} min</span>
            <div class="relogio num" id="pomo-relogio">${mmss(t ? restanteMs() : S.cfg.foco * 60000)}</div>
          </div>
          <div class="pomo-acoes">
            <select id="pomo-tema" data-mudar="pomo-tema" aria-label="Tema estudado"><option value="">Sem tema específico</option>${opcoesTemas(t?.tema)}</select>
            <div class="actions">
              ${t?.fim ? `<button class="btn" data-acao="pomo-pausar">Pausar</button>` : `<button class="btn primary" data-acao="pomo-iniciar">${t ? "Continuar" : "Iniciar foco"}</button>`}
              ${t ? `<button class="btn" data-acao="pomo-parar">${t.fase === "foco" ? "Parar e registrar" : "Encerrar"}</button>` : ""}
            </div>
          </div>
        </div>
        <details><summary class="muted small">Estudou sem cronômetro? Registre o tempo</summary>
          <form id="form-tempo" class="form-row" style="margin-top:var(--s-2)">
            <label>Minutos<input id="tm-min" type="number" min="1" placeholder="50" required></label>
            <label>Tema<select id="tm-tema"><option value="">Sem tema específico</option>${opcoesTemas()}</select></label>
            <button class="btn" type="submit">Registrar</button>
          </form>
        </details>
      </div>
      <div class="card">
        <header><h3>Plano de hoje</h3><span class="muted num">${fmtMin(plano.usado)} de ${fmtMin(plano.capacidade)}</span></header>
        <div class="agenda">${plano.itens.slice(0, 5).map(itemPlano).join("") || `<p class="empty">Dia livre no seu plano. Ajuste a disponibilidade na aba Plano.</p>`}</div>
        <button class="btn small" data-acao="ir" data-aba="plano" style="margin-top:var(--s-2)">Ver a semana</button>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <header><h3>Sequência diária</h3><span class="muted">últimas 18 semanas</span></header>
        ${heatmap()}
      </div>
      <div class="card">
        <header><h3>Atenção</h3></header>
        <div class="agenda">
          <div class="agenda-item"><span class="pill ${cardsHoje ? "today" : "done"}">${cardsHoje}</span><div class="t"><b>Flashcards para revisar</b></div><button class="btn small" data-acao="ir" data-aba="flashcards">Abrir</button></div>
          <div class="agenda-item"><span class="pill ${errosHoje ? "today" : "done"}">${errosHoje}</span><div class="t"><b>Erros do caderno para revisar</b></div><button class="btn small" data-acao="ir" data-aba="questoes">Abrir</button></div>
          ${fracos.map(cartaoFraco).join("")}
        </div>
      </div>
    </div>

    <div class="card">
      <header><h3>Progresso por área</h3><span class="muted">média dos temas</span></header>
      <div class="area-rows">
        ${AREAS.map((a) => {
          const l = TEMAS.filter((x) => x.area === a.id);
          const v = pctGeral(l);
          return `<div class="area-row" style="--c:${a.cor}">
            <span><span class="dot"></span><b>${a.nome}</b> <span class="muted small">${l.filter((x) => iniciado(x.id)).length}/${l.length} iniciados</span></span>
            <span class="num">${v}%</span>
            <div class="bar"><i style="width:${v}%"></i></div></div>`;
        }).join("")}
      </div>
    </div>`;
};
