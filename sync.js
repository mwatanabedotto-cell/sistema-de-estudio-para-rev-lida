// Sincronização entre aparelhos com Supabase (opcional).
// Configure em config.js (window.RUMO_CONFIG) ou pela aba Ajustes. Sem configuração, o app funciona só no navegador.

const SYNC_CFG_KEY = "rumo-sync-cfg";
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
let sb = null, usuario = null, syncMsg = "", conflito = null, empurrarT = null, carregandoLib = null, aplicandoRemoto = false;

function cfgSync() {
  let l = {};
  try { l = JSON.parse(localStorage.getItem(SYNC_CFG_KEY)) || {}; } catch (_) { l = {}; }
  const g = window.RUMO_CONFIG || {};
  return { url: l.url || g.supabaseUrl || "", key: l.key || g.supabaseAnonKey || "" };
}
const syncConfigurado = () => { const c = cfgSync(); return !!(c.url && c.key); };
function carregarLib() {
  if (window.supabase) return Promise.resolve();
  return (carregandoLib ||= new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = SUPABASE_JS; s.onload = ok;
    s.onerror = () => { carregandoLib = null; erro(new Error("não foi possível carregar a biblioteca do Supabase")); };
    document.head.append(s);
  }));
}
function atualizarSyncUI() { if (aba === "ajustes") render(); }

async function iniciarSync() {
  if (!syncConfigurado()) return;
  const c = cfgSync();
  try {
    await carregarLib();
    sb = window.supabase.createClient(c.url, c.key);
    const { data } = await sb.auth.getSession();
    usuario = data.session?.user || null;
    sb.auth.onAuthStateChange((_ev, sess) => {
      const antes = usuario?.id;
      usuario = sess?.user || null;
      if (usuario && usuario.id !== antes) puxar();
      atualizarSyncUI();
    });
    if (usuario) await puxar();
  } catch (e) {
    syncMsg = `Sem conexão com a sincronização: ${e.message}`;
  }
  atualizarSyncUI();
}

