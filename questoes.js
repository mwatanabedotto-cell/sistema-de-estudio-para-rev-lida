// Questões: caderno de erros, pontos fracos, simulados e incidência por tema.

const MOTIVOS = {
  conteudo: "Não sabia o conteúdo",
  interpretacao: "Interpretei errado o enunciado",
  distracao: "Desatenção / li rápido",
  chute: "Chutei / estava em dúvida",
};
const INTERVALOS_ERRO = [1, 7, 30]; // acertos seguidos necessários para "dominar" um erro
const NOTA_CORTE = 60;              // referência recente (59 no 2026.1, 60 no 2026.2)

// ── Caderno de erros ──────────────────────────────────────────
const errosPendentes = () => S.erros.filter((e) => !e.resolvido && e.prox && diff(hoje(), e.prox) <= 0);

function formErro(p, temaFixo) {
  return `<form class="erro-form" id="form-erro-${p}" data-prefixo="${p}" style="display:grid;gap:8px">
    ${temaFixo ? `<input type="hidden" id="${p}-tema" value="${temaFixo}">` : `<label class="campo">Tema<select id="${p}-tema" required><option value="">Escolha o tema</option>${opcoesTemas()}</select></label>`}
    <div class="form-row">
      <label>Origem<input id="${p}-origem" placeholder="INEP 2024/1, questão 37" list="lista-edicoes"></label>
      <label>Por que errou<select id="${p}-motivo">${Object.entries(MOTIVOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
    </div>
    <label class="campo">O que a questão cobrava<textarea id="${p}-questao" class="texto curto" required placeholder="Ex.: gestante com sífilis latente de duração ignorada; esquema de tratamento"></textarea></label>
    <label class="campo">O que você precisa lembrar<textarea id="${p}-aprendizado" class="texto curto" required placeholder="Ex.: penicilina benzatina 2,4 milhões UI semanal por 3 semanas"></textarea></label>
    <button class="btn primary" type="submit" style="justify-self:start">Salvar no caderno de erros</button>
  </form>`;
}
function salvarErro(form) {
  const p = form.dataset.prefixo;
  const v = (k) => $(`#${p}-${k}`).value.trim();
  if (!v("tema")) { toast("Escolha o tema do erro."); return; }
  S.erros.unshift({
    id: uid("e"), data: hoje(), tema: v("tema"), origem: v("origem"), motivo: $(`#${p}-motivo`).value,
    questao: v("questao"), aprendizado: v("aprendizado"), prox: addDias(hoje(), INTERVALOS_ERRO[0]), acertos: 0, resolvido: false, hist: [],
  });
  registrar(XP.erro);
  salvar();
  toast("Erro salvo. Ele volta para revisão amanhã.");
  if (aberto) renderGaveta(); else render();
}
ENVIOS["form-erro-eg"] = salvarErro;
ENVIOS["form-erro-eq"] = salvarErro;

function itemErro(e) {
  const t = temaInfo(e.tema);
  const atrasado = e.prox && diff(hoje(), e.prox) < 0;
  return `<div class="agenda-item erro-item">
    <span class="pill ${atrasado ? "late" : "today"}">erro</span>
    <div class="t">
      <b>${esc(e.questao)}</b>
      <details><summary class="muted small">${esc(t?.nome || "")} · tente lembrar a resposta e depois abra</summary><p class="resumo">${esc(e.aprendizado)}</p></details>
    </div>
    <div class="actions">
      <button class="btn small" data-acao="erro-ok" data-id="${e.id}">Lembrei</button>
      <button class="btn small danger" data-acao="erro-nao" data-id="${e.id}">Esqueci</button>
    </div>
  </div>`;
}
function responderErro(id, ok) {
  const e = S.erros.find((x) => x.id === id);
  if (!e) return;
  e.hist.push({ data: hoje(), ok });
  if (ok) {
    e.acertos++;
    if (e.acertos >= INTERVALOS_ERRO.length) { e.resolvido = true; e.prox = null; }
    else e.prox = addDias(hoje(), INTERVALOS_ERRO[e.acertos]);
  } else { e.acertos = 0; e.prox = addDias(hoje(), 1); }
  registrar(XP.card);
  salvar();
  toast(ok ? (e.resolvido ? "Erro dominado. Saiu da fila de revisão." : `Próxima revisão em ${plural(INTERVALOS_ERRO[e.acertos], "dia", "dias")}.`) : "Volta amanhã.");
  render();
}
ACOES["erro-ok"] = (el) => responderErro(el.dataset.id, true);
ACOES["erro-nao"] = (el) => responderErro(el.dataset.id, false);
ACOES["erro-apagar"] = (el) => confirmar(el, "ea-" + el.dataset.id, "Confirmar", () => {
  S.erros = S.erros.filter((x) => x.id !== el.dataset.id); salvar(); render(); toast("Erro apagado.");
});
ACOES["erro-reabrir"] = (el) => {
  const e = S.erros.find((x) => x.id === el.dataset.id);
  e.resolvido = false; e.acertos = 0; e.prox = hoje(); salvar(); render();
};

