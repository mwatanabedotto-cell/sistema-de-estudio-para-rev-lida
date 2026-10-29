// Inicialização: abre a aba do endereço (#temas, #plano...) e liga sincronização e lembretes.
const inicial = (location.hash || "").slice(1);
if (ABAS.includes(inicial)) aba = inicial;
$("#gaveta-bg").addEventListener("click", () => fecharGaveta());
render();
iniciarSync();
verificarLembrete();
