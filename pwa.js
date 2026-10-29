// App instalável (PWA), notificações e lembrete diário.

let promptInstalar = null, swReg = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); promptInstalar = e; if (aba === "ajustes") render(); });
window.addEventListener("appinstalled", () => { promptInstalar = null; toast("App instalado."); });
const instalavel = () => !!promptInstalar;
const instalado = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
ACOES.instalar = async () => { promptInstalar.prompt(); await promptInstalar.userChoice; promptInstalar = null; render(); };

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").then((r) => { swReg = r; registrarLembreteFundo(); gravarResumo(); }).catch(() => {});
}

function notificar(titulo, corpo) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const o = { body: corpo, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "rumo-" + titulo };
  const direto = () => { try { new Notification(titulo, o); } catch (_) { /* alguns celulares só aceitam via service worker */ } };
  if (swReg?.showNotification) swReg.showNotification(titulo, o).catch(direto); else direto();
}
function textoLembrete() {
  const pend = pendentesHoje();
  const falta = Math.max(0, S.cfg.metaMin - minutosDia(hoje()));
  const partes = [];
  if (pend) partes.push(plural(pend, "revisão pendente", "revisões pendentes"));
  if (falta) partes.push(`faltam ${fmtMin(falta)} para a meta`);
  if (!diaConta(hoje()) && sequencia()) partes.push(`não perca sua sequência de ${plural(sequencia(), "dia", "dias")}`);
  return partes.length ? partes.join(" · ") : null;
}
function verificarLembrete() {
  if (!S.cfg.lembretesOn || !("Notification" in window) || Notification.permission !== "granted") return;
  if (S.cfg.ultimoLembrete === hoje()) return;
  const [h, m] = S.cfg.lembrete.split(":").map(Number);
  const agora = new Date();
  if (agora.getHours() * 60 + agora.getMinutes() < h * 60 + m) return;
  S.cfg.ultimoLembrete = hoje();
  salvar({ semCarimbo: true });
  const txt = textoLembrete();
  if (txt) notificar("Hora de estudar para o Revalida", txt);
}
let contaTick = 0;
TICKS.push(() => { if (++contaTick % 30 === 0) verificarLembrete(); });

// O service worker não lê o localStorage: guardamos um resumo no IndexedDB para o lembrete em segundo plano.
function idb() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open("rumo-revalida", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
  });
}
let resumoT = null;
function gravarResumo() {
  clearTimeout(resumoT);
  resumoT = setTimeout(async () => {
    try {
      const db = await idb();
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put({
        lembretesOn: S.cfg.lembretesOn, lembrete: S.cfg.lembrete, ultimoLembrete: S.cfg.ultimoLembrete,
        data: hoje(), texto: textoLembrete(),
        // Revisões por dia para os próximos 7 dias, caso o app fique fechado.
        agenda: Object.fromEntries(Array.from({ length: 7 }, (_, i) => { const d = addDias(hoje(), i); return [d, TEMAS.filter((t) => { const p = S.temas[t.id]?.prox; return p && (i === 0 ? diff(d, p) <= 0 : p === d); }).length]; })),
      }, "resumo");
    } catch (_) { /* IndexedDB indisponível */ }
  }, 800);
}
AO_SALVAR.push(gravarResumo);
async function registrarLembreteFundo() {
  try {
    if (!swReg || !("periodicSync" in swReg)) return;
    if (!S.cfg.lembretesOn) { await swReg.periodicSync.unregister("lembrete-diario"); return; }
    const st = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (st.state === "granted") await swReg.periodicSync.register("lembrete-diario", { minInterval: 6 * 3600 * 1000 });
  } catch (_) { /* navegador sem suporte: ficam os lembretes com o app aberto e o calendário .ics */ }
}
