// Abas Provas e Ajustes.

VIEWS.provas = function renderProvas() {
  const alvo = provaAlvo();
  $("#provas").innerHTML = `
    <div class="card">
      <header><h3>Calendário do Revalida (INEP)</h3><a href="https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/revalida" target="_blank" rel="noopener">Ver editais no site do INEP</a></header>
      <p class="note" style="margin-bottom:var(--s-3)">O Revalida tem duas edições por ano. A 1ª etapa é a prova teórica e a 2ª etapa é a prova de habilidades clínicas, só para quem foi aprovado na 1ª. Datas marcadas como “provável” são estimativas feitas a partir das edições anteriores: confirme sempre no edital e ajuste aqui.</p>
      <div class="exam-list">
        ${provasOrdenadas().map((p) => {
          const d = parse(p.data);
          const passada = diff(hoje(), p.data) < 0;
          const ehAlvo = alvo && alvo.id === p.id;
          return `<div class="exam ${passada ? "past" : ""} ${ehAlvo ? "target" : ""}">
            <div class="date"><b>${String(d.getDate()).padStart(2, "0")}</b>${MESES[d.getMonth()]} ${d.getFullYear()}</div>
            <div style="min-width:0">
              <b>${esc(p.edicao)}</b> · ${esc(p.etapa)}
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin:3px 0">
                <span class="pill ${p.tipo === "confirmada" ? "done" : "soon est"}">${p.tipo === "confirmada" ? "data oficial" : "data provável"}</span>
                <span class="pill soon">${passada ? "realizada" : diff(hoje(), p.data) === 0 ? "é hoje" : `faltam ${diff(hoje(), p.data)} dias`}</span>
              </div>
              <div class="muted small">${esc(p.obs)}</div>
            </div>
            <div class="actions">
              ${passada ? "" : `<button class="btn small ${ehAlvo ? "primary" : ""}" data-acao="prova-alvo" data-id="${p.id}">${ehAlvo ? "Minha meta" : "Definir como meta"}</button>`}
              <button class="btn small" data-acao="prova-editar" data-id="${p.id}">Editar</button>
              <button class="btn small danger" data-acao="prova-remover" data-id="${p.id}">Remover</button>
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
      <label class="campo">Observação<input id="p-obs" placeholder="Ex.: edital publicado no DOU em..."></label>
      <div class="actions"><button class="btn primary" type="submit">Salvar data</button><button class="btn" type="button" data-acao="prova-limpar">Limpar</button></div>
    </form>`;
};
ACOES["prova-alvo"] = (el) => { S.alvo = el.dataset.id; salvar(); render(); toast("Prova definida como meta."); };
ACOES["prova-editar"] = (el) => {
  const p = S.provas.find((x) => x.id === el.dataset.id);
  $("#p-id").value = p.id; $("#p-edicao").value = p.edicao; $("#p-etapa").value = p.etapa;
  $("#p-data").value = p.data; $("#p-tipo").value = p.tipo; $("#p-obs").value = p.obs || "";
  $("#form-titulo").textContent = `Editando: ${p.edicao} · ${p.etapa}`;
  $("#form-prova").scrollIntoView({ behavior: "smooth", block: "center" });
};
ACOES["prova-limpar"] = () => { $("#form-prova").reset(); $("#p-id").value = ""; $("#form-titulo").textContent = "Adicionar ou corrigir data"; };
ACOES["prova-remover"] = (el) => {
  const id = el.dataset.id;
  confirmar(el, "rm-" + id, "Confirmar remoção", () => {
    S.provas = S.provas.filter((x) => x.id !== id);
    if (PROVAS_PADRAO.some((p) => p.id === id)) S.removidas.push(id);
    salvar(); render(); toast("Data removida.");
  });
};
ENVIOS["form-prova"] = () => {
  const id = $("#p-id").value || uid("p");
  const dados = { id, edicao: $("#p-edicao").value.trim(), etapa: $("#p-etapa").value, data: $("#p-data").value, tipo: $("#p-tipo").value, obs: $("#p-obs").value.trim() };
  const i = S.provas.findIndex((x) => x.id === id);
  if (i >= 0) S.provas[i] = dados; else S.provas.push(dados);
  salvar(); render(); toast("Data salva.");
};

// ── Calendário .ics (lembretes no celular) ────────────────────
function gerarIcs() {
  const [hh, mm] = S.cfg.lembrete.split(":");
  const carimbo = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const dt = (d, h = hh, m = mm) => `${d.replace(/-/g, "")}T${h}${m}00`;
  const fim = (d) => { const x = new Date(parse(d)); x.setHours(+hh, +mm + 30); return `${iso(x).replace(/-/g, "")}T${String(x.getHours()).padStart(2, "0")}${String(x.getMinutes()).padStart(2, "0")}00`; };
  const txt = (s) => s.replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const ev = [];
  const alarme = "BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Rumo ao Revalida\r\nTRIGGER:PT0M\r\nEND:VALARM";
  // Revisões dos próximos 60 dias, agrupadas por dia.
  const porDia = {};
  for (const t of TEMAS) {
    const st = S.temas[t.id];
    if (!st?.prox) continue;
    const d = diff(hoje(), st.prox) < 0 ? hoje() : st.prox;
    if (diff(hoje(), d) <= 60) (porDia[d] ||= []).push(`${rotuloRevisao(st)} ${t.nome}`);
  }
  for (const [d, l] of Object.entries(porDia)) {
    ev.push(`BEGIN:VEVENT\r\nUID:rev-${d}@rumo-revalida\r\nDTSTAMP:${carimbo}\r\nDTSTART:${dt(d)}\r\nDTEND:${fim(d)}\r\nSUMMARY:${txt(`Revalida: ${plural(l.length, "revisão", "revisões")}`)}\r\nDESCRIPTION:${txt(l.join("\n"))}\r\n${alarme}\r\nEND:VEVENT`);
  }
  // Lembrete diário de estudo.
  ev.push(`BEGIN:VEVENT\r\nUID:diario@rumo-revalida\r\nDTSTAMP:${carimbo}\r\nDTSTART:${dt(hoje())}\r\nDTEND:${fim(hoje())}\r\nRRULE:FREQ=DAILY\r\nSUMMARY:${txt(`Estudar para o Revalida (meta ${fmtMin(S.cfg.metaMin)})`)}\r\n${alarme}\r\nEND:VEVENT`);
  // Provas futuras como eventos de dia inteiro.
  for (const p of provasOrdenadas().filter((x) => diff(hoje(), x.data) >= 0)) {
    ev.push(`BEGIN:VEVENT\r\nUID:${p.id}@rumo-revalida\r\nDTSTAMP:${carimbo}\r\nDTSTART;VALUE=DATE:${p.data.replace(/-/g, "")}\r\nDTEND;VALUE=DATE:${addDias(p.data, 1).replace(/-/g, "")}\r\nSUMMARY:${txt(`${p.edicao}: ${p.etapa}${p.tipo === "estimativa" ? " (data provável)" : ""}`)}\r\nEND:VEVENT`);
  }
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Rumo ao Revalida//PT-BR\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Rumo ao Revalida\r\n${ev.join("\r\n")}\r\nEND:VCALENDAR\r\n`;
}
ACOES["ics-baixar"] = () => { baixarArquivo("rumo-ao-revalida.ics", gerarIcs(), "text/calendar"); toast("Arquivo do calendário gerado."); };

