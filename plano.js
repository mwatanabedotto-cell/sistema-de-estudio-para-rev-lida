// Plano semanal automático. É recalculado a cada abertura a partir do estado atual:
// se você pular um dia, o que ficou pendente passa para os próximos dias sozinho.

const DUR = { revisao: 25, manutencao: 15, novo: 90, continuar: 45, reforco: 45, erro: 2, card: 0.5, questoes: 60, simulado: 300 };
const TIPOS_PLANO = {
  revisao: { rotulo: "revisão", cls: "today" },
  erros: { rotulo: "erros", cls: "late" },
  cards: { rotulo: "cartões", cls: "soon" },
  continuar: { rotulo: "continuar", cls: "soon" },
  novo: { rotulo: "novo", cls: "new" },
  reforco: { rotulo: "reforço", cls: "late" },
  simulado: { rotulo: "simulado", cls: "done" },
  questoes: { rotulo: "questões", cls: "done" },
};

// Fila de temas novos: primeiro o Nível 1, alternando as áreas e começando pela área menos estudada.
function filaNovos() {
  const fila = [];
  for (const n of [1, 2, 3]) {
    const porArea = AREAS.map((a) => ({ a, l: TEMAS.filter((t) => t.nivel === n && t.area === a.id && !iniciado(t.id)) }))
      .sort((x, y) => pctGeral(TEMAS.filter((t) => t.area === x.a.id)) - pctGeral(TEMAS.filter((t) => t.area === y.a.id)));
    while (porArea.some((g) => g.l.length)) for (const g of porArea) if (g.l.length) fila.push(g.l.shift());
  }
  return fila;
}
function metaSemanal() {
  const p = provaAlvo();
  const restantes = TEMAS.filter((t) => !iniciado(t.id)).length;
  if (!restantes) return 0;
  const semanas = p ? Math.max(1, diff(hoje(), p.data) / 7) : 12;
  return Math.max(2, Math.ceil(restantes / semanas));
}

