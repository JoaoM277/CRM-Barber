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
//    2. subdomínio de tenant (ex.: barbearia-x.agendar.seudominio.com -> "barbearia-x")
//       — só entra em jogo com 4+ partes no host; "agendar.seudominio.com" (3 partes)
//       é o próprio host do site, não um subdomínio de barbearia, e não deve cair aqui.
//    3. fallback abaixo (troque no deploy se servir uma única barbearia)
// --------------------------------------------------------------------------
(function () {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get("b") || params.get("barbershop");

    const labels = location.hostname.split(".");
    const fromSubdomain =
        labels.length >= 4 && !["www", "app", "api"].includes(labels[0])
            ? labels[0]
            : null;

    window.BARBERSHOP_SLUG = (fromQuery || fromSubdomain || "alpha-barber").trim();
})();