// ── Aba Ajustes ───────────────────────────────────────────────
VIEWS.ajustes = function renderAjustes() {
  const c = S.cfg;
  const perm = "Notification" in window ? Notification.permission : "indisponivel";
  $("#ajustes").innerHTML = `
    <form class="card" id="form-cfg" style="display:grid;gap:var(--s-3)">
      <header><h3>Meta diária e cronômetro</h3></header>
      <div class="form-row">
        <label>Meta diária (min)<input id="c-meta" type="number" min="10" step="10" value="${c.metaMin}"></label>
        <label>Foco do Pomodoro (min)<input id="c-foco" type="number" min="5" max="120" value="${c.foco}"></label>
        <label>Pausa (min)<input id="c-pausa" type="number" min="1" max="60" value="${c.pausa}"></label>
        <label>Flashcards novos por dia<input id="c-cards" type="number" min="0" max="200" value="${c.novosCardsDia}"></label>
      </div>
      <label class="step"><input type="checkbox" id="c-exigida" ${c.metaExigida ? "checked" : ""}> O dia só conta na sequência quando eu atingir a meta diária de tempo</label>
      <button class="btn primary" type="submit" style="justify-self:start">Salvar</button>
    </form>

    <div class="card" style="display:grid;gap:var(--s-3)">
      <header><h3>Lembretes</h3><span class="muted">${perm === "granted" ? "notificações permitidas" : perm === "denied" ? "notificações bloqueadas no navegador" : perm === "indisponivel" ? "notificações indisponíveis aqui" : "notificações não ativadas"}</span></header>
      <div class="form-row">
        <label>Horário do lembrete<input id="c-hora" type="time" value="${c.lembrete}" data-mudar="c-hora"></label>
        ${perm === "granted"
          ? `<label class="step" style="flex:2 1 260px"><input type="checkbox" data-mudar="c-lembretes" ${c.lembretesOn ? "checked" : ""}> Avisar no horário se houver revisões pendentes ou a meta não foi atingida</label>`
          : `<button class="btn" data-acao="pedir-notificacao" ${perm === "indisponivel" || perm === "denied" ? "disabled" : ""}>Ativar notificações</button>`}
      </div>
      <p class="note">As notificações funcionam com o app aberto ou instalado. No Android com o app instalado, o navegador também pode avisar em segundo plano. Para um lembrete garantido em qualquer celular, adicione o calendário abaixo: ele cria um lembrete diário no horário escolhido, os dias com revisões dos próximos 60 dias e as datas das provas. Gere de novo uma vez por semana, porque as revisões mudam conforme você estuda.</p>
      <button class="btn" data-acao="ics-baixar" style="justify-self:start">Baixar calendário (.ics)</button>
    </div>

    <div class="card" style="display:grid;gap:var(--s-3)">
      <header><h3>Sincronização entre aparelhos</h3><span class="muted" id="sync-estado">${textoSync()}</span></header>
      ${htmlSync()}
    </div>

    <div class="card" style="display:grid;gap:var(--s-3)">
      <header><h3>Instalar no celular ou computador</h3></header>
      <p class="note">Instalado, o app abre em tela cheia, funciona sem internet e pode enviar lembretes.</p>
      ${instalavel() ? `<button class="btn primary" data-acao="instalar" style="justify-self:start">Instalar o app</button>` : ""}
      <p class="note">${instalado() ? "O app já está instalado neste aparelho." : "No iPhone: abra no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. No Android ou no computador: use o botão acima ou o menu do navegador, opção “Instalar app”."}</p>
    </div>

    <div class="card" style="display:grid;gap:var(--s-3)">
      <header><h3>Backup do progresso</h3></header>
      <p class="note">Sem a sincronização, seu progresso fica só neste navegador. Copie o código abaixo para guardar ou levar para outro aparelho, e cole-o lá para restaurar.</p>
      <textarea id="backup" aria-label="Código de backup" spellcheck="false"></textarea>
      <div class="actions">
        <button class="btn" data-acao="b-gerar">Gerar código</button>
        <button class="btn" data-acao="b-copiar">Copiar</button>
        <button class="btn" data-acao="b-baixar">Baixar arquivo</button>
        <button class="btn" data-acao="b-importar">Restaurar do código colado</button>
        <button class="btn danger" data-acao="b-zerar">Apagar todo o progresso</button>
      </div>
    </div>`;
};
ENVIOS["form-cfg"] = () => {
  const n = (id, min, padrao) => Math.max(min, parseInt($(id).value, 10) || padrao);
  Object.assign(S.cfg, { metaMin: n("#c-meta", 10, 120), foco: n("#c-foco", 5, 25), pausa: n("#c-pausa", 1, 5), novosCardsDia: n("#c-cards", 0, 20), metaExigida: $("#c-exigida").checked });
  salvar(); render(); toast("Ajustes salvos.");
};
MUDANCAS["c-hora"] = (el) => { S.cfg.lembrete = el.value || "19:00"; S.cfg.ultimoLembrete = null; salvar(); };
MUDANCAS["c-lembretes"] = (el) => { S.cfg.lembretesOn = el.checked; salvar(); registrarLembreteFundo(); toast(el.checked ? "Lembretes ativados." : "Lembretes desativados."); };
ACOES["pedir-notificacao"] = async () => {
  const r = await Notification.requestPermission();
  if (r === "granted") { S.cfg.lembretesOn = true; salvar(); registrarLembreteFundo(); notificar("Lembretes ativados", `Você será avisado às ${S.cfg.lembrete}.`); }
  render();
};