function gerarPlano() {
  const h = hoje();
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = addDias(h, i);
    return { data: d, capacidade: S.cfg.dispo[parse(d).getDay()] || 0, usado: 0, itens: [] };
  });
  const cabe = (dia, min) => dia.usado + min <= dia.capacidade;
  const add = (dia, item) => { dia.itens.push(item); dia.usado += item.min; };

  // 1. Revisões de tema na data marcada (atrasadas entram hoje); o que não cabe passa para o dia seguinte.
  const revPorDia = {};
  for (const t of TEMAS) {
    const st = S.temas[t.id];
    if (!st?.prox) continue;
    const k = diff(h, st.prox) < 0 ? h : st.prox;
    (revPorDia[k] ||= []).push(t);
  }
  let transbordo = [];
  for (const dia of dias) {
    const fila = [...transbordo, ...(revPorDia[dia.data] || [])];
    transbordo = [];
    for (const t of fila) {
      const st = S.temas[t.id];
      const min = st.revisoes.length >= INTERVALOS.length ? DUR.manutencao : DUR.revisao;
      if (!cabe(dia, min) && dia.itens.length) { transbordo.push(t); continue; }
      const atrasada = diff(dia.data, st.prox) < 0;
      add(dia, { tipo: "revisao", titulo: `${rotuloRevisao(st)}: ${t.nome}`, sub: `${area(t.area).nome}${atrasada ? " · remanejada" : ""}`, min, tema: t.id });
    }
  }

  // 2. Erros do caderno e 3. flashcards vencidos em cada dia.
  for (const dia of dias) {
    const nErros = S.erros.filter((e) => !e.resolvido && e.prox && (dia.data === h ? diff(h, e.prox) <= 0 : e.prox === dia.data)).length;
    if (nErros) add(dia, { tipo: "erros", titulo: `Revisar ${plural(nErros, "erro", "erros")} do caderno`, sub: "Tente lembrar antes de abrir a resposta", min: Math.max(10, Math.round(nErros * DUR.erro)) });
    const vencidos = todosCards().filter((c) => { const p = S.cards[c.id]?.prox; return p && (dia.data === h ? diff(h, p) <= 0 : p === dia.data); }).length;
    const novos = dia.data === h ? Math.max(0, S.cfg.novosCardsDia - novosHoje()) : S.cfg.novosCardsDia;
    const novosDisp = Math.min(novos, todosCards().filter((c) => !S.cards[c.id]).length);
    const n = vencidos + novosDisp;
    if (n) add(dia, { tipo: "cards", titulo: `Flashcards: ${plural(n, "cartão", "cartões")}`, sub: `${vencidos} para revisar · ${novosDisp} novos`, min: Math.min(25, Math.max(5, Math.round(n * DUR.card))) });
  }

  // 4. Um simulado por semana, no dia com mais tempo livre (se couber pelo menos 4 horas).
  const livre = (d) => d.capacidade - d.usado;
  const diaSim = [...dias].sort((a, b) => livre(b) - livre(a))[0];
  const semanaComSimulado = S.simulados.some((s) => diff(s.data, h) < 7 && diff(s.data, h) >= 0);
  if (!semanaComSimulado && livre(diaSim) >= 240) {
    add(diaSim, { tipo: "simulado", titulo: "Simulado: prova anterior do INEP", sub: "100 questões em até 5 h, com o cronômetro de simulado", min: Math.min(DUR.simulado, livre(diaSim)) });
  }

  // 5. Temas em andamento, 6. temas novos e 7. reforço de pontos fracos.
  const andamento = TEMAS.filter((t) => { const st = S.temas[t.id]; return st?.inicio && !ETAPAS.every((e) => st[e.k]); });
  const novos = filaNovos();
  const fracos = pontosFracos().map((f) => f.t);
  const meta = metaSemanal();
  let novosPlanejados = 0, iFraco = 0;
  dias.forEach((dia, i) => {
    if (dia.itens.some((x) => x.tipo === "simulado")) return;
    const cont = andamento.shift();
    if (cont && cabe(dia, DUR.continuar)) {
      const falta = ETAPAS.filter((e) => !S.temas[cont.id][e.k]).map((e) => e.k === "aula" ? "aula" : e.k === "leitura" ? "resumo" : "questões").join(", ");
      add(dia, { tipo: "continuar", titulo: `Continuar: ${cont.nome}`, sub: `Falta: ${falta}`, min: DUR.continuar, tema: cont.id });
    } else if (cont) andamento.unshift(cont);
    while (novosPlanejados < meta && novos.length && cabe(dia, DUR.novo)) {
      const t = novos.shift();
      add(dia, { tipo: "novo", titulo: t.nome, sub: `${area(t.area).nome} · ${NIVEIS[t.nivel].nome} · aula, resumo e questões`, min: DUR.novo, tema: t.id });
      novosPlanejados++;
      if (novosPlanejados >= Math.ceil(meta / 3) * (i + 1)) break; // espalha os temas novos pela semana
    }
    if (fracos[iFraco] && i % 2 === 0 && cabe(dia, DUR.reforco)) {
      const t = fracos[iFraco++];
      add(dia, { tipo: "reforco", titulo: `Reforço: ${t.nome}`, sub: "Releia o resumo, refaça os erros e resolva 15 questões", min: DUR.reforco, tema: t.id });
    }
  });

  // 8. Com bastante tempo livre, adianta um tema novo; o resto vira bloco de questões mistas.
  for (const dia of dias) {
    if (dia.itens.some((x) => x.tipo === "simulado")) continue;
    if (novos.length && livre(dia) >= DUR.novo + 30 && !dia.itens.some((x) => x.tipo === "novo")) {
      const t = novos.shift();
      add(dia, { tipo: "novo", titulo: t.nome, sub: `${area(t.area).nome} · ${NIVEIS[t.nivel].nome} · adiantando o ritmo`, min: DUR.novo, tema: t.id });
      novosPlanejados++;
    }
    const sobra = livre(dia);
    if (sobra >= 20) add(dia, { tipo: "questoes", titulo: "Questões mistas", sub: "Priorize as áreas com menor acerto", min: Math.min(DUR.questoes * 2, sobra) });
  }
  dias.meta = meta;
  dias.novosPlanejados = novosPlanejados;
  return dias;
}