// ── Pontos fracos ─────────────────────────────────────────────
// Ranking de temas pelo acerto nas questões (mínimo de 5) e pelos erros em aberto no caderno.
function pontosFracos() {
  const lista = [];
  for (const t of TEMAS) {
    const st = S.temas[t.id];
    const abertos = S.erros.filter((e) => e.tema === t.id && !e.resolvido).length;
    const revs = (st?.revisoes || []).filter((r) => r.acerto != null);
    const ultRev = revs.length ? revs[revs.length - 1].acerto : null;
    const taxa = st?.qFeitas >= 5 ? (st.qAcertos / st.qFeitas) * 100 : null;
    if (taxa == null && abertos < 2 && (ultRev == null || ultRev >= 60)) continue;
    // Quanto menor o índice, mais fraco: acerto (ou 70 se sem dados) − 5 por erro em aberto, puxado pela última revisão.
    let indice = taxa ?? 70;
    if (ultRev != null) indice = (indice + ultRev) / 2;
    indice -= abertos * 5;
    if (indice >= 70) continue;
    lista.push({ t, taxa, abertos, ultRev, indice, feitas: st?.qFeitas || 0 });
  }
  return lista.sort((a, b) => a.indice - b.indice);
}
function desempenhoArea(aid) {
  let q = 0, a = 0;
  for (const t of TEMAS.filter((x) => x.area === aid)) { const st = S.temas[t.id]; if (st) { q += st.qFeitas; a += st.qAcertos; } }
  for (const s of S.simulados) { const p = s.porArea?.[aid]; if (p) { q += p[0]; a += p[1]; } }
  return q ? { taxa: Math.round((a / q) * 100), q } : null;
}
function cartaoFraco(f) {
  return `<div class="agenda-item">
    <span class="dot" style="--c:${area(f.t.area).cor}"></span>
    <div class="t"><b>${esc(f.t.nome)}</b><div class="muted small">${[
      f.taxa != null ? `${Math.round(f.taxa)}% de acerto em ${f.feitas} questões` : null,
      f.ultRev != null ? `última revisão: ${f.ultRev}%` : null,
      f.abertos ? plural(f.abertos, "erro em aberto", "erros em aberto") : null,
    ].filter(Boolean).join(" · ")}</div></div>
    <button class="btn small" data-abrir="${f.t.id}">Reforçar</button>
  </div>`;
}

