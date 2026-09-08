// ==========================================================================
//  Configuração do front-end
//  Em dev/LAN a URL da API é deduzida do host atual (localhost, IP da rede...).
//  Em produção, fixe a URL pública da API aqui:
//    window.API_BASE_URL = "https://api.suabarbearia.com/api";
// ==========================================================================
window.API_BASE_URL = `${location.protocol}//${location.hostname}:8000/api`;

// --------------------------------------------------------------------------
//  Multi-tenant: qual barbearia esta página de agendamento representa.
//  Ordem de resolução:
//    1. ?b=slug  (ou ?barbershop=slug) na URL
//    2. subdomínio  (ex.: barbearia-x.agendar.seudominio.com -> "barbearia-x")
//    3. fallback abaixo (troque no deploy se servir uma única barbearia)
// --------------------------------------------------------------------------
(function () {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get("b") || params.get("barbershop");

    const labels = location.hostname.split(".");
    const fromSubdomain =
        labels.length >= 3 && !["www", "app", "api"].includes(labels[0])
            ? labels[0]
            : null;

    window.BARBERSHOP_SLUG = (fromQuery || fromSubdomain || "alpha-barber").trim();
})();
