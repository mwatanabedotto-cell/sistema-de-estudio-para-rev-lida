// Service worker do Rumo ao Revalida: funciona sem internet e mostra o lembrete diário em segundo plano.
const VERSAO = "rumo-v2";
const ARQUIVOS = [
  "./", "index.html", "styles.css", "config.js", "data.js", "cards.js", "core.js", "temas.js", "questoes.js",
  "flashcards.js", "plano.js", "painel.js", "ajustes.js", "sync.js", "pwa.js", "main.js",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname.endsWith("supabase.co")) return; // dados da sincronização: sempre pela rede
  if (url.origin === location.origin) {
    // Arquivos do app: rede primeiro (para pegar atualizações), cache se estiver sem internet.
    e.respondWith(fetch(e.request).then((r) => {
      const copia = r.clone();
      caches.open(VERSAO).then((c) => c.put(e.request, copia));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.hostname)) {
    // Fontes e biblioteca: cache primeiro.
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      const copia = resp.clone();
      caches.open(VERSAO).then((c) => c.put(e.request, copia));
      return resp;
    })));
  }
});

function lerResumo() {
  return new Promise((ok) => {
    const r = indexedDB.open("rumo-revalida", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onerror = () => ok(null);
    r.onsuccess = () => {
      const g = r.result.transaction("kv").objectStore("kv").get("resumo");
      g.onsuccess = () => ok({ db: r.result, resumo: g.result });
      g.onerror = () => ok(null);
    };
  });
}
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

self.addEventListener("periodicsync", (e) => {
  if (e.tag !== "lembrete-diario") return;
  e.waitUntil(lerResumo().then(async (x) => {
    const r = x?.resumo;
    if (!r || !r.lembretesOn) return;
    const agora = new Date(), hoje = isoLocal(agora);
    const [h, m] = r.lembrete.split(":").map(Number);
    if (agora.getHours() * 60 + agora.getMinutes() < h * 60 + m) return;
    if (r.ultimoLembrete === hoje || r.swNotificou === hoje) return;
    // Se o resumo é de outro dia, usamos a agenda guardada; se é de hoje, o texto já está pronto.
    const pend = r.agenda?.[hoje] || 0;
    const texto = r.data === hoje ? r.texto : pend ? `${pend} revis${pend === 1 ? "ão pendente" : "ões pendentes"} hoje` : "Mantenha sua sequência: estude hoje.";
    if (!texto) return;
    await self.registration.showNotification("Hora de estudar para o Revalida", { body: texto, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "rumo-lembrete" });
    r.swNotificou = hoje;
    x.db.transaction("kv", "readwrite").objectStore("kv").put(r, "resumo");
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((ws) => {
    const w = ws.find((c) => "focus" in c);
    return w ? w.focus() : self.clients.openWindow("./#revisoes");
  }));
});
