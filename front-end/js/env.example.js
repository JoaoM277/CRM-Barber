// ==========================================================================
//  Configuração por servidor (produção / staging).
//  Copie para js/env.js no servidor e ajuste. js/env.js fica fora do git.
//  Em dev local não precisa existir (o 404 no console é inofensivo).
// ==========================================================================
window.CRM_ENV = {
    API_BASE_URL: "https://api.SEUDOMINIO.com/api",
    // domínio da página de agendamento do cliente (usado no link mostrado no painel)
    BOOKING_URL: "https://app.SEUDOMINIO.com",
    // barbearia usada quando a URL não traz ?b=slug nem subdomínio
    DEFAULT_BARBERSHOP_SLUG: "alpha-barber",
};