const exportar = () => JSON.stringify(S);
ACOES["b-gerar"] = () => { $("#backup").value = exportar(); toast("Código gerado."); };
ACOES["b-copiar"] = () => {
  const ta = $("#backup");
  if (!ta.value) ta.value = exportar();
  const falhou = () => { ta.select(); toast("Selecionei o código: copie com Ctrl+C."); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(ta.value).then(() => toast("Código copiado."), falhou);
  else falhou();
};
ACOES["b-baixar"] = () => baixarArquivo(`rumo-revalida-backup-${hoje()}.json`, exportar(), "application/json");
ACOES["b-importar"] = (el) => {
  let novo;
  try { novo = JSON.parse($("#backup").value); } catch (_) { novo = null; }
  if (!novo || novo.v !== 1 || typeof novo.temas !== "object") { toast("Código inválido. Cole o código completo gerado pelo app."); return; }
  confirmar(el, "imp", "Substituir progresso atual?", () => { substituirEstado(novo); salvar(); render(); toast("Progresso restaurado."); });
};
ACOES["b-zerar"] = (el) => confirmar(el, "zerar", "Clique de novo para apagar tudo", () => {
  const syncBase = S.syncBase; substituirEstado(estadoNovo()); S.syncBase = syncBase; salvar(); render(); toast("Progresso apagado.");
});