// ── Incidência ────────────────────────────────────────────────
function incidenciaTema(id) {
  const inc = S.temas[id]?.incid || {};
  const vals = Object.values(inc);
  return { provas: vals.length, total: vals.reduce((a, b) => a + b, 0), media: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
}
const nivelPorIncidencia = (m) => (m >= 2 ? 1 : m >= 1 ? 2 : 3);

// ── Simulados ─────────────────────────────────────────────────
function graficoSimulados() {
  const l = [...S.simulados].sort((a, b) => a.data.localeCompare(b.data)).slice(-12);
  if (!l.length) return `<p class="empty">Registre seu primeiro simulado para ver a evolução.</p>`;
  const W = 640, H = 220, m = { t: 16, r: 16, b: 34, l: 36 };
  const w = W - m.l - m.r, h = H - m.t - m.b;
  const x = (i) => m.l + (l.length === 1 ? w / 2 : (i / (l.length - 1)) * w);
  const y = (v) => m.t + h - (v / 100) * h;
  const notas = l.map((s) => Math.round((s.acertos / s.total) * 100));
  const pts = notas.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const areaPath = `M${x(0)},${y(0)} L${notas.map((v, i) => `${x(i)},${y(v)}`).join(" L")} L${x(l.length - 1)},${y(0)} Z`;
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Notas dos simulados">
    ${[0, 20, 40, 60, 80, 100].map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" class="tick">${v}</text>`).join("")}
    <line x1="${m.l}" x2="${W - m.r}" y1="${y(NOTA_CORTE)}" y2="${y(NOTA_CORTE)}" class="corte"/>
    <text x="${W - m.r}" y="${y(NOTA_CORTE) - 6}" text-anchor="end" class="tick corte-t">nota de corte ~${NOTA_CORTE}</text>
    ${l.length > 1 ? `<path d="${areaPath}" class="area"/><polyline points="${pts}" class="linha"/>` : ""}
    ${notas.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === l.length - 1 ? 5 : 3.5}" class="${v >= NOTA_CORTE ? "pt-ok" : "pt-bad"}"><title>${esc(l[i].nome)}: ${v}</title></circle>
      <text x="${x(i)}" y="${H - 12}" text-anchor="middle" class="tick">${fmtCurto(l[i].data)}</text>`).join("")}
  </svg></div>`;
}

// Cronômetro de simulado: duração total e ritmo ideal por questão.
function textoSimTimer() {
  const t = S.simTimer;
  if (!t) return "";
  const total = t.duracaoMin * 60000;
  const passado = (t.pausadoEm || Date.now()) - t.inicio - (t.pausas || 0);
  const resta = Math.max(0, total - passado);
  const h = Math.floor(resta / 3600000), mi = Math.floor((resta % 3600000) / 60000), s = Math.floor((resta % 60000) / 1000);
  const questaoIdeal = Math.min(t.total, Math.floor((passado / total) * t.total) + 1);
  return { relogio: `${h}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}`, questaoIdeal, acabou: resta === 0, porQ: (t.duracaoMin / t.total).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) };
}
TICKS.push(() => {
  const el = $("#sim-relogio");
  if (!el || !S.simTimer) return;
  const r = textoSimTimer();
  el.textContent = r.relogio;
  $("#sim-ritmo").textContent = r.acabou ? "Tempo esgotado." : `Para manter o ritmo, você deveria estar na questão ${r.questaoIdeal} de ${S.simTimer.total} (${r.porQ} min por questão).`;
});
ACOES["sim-iniciar"] = () => {
  const dur = parseInt($("#st-dur").value, 10) || 300, tot = parseInt($("#st-total").value, 10) || 100;
  S.simTimer = { inicio: Date.now(), duracaoMin: dur, total: tot, pausas: 0, pausadoEm: null };
  salvar(); render();
};
ACOES["sim-pausar"] = () => {
  const t = S.simTimer;
  if (t.pausadoEm) { t.pausas += Date.now() - t.pausadoEm; t.pausadoEm = null; } else t.pausadoEm = Date.now();
  salvar(); render();
};
ACOES["sim-encerrar"] = () => {
  const t = S.simTimer;
  const usado = Math.round(((t.pausadoEm || Date.now()) - t.inicio - (t.pausas || 0)) / 60000);
  S.simTimer = null;
  creditarMinutos(usado, null);
  salvar(); render();
  $("#form-simulado").closest("details").open = true;
  $("#s-tempo").value = usado; $("#s-total").value = t.total;
  $("#form-simulado").scrollIntoView({ behavior: "smooth", block: "center" });
  toast(usado > 0 ? `${fmtMin(usado)} somados ao dia. Preencha o resultado abaixo.` : "Cronômetro encerrado. Preencha o resultado abaixo.");
};

ENVIOS["form-simulado"] = () => {
  const total = parseInt($("#s-total").value, 10), acertos = parseInt($("#s-acertos").value, 10);
  if (!(total > 0) || !(acertos >= 0) || acertos > total) { toast("Confira total e acertos."); return; }
  const porArea = {};
  for (const a of AREAS) {
    const q = parseInt($(`#s-${a.id}-q`).value, 10), ac = parseInt($(`#s-${a.id}-a`).value, 10);
    if (q > 0 && ac >= 0 && ac <= q) porArea[a.id] = [q, ac];
  }
  S.simulados.push({ id: uid("s"), data: $("#s-data").value || hoje(), nome: $("#s-nome").value.trim() || "Simulado", total, acertos, tempoMin: parseInt($("#s-tempo").value, 10) || null, porArea });
  registrar(XP.simulado);
  salvar(); render(); toast("Simulado registrado.");
};
ACOES["sim-apagar"] = (el) => confirmar(el, "sa-" + el.dataset.id, "Confirmar", () => {
  S.simulados = S.simulados.filter((x) => x.id !== el.dataset.id); salvar(); render();
});

// ── Aba Questões ──────────────────────────────────────────────
let filtroErros = { tema: "", motivo: "", mostrar: "abertos" };
MUDANCAS["fe-tema"] = (el) => { filtroErros.tema = el.value; VIEWS.questoes(); };
MUDANCAS["fe-motivo"] = (el) => { filtroErros.motivo = el.value; VIEWS.questoes(); };
MUDANCAS["fe-mostrar"] = (el) => { filtroErros.mostrar = el.value; VIEWS.questoes(); };

VIEWS.questoes = function renderQuestoes() {
  const fracos = pontosFracos();
  const pend = errosPendentes();
  const lista = S.erros.filter((e) =>
    (!filtroErros.tema || e.tema === filtroErros.tema) && (!filtroErros.motivo || e.motivo === filtroErros.motivo) &&
    (filtroErros.mostrar === "todos" || (filtroErros.mostrar === "abertos" ? !e.resolvido : e.resolvido)));
  const porMotivo = Object.keys(MOTIVOS).map((k) => [k, S.erros.filter((e) => e.motivo === k).length]);
  const totalErros = S.erros.length;
  const st = S.simTimer && textoSimTimer();
  const mapeados = TEMAS.map((t) => ({ t, ...incidenciaTema(t.id) })).filter((x) => x.provas).sort((a, b) => b.media - a.media);
  const sims = [...S.simulados].sort((a, b) => b.data.localeCompare(a.data));

  $("#questoes").innerHTML = `
    <div class="grid-2">
      <div class="card">
        <header><h3>Pontos fracos</h3><span class="muted">${plural(fracos.length, "tema", "temas")}</span></header>
        <div class="agenda">${fracos.slice(0, 8).map(cartaoFraco).join("") || `<p class="empty">Registre questões nos temas (mínimo de 5 por tema) ou erros no caderno para descobrir seus pontos fracos.</p>`}</div>
      </div>
      <div class="card">
        <header><h3>Acerto por área</h3><span class="muted">questões + simulados</span></header>
        <div class="area-rows">${AREAS.map((a) => {
          const d = desempenhoArea(a.id);
          return `<div class="area-row" style="--c:${a.cor}">
            <span><span class="dot"></span><b>${a.nome}</b> <span class="muted small">${d ? `${d.q} questões` : "sem dados"}</span></span>
            <span class="num ${d && d.taxa < NOTA_CORTE ? "txt-bad" : ""}">${d ? d.taxa + "%" : "–"}</span>
            <div class="bar"><i style="width:${d ? d.taxa : 0}%"></i></div></div>`;
        }).join("")}</div>
      </div>
    </div>

    <div class="card">
      <header><h3>Caderno de erros</h3><span class="muted">${plural(pend.length, "para revisar hoje", "para revisar hoje")} · ${totalErros} no total</span></header>
      ${pend.length ? `<div class="agenda" style="margin-bottom:var(--s-4)">${pend.map(itemErro).join("")}</div>` : ""}
      ${totalErros ? `<div class="motivos">${porMotivo.map(([k, n]) => `<div><span class="num">${Math.round((n / totalErros) * 100)}%</span><span class="muted small">${MOTIVOS[k]}</span></div>`).join("")}</div>` : ""}
      <details class="add" ${totalErros ? "" : "open"}><summary class="btn">Registrar novo erro</summary>${formErro("eq")}</details>
      ${totalErros ? `
        <div class="filters" style="margin-top:var(--s-4)">
          <select data-mudar="fe-tema" aria-label="Filtrar por tema"><option value="">Todos os temas</option>${opcoesTemas(filtroErros.tema)}</select>
          <select data-mudar="fe-motivo" aria-label="Filtrar por motivo"><option value="">Todos os motivos</option>${Object.entries(MOTIVOS).map(([k, v]) => `<option value="${k}" ${filtroErros.motivo === k ? "selected" : ""}>${v}</option>`).join("")}</select>
          <select data-mudar="fe-mostrar" aria-label="Situação">${[["abertos", "Em aberto"], ["resolvidos", "Dominados"], ["todos", "Todos"]].map(([k, v]) => `<option value="${k}" ${filtroErros.mostrar === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        </div>
        <div class="erros-lista">${lista.map((e) => `
          <div class="erro-linha">
            <div class="t">
              <div class="muted small">${fmt(e.data)} · ${esc(temaInfo(e.tema)?.nome || "")}${e.origem ? " · " + esc(e.origem) : ""} · ${MOTIVOS[e.motivo]}</div>
              <b>${esc(e.questao)}</b>
              <p>${esc(e.aprendizado)}</p>
              <div class="muted small">${e.resolvido ? "Dominado" : `Revisão ${quando(e.prox)} · ${e.acertos}/${INTERVALOS_ERRO.length} acertos seguidos`}</div>
            </div>
            <div class="actions">
              ${e.resolvido ? `<button class="btn small" data-acao="erro-reabrir" data-id="${e.id}">Reabrir</button>` : ""}
              <button class="btn small danger" data-acao="erro-apagar" data-id="${e.id}">Apagar</button>
            </div>
          </div>`).join("") || `<p class="empty">Nenhum erro com esses filtros.</p>`}</div>` : ""}
    </div>

    <div class="card">
      <header><h3>Simulados</h3><span class="muted">nota de corte recente: 59 (2026.1) e 60 (2026.2)</span></header>
      ${graficoSimulados()}
      <div class="sim-timer">
        ${st ? `
          <div><span class="eyebrow">Simulado em andamento</span><div class="relogio num" id="sim-relogio">${st.relogio}</div><p class="muted" id="sim-ritmo"></p></div>
          <div class="actions"><button class="btn" data-acao="sim-pausar">${S.simTimer.pausadoEm ? "Continuar" : "Pausar"}</button><button class="btn primary" data-acao="sim-encerrar">Encerrar e registrar</button></div>
        ` : `
          <div class="form-row">
            <label>Duração (min)<input id="st-dur" type="number" min="10" value="300"></label>
            <label>Questões<input id="st-total" type="number" min="1" value="100"></label>
            <button class="btn" data-acao="sim-iniciar">Iniciar cronômetro de simulado</button>
          </div>
          <p class="note">A 1ª etapa do Revalida tem 5 horas. No 2026.2 foram 100 questões objetivas, cerca de 3 minutos por questão.</p>`}
      </div>
      <details class="add"><summary class="btn">Registrar resultado de simulado</summary>
        <form id="form-simulado" style="display:grid;gap:var(--s-3)">
          <div class="form-row">
            <label>Nome<input id="s-nome" placeholder="Prova INEP 2024/1"></label>
            <label>Data<input id="s-data" type="date" value="${hoje()}"></label>
            <label>Total de questões<input id="s-total" type="number" min="1" required value="100"></label>
            <label>Acertos<input id="s-acertos" type="number" min="0" required></label>
            <label>Tempo (min)<input id="s-tempo" type="number" min="0" placeholder="opcional"></label>
          </div>
          <p class="note">Por área (opcional): questões e acertos de cada uma.</p>
          <div class="por-area">${AREAS.map((a) => `<div class="form-row"><span class="dot" style="--c:${a.cor}"></span><b class="small" style="flex:1 1 140px">${a.nome}</b>
            <label>Questões<input id="s-${a.id}-q" type="number" min="0"></label><label>Acertos<input id="s-${a.id}-a" type="number" min="0"></label></div>`).join("")}</div>
          <button class="btn primary" type="submit" style="justify-self:start">Salvar simulado</button>
        </form>
      </details>
      ${sims.length ? `<div class="tabela"><table><thead><tr><th>Data</th><th>Simulado</th><th>Nota</th><th>Tempo</th><th></th></tr></thead><tbody>
        ${sims.map((s) => { const n = Math.round((s.acertos / s.total) * 100); return `<tr><td class="num">${fmtCurto(s.data)}</td><td>${esc(s.nome)}</td><td class="num ${n >= NOTA_CORTE ? "txt-ok" : "txt-bad"}">${n} <span class="muted">(${s.acertos}/${s.total})</span></td><td class="num">${s.tempoMin ? fmtMin(s.tempoMin) : "–"}</td><td><button class="btn small danger" data-acao="sim-apagar" data-id="${s.id}">Apagar</button></td></tr>`; }).join("")}
      </tbody></table></div>` : ""}
    </div>

    <div class="card">
      <header><h3>Incidência nas provas anteriores</h3><span class="muted">${plural(mapeados.length, "tema mapeado", "temas mapeados")}</span></header>
      <p class="note" style="margin-bottom:var(--s-3)">A incidência é montada com os seus dados: ao resolver uma prova anterior inteira do INEP, registre no tema quantas questões caíram (ou use a origem “Prova anterior” ao registrar questões). Quanto mais provas você mapear, mais confiável fica o ranking. O app não traz contagens prontas porque não há uma fonte oficial com esses números.</p>
      ${mapeados.length ? `<div class="tabela"><table><thead><tr><th>Tema</th><th>Média por prova</th><th>Provas</th><th>Nível atual</th><th>Sugerido</th></tr></thead><tbody>
        ${mapeados.map((x) => { const sug = nivelPorIncidencia(x.media); return `<tr><td><button class="link" data-abrir="${x.t.id}">${esc(x.t.nome)}</button></td><td class="num">${x.media.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td><td class="num">${x.provas}</td><td>${NIVEIS[x.t.nivel].nome}</td><td class="${sug < x.t.nivel ? "txt-bad" : ""}">${NIVEIS[sug].nome}</td></tr>`; }).join("")}
      </tbody></table></div>` : `<p class="empty">Nenhuma prova mapeada ainda.</p>`}
    </div>`;
};
