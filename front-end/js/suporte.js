// ==========================================================================
//  Acesso de suporte: o painel universal abre admin.html#suporte=<token>.
//  Roda ANTES de admin.js — guarda o token como sessão do painel e limpa a
//  URL (o token não fica no histórico nem vaza se a URL for copiada).
// ==========================================================================
(function () {
  const m = location.hash.match(/^#suporte=(.+)$/);
  if (!m) return;
  localStorage.setItem("admin_token", decodeURIComponent(m[1]));
  history.replaceState(null, "", location.pathname + location.search);
})();
