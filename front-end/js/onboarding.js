// ==========================================================================
//  Guia de primeiros passos (Visão Geral do painel).
//  Carregado depois de admin.js — usa authHeaders, checarSessao,
//  mostrarToastAdmin, API_BASE_URL e as funções render* de lá.
// ==========================================================================
(function () {
  const card = document.getElementById("onb-card");
  if (!card) return;

  const params = new URLSearchParams(location.search);
  const boasVindas = params.has("bem-vindo");
  if (boasVindas) {
    params.delete("bem-vindo");
    history.replaceState(null, "", location.pathname + (params.toString() ? `?${params}` : ""));
  }

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const irPara = (aba) => document.querySelector(`.menu-item[data-tab="${aba}"]`)?.click();
  let linkAgendamento = "";

  async function api(path, metodo = "GET") {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: metodo,
      headers: authHeaders(metodo === "GET" ? {} : { "Content-Type": "application/json" }),
    });
    if (!(await checarSessao(res))) throw new Error("sessão");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Não foi possível concluir.");
    return data;
  }

  async function marcar(passo) {
    try {
      const r = await fetch(`${API_BASE_URL}/onboarding/marcar`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ passo }),
      });
      if (r.ok) desenhar(await r.json());
    } catch (e) { /* o guia é auxiliar: falha aqui não atrapalha o painel */ }
  }

  function acoes(passo) {
    switch (passo.id) {
      case "servicos":
        return `<button class="principal" data-acao="servicos-padrao">Usar serviços de exemplo</button>
                <button data-acao="ir-servicos">Cadastrar os meus</button>`;
      case "profissionais":
        return '<button class="principal" data-acao="ir-profissionais">Cadastrar profissional</button>';
      case "horarios":
        return `<button data-acao="ver-horarios">Ver horários</button>
                <button class="principal" data-acao="marcar-horarios">Já conferi</button>`;
      case "whatsapp":
        return '<button class="principal" data-acao="ir-whatsapp">Conectar WhatsApp</button>';
      case "link":
        return `<div class="onb-link">
                  <input class="admin-input" readonly value="${esc(linkAgendamento)}" aria-label="Seu link de agendamento" onclick="this.select()">
                  <button class="principal" data-acao="copiar-link">Copiar link</button>
                </div>`;
      case "agendamento":
        return `<a href="${esc(linkAgendamento)}" target="_blank" rel="noopener">Abrir minha página de agendamento</a>`;
      default:
        return "";
    }
  }

  function desenhar(d) {
    if (d.concluido || d.dispensado) {
      card.style.display = "none";
      return;
    }
    linkAgendamento = `${location.origin}/index.html?b=${encodeURIComponent(d.slug)}`;
    const pct = Math.round((d.feitos / d.total) * 100);

    card.innerHTML = `
      <div class="onb-topo">
        <div>
          <h2 id="onb-titulo">${boasVindas ? "Bem-vindo(a)! Sua barbearia está no ar 🎉" : "Primeiros passos"}</h2>
          <p>${d.feitos} de ${d.total} concluídos — falta pouco para receber o primeiro agendamento.</p>
        </div>
        <button class="onb-ocultar" data-acao="dispensar">Ocultar guia</button>
      </div>
      <div class="onb-progresso" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <ol class="onb-lista">
        ${d.passos.map((p) => `
          <li class="onb-passo ${p.feito ? "feito" : ""}">
            <span class="onb-marca" aria-hidden="true">${p.feito ? "✓" : ""}</span>
            <div class="onb-texto">
              <strong>${esc(p.titulo)}</strong>
              ${p.feito ? "" : `<p>${esc(p.descricao)}</p><div class="onb-acoes">${acoes(p)}</div>`}
            </div>
          </li>`).join("")}
      </ol>`;
    card.style.display = "";
  }

  async function carregar() {
    try {
      desenhar(await api("/onboarding"));
    } catch (e) { /* sem guia se a API falhar */ }
  }

  card.addEventListener("click", async (ev) => {
    const alvo = ev.target.closest("[data-acao]");
    if (!alvo) return;

    switch (alvo.dataset.acao) {
      case "servicos-padrao":
        try {
          const r = await api("/onboarding/servicos-padrao", "POST");
          mostrarToastAdmin(r.message);
          if (typeof renderServicos === "function") renderServicos();
          carregar();
        } catch (e) {
          mostrarToastAdmin(e.message, "erro");
        }
        break;
      case "ir-servicos":
        irPara("servicos");
        break;
      case "ir-profissionais":
        irPara("barbeiros");
        if (typeof abrirModalBarbeiro === "function") abrirModalBarbeiro();
        break;
      case "ver-horarios":
        document.getElementById("expediente-body")?.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      case "marcar-horarios":
        marcar("horarios");
        break;
      case "ir-whatsapp":
        irPara("instancias");
        break;
      case "copiar-link":
        try {
          await navigator.clipboard.writeText(linkAgendamento);
          mostrarToastAdmin("Link copiado! Cole na bio do Instagram e no WhatsApp.");
        } catch (e) {
          card.querySelector(".onb-link input")?.select();
        }
        marcar("link");
        break;
      case "dispensar":
        marcar("dispensar");
        break;
    }
  });

  // salvar os horários conta como "conferi"
  document.getElementById("btn-salvar-expediente")?.addEventListener("click", () => setTimeout(() => marcar("horarios"), 800));

  // ao voltar para a Visão Geral, atualiza o progresso (ex.: cadastrou um serviço em outra aba)
  document.querySelector('.menu-item[data-tab="dashboard"]')?.addEventListener("click", carregar);

  carregar();
})();