function itemPlano(it) {
  const tp = TIPOS_PLANO[it.tipo];
  const botao = it.tema
    ? `<button class="btn small" data-abrir="${it.tema}">Abrir</button>`
    : `<button class="btn small" data-acao="ir" data-aba="${it.tipo === "cards" ? "flashcards" : "questoes"}">Abrir</button>`;
  return `<div class="agenda-item">
    <span class="pill ${tp.cls}">${tp.rotulo}</span>
    <div class="t"><b>${esc(it.titulo)}</b><div class="muted small">${esc(it.sub)} · ${fmtMin(it.min)}</div></div>
    ${botao}
  </div>`;
}

VIEWS.plano = function renderPlano() {
  const dias = gerarPlano();
  const p = provaAlvo();
  const restantes = TEMAS.filter((t) => !iniciado(t.id)).length;
  const falta = dias.novosPlanejados < dias.meta;
  const totalSemana = S.cfg.dispo.reduce((a, b) => a + b, 0);
  $("#plano").innerHTML = `
    <div class="card" style="display:grid;gap:var(--s-3)">
      <header><h3>Sua semana</h3><span class="muted">${p ? `meta: ${esc(p.edicao)} · ${esc(p.etapa)} em ${plural(diff(hoje(), p.data), "dia", "dias")}` : "sem prova-meta"}</span></header>
      <p>${restantes
        ? `Faltam <b>${plural(restantes, "tema", "temas")}</b> para começar. Ritmo necessário: <b>${plural(dias.meta, "tema novo", "temas novos")} por semana</b>. Nesta semana o plano encaixa <b>${dias.novosPlanejados}</b>.`
        : "Todos os temas já foram iniciados: a semana foca em revisões, reforço e simulados."}</p>
      ${falta && restantes ? `<p class="aviso">Com ${fmtMin(totalSemana)} por semana não cabe o ritmo necessário. Aumente a disponibilidade abaixo ou concentre-se nos temas de Nível 1.</p>` : ""}
      <details><summary class="btn small">Ajustar minha disponibilidade</summary>
        <form id="form-dispo" style="display:grid;gap:var(--s-3);margin-top:var(--s-3)">
          <div class="dispo">${DIAS_SEMANA.map((d, i) => `<label>${d}<input id="dispo-${i}" type="number" min="0" max="16" step="0.5" value="${S.cfg.dispo[i] / 60}"><span class="muted small">horas</span></label>`).join("")}</div>
          <button class="btn primary" type="submit" style="justify-self:start">Salvar e recalcular</button>
        </form>
      </details>
      <p class="note">Como o plano é montado: primeiro as revisões do dia (as atrasadas entram hoje e o excedente passa para o dia seguinte), depois o caderno de erros e os flashcards, um simulado por semana no dia mais livre, temas em andamento, temas novos (Nível 1 primeiro, alternando as áreas), reforço dos pontos fracos e, no tempo que sobra, questões mistas.</p>
    </div>
    <div class="semana">
      ${dias.map((d, i) => `<div class="card dia ${i === 0 ? "hoje-dia" : ""}">
        <header><h3>${i === 0 ? "Hoje" : i === 1 ? "Amanhã" : DIAS_SEMANA[parse(d.data).getDay()]} <span class="muted small">${fmtCurto(d.data)}</span></h3>
          <span class="muted num small">${fmtMin(d.usado)} / ${fmtMin(d.capacidade)}</span></header>
        <div class="bar"><i style="width:${d.capacidade ? Math.min(100, (d.usado / d.capacidade) * 100) : 0}%"></i></div>
        <div class="agenda">${d.itens.map(itemPlano).join("") || `<p class="empty">${d.capacidade ? "Nada agendado." : "Dia de descanso."}</p>`}</div>
      </div>`).join("")}
    </div>`;
};
ENVIOS["form-dispo"] = () => {
  S.cfg.dispo = DIAS_SEMANA.map((_, i) => Math.round(Math.max(0, parseFloat($(`#dispo-${i}`).value) || 0) * 60));
  salvar(); render(); toast("Disponibilidade salva. Plano recalculado.");
};