const temProgresso = (s) => s.xp > 0 || Object.keys(s.temas).length > 0 || s.erros.length > 0;
async function puxar() {
  if (!sb || !usuario) return;
  syncMsg = "Sincronizando…"; atualizarSyncUI();
  const { data, error } = await sb.from("progresso").select("dados").eq("user_id", usuario.id).maybeSingle();
  if (error) { syncMsg = `Erro ao baixar: ${error.message}`; atualizarSyncUI(); return; }
  if (!data) { await empurrar(); return; }
  const remoto = data.dados;
  const rT = remoto.atualizadoEm || 0, lT = S.atualizadoEm || 0, base = S.syncBase || 0;
  if (rT === lT) syncMsg = "Em dia";
  else if (base === 0) {
    // Primeiro acesso neste aparelho: só pergunta se houver progresso local.
    if (temProgresso(S)) conflito = remoto; else aplicarRemoto(remoto);
  } else if (rT > base && lT > base) conflito = remoto;
  else if (rT > base) aplicarRemoto(remoto);
  else await empurrar();
  if (conflito) syncMsg = "Escolha quais dados manter";
  atualizarSyncUI();
}
function aplicarRemoto(remoto) {
  aplicandoRemoto = true;
  substituirEstado(JSON.parse(JSON.stringify(remoto)));
  S.syncBase = S.atualizadoEm;
  salvar({ semCarimbo: true });
  aplicandoRemoto = false;
  conflito = null;
  syncMsg = `Em dia · ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  render();
}
async function empurrar() {
  if (!sb || !usuario) return;
  if (!S.atualizadoEm) S.atualizadoEm = Date.now();
  const { error } = await sb.from("progresso").upsert({ user_id: usuario.id, dados: S, atualizado_em: new Date(S.atualizadoEm).toISOString() });
  if (error) { syncMsg = `Erro ao enviar: ${error.message}`; atualizarSyncUI(); return; }
  S.syncBase = S.atualizadoEm;
  salvar({ semCarimbo: true, semGanchos: true });
  syncMsg = `Em dia · ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  atualizarSyncUI();
}
AO_SALVAR.push(() => {
  if (!sb || !usuario || conflito || aplicandoRemoto) return;
  clearTimeout(empurrarT);
  empurrarT = setTimeout(empurrar, 2500);
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") puxar(); });

function textoSync() {
  if (!syncConfigurado()) return "desativada";
  if (!usuario) return "aguardando login";
  return syncMsg || "conectado";
}
function htmlSync() {
  if (!syncConfigurado()) return `
    <p class="note">Para usar o mesmo progresso no celular e no computador, o app guarda seus dados numa conta gratuita do Supabase, com login por e-mail. Crie o projeto seguindo o passo a passo do README (seção “Sincronização”) e cole aqui a URL e a chave pública (anon) do projeto.</p>
    <form id="form-sync-cfg" class="form-row">
      <label>URL do projeto<input id="sy-url" type="url" placeholder="https://xxxx.supabase.co" required></label>
      <label>Chave pública (anon)<input id="sy-key" required placeholder="eyJ..."></label>
      <button class="btn" type="submit">Conectar</button>
    </form>`;
  if (conflito) return `
    <p>Este aparelho e a nuvem têm progresso diferente. Qual você quer manter?</p>
    <div class="actions">
      <button class="btn primary" data-acao="sync-usar-nuvem">Usar os dados da nuvem (${new Date(conflito.atualizadoEm).toLocaleString("pt-BR")})</button>
      <button class="btn" data-acao="sync-usar-local">Manter os deste aparelho e enviar</button>
    </div>
    <p class="note">A opção não escolhida é substituída. Se tiver dúvida, gere antes um backup na seção abaixo.</p>`;
  if (!sb) return `<p class="note">${esc(syncMsg || "Conectando…")}</p><button class="btn small danger" data-acao="sync-esquecer" style="justify-self:start">Remover configuração</button>`;
  if (!usuario) return `
    <form id="form-sync-login" class="form-row">
      <label>Seu e-mail<input id="sy-email" type="email" required placeholder="voce@email.com" autocomplete="email"></label>
      <button class="btn primary" type="submit">Enviar link de acesso</button>
    </form>
    <p class="note">Você recebe um link por e-mail. Abra-o neste aparelho para entrar; repita em cada aparelho.</p>
    <button class="btn small danger" data-acao="sync-esquecer" style="justify-self:start">Remover configuração</button>`;
  return `
    <p>Conectado como <b>${esc(usuario.email)}</b>. Cada mudança é enviada em poucos segundos, e o app baixa a versão mais nova sempre que você volta para ele.</p>
    <div class="actions"><button class="btn" data-acao="sync-agora">Sincronizar agora</button><button class="btn" data-acao="sync-sair">Sair</button></div>`;
}
ENVIOS["form-sync-cfg"] = () => {
  try { localStorage.setItem(SYNC_CFG_KEY, JSON.stringify({ url: $("#sy-url").value.trim().replace(/\/$/, ""), key: $("#sy-key").value.trim() })); } catch (_) {}
  iniciarSync(); render();
};
ENVIOS["form-sync-login"] = async () => {
  const email = $("#sy-email").value.trim();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  toast(error ? `Não foi possível enviar: ${error.message}` : `Link enviado para ${email}. Abra-o neste aparelho.`);
};
ACOES["sync-agora"] = () => puxar();
ACOES["sync-sair"] = async () => { await sb.auth.signOut(); usuario = null; syncMsg = ""; render(); };
ACOES["sync-esquecer"] = () => { try { localStorage.removeItem(SYNC_CFG_KEY); } catch (_) {} sb = null; usuario = null; render(); };
ACOES["sync-usar-nuvem"] = () => { const r = conflito; conflito = null; aplicarRemoto(r); toast("Dados da nuvem aplicados."); };
ACOES["sync-usar-local"] = async () => { conflito = null; S.atualizadoEm = Date.now(); salvar({ semCarimbo: true, semGanchos: true }); await empurrar(); toast("Dados deste aparelho enviados."); };
