// ==========================================================================
//  ASSINATURA DO SISTEMA (plano, pagamento via Asaas, faturas)
//  Carregado depois de admin.js — usa authHeaders, checarSessao, moedaBR,
//  mostrarToastAdmin, abrirModalConfirmacao e API_BASE_URL de lá.
// ==========================================================================

// Recusas por assinatura/plano (402 modo leitura, 403 recurso/limite do plano)
// viram uma mensagem clara, independente de como cada tela trata o erro.
(function () {
  const fetchOriginal = window.fetch.bind(window);
  const CODIGOS = ["subscription_inactive", "plan_feature", "plan_limit"];
  window.fetch = async (...args) => {
    const res = await fetchOriginal(...args);
    if (res.status === 402 || res.status === 403) {
      res.clone().json().then((body) => {
        if (body && CODIGOS.includes(body.code)) {
          // depois do toast genérico da tela, para a mensagem certa ficar visível
          setTimeout(() => mostrarToastAdmin(body.message, "erro"), 60);
        }
      }).catch(() => {});
    }
    return res;
  };
})();

const ROTULO_RECURSO = { whatsapp: "WhatsApp automático", financeiro: "Financeiro e comissões" };
const ROTULO_FORMA = { PIX: "Pix", BOLETO: "Boleto", CREDIT_CARD: "Cartão" };
const ROTULO_FATURA = {
  PENDING: "Em aberto", OVERDUE: "Vencida", CONFIRMED: "Paga", RECEIVED: "Paga",
  RECEIVED_IN_CASH: "Paga", REFUNDED: "Estornada", DELETED: "Cancelada",
};
let assinaturaAtual = null;

function dataBR(iso) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}

function renderBannerAssinatura(a) {
  const el = document.getElementById("assinatura-banner");
  if (!el) return;
  el.style.display = "none";
  el.className = "assinatura-banner";
  if (!a) return;

  let texto = "";
  let tipo = "aviso";
  const dias = a.acesso_ate ? Math.ceil((new Date(a.acesso_ate) - Date.now()) / 86400000) : null;

  if (a.acesso === "read_only") {
    tipo = "erro";
    texto = "Sua assinatura não está ativa: o painel está em modo leitura.";
  } else if (a.em_carencia) {
    texto = `Há uma fatura em atraso. Regularize em até ${dias} dia(s) para não perder o acesso.`;
  } else if (a.status === "trialing" && !a.tem_assinatura_no_gateway && dias !== null && dias <= 7) {
    texto = `Seu teste grátis termina em ${dias} dia(s). Escolha um plano para continuar.`;
  } else if (a.status === "canceled") {
    texto = `Assinatura cancelada. O acesso vai até ${dataBR(a.acesso_ate)}.`;
  }
  if (!texto) return;

  el.classList.add(tipo);
  el.innerHTML = `<span>${texto}</span><button type="button">Ver assinatura</button>`;
  el.querySelector("button").onclick = () =>
    document.querySelector('.menu-item[data-tab="assinatura"]')?.click();
  el.style.display = "flex";
}

function textoStatusAssinatura(a) {
  if (!a) return "Nenhuma assinatura encontrada.";
  const plano = a.plano ? a.plano.nome : "—";
  const forma = a.forma_pagamento ? ` · ${ROTULO_FORMA[a.forma_pagamento] || a.forma_pagamento}` : "";
  switch (a.status) {
    case "trialing":
      return a.acesso === "full"
        ? `Teste grátis com tudo liberado até <strong>${dataBR(a.trial_termina_em)}</strong>.`
          + (a.tem_assinatura_no_gateway ? ` Plano escolhido: <strong>${plano}</strong>${forma}.` : "")
        : `Seu teste grátis terminou em ${dataBR(a.trial_termina_em)}. Escolha um plano abaixo para continuar.`;
    case "active":
      return `Plano <strong>${plano}</strong> ativo. Pago até <strong>${dataBR(a.periodo_pago_ate)}</strong>${forma}.`;
    case "past_due":
      return a.acesso === "full"
        ? `Plano <strong>${plano}</strong> com fatura em atraso. O acesso continua até <strong>${dataBR(a.acesso_ate)}</strong>.`
        : `Plano <strong>${plano}</strong> com fatura em atraso. O painel está em modo leitura até o pagamento.`;
    case "canceled":
      return `Assinatura cancelada. Acesso até <strong>${dataBR(a.acesso_ate)}</strong>. Escolha um plano para voltar.`;
    default:
      return a.status;
  }
}

function selecionarPlano(slug) {
  document.getElementById("assinatura-plano").value = slug;
  document.querySelectorAll(".plano-card").forEach((c) =>
    c.classList.toggle("selecionado", c.dataset.slug === slug));
  atualizarResumoAssinatura();
}

function atualizarResumoAssinatura() {
  const resumo = document.getElementById("assinatura-resumo");
  if (!resumo) return;
  const forma = document.getElementById("assinatura-forma").value;
  const a = assinaturaAtual;
  let txt = forma === "CREDIT_CARD"
    ? "Você preenche o cartão na página segura do Asaas; as próximas mensalidades são cobradas automaticamente."
    : "Você recebe o link da cobrança; as próximas mensalidades chegam por e-mail.";
  if (a && a.status === "trialing" && a.acesso === "full") {
    txt += ` A primeira cobrança só vence no fim do teste (${dataBR(a.trial_termina_em)}).`;
  }
  resumo.textContent = txt;
}

async function renderAssinatura() {
  const statusEl = document.getElementById("assinatura-status");
  if (!statusEl) return;

  try {
    const res = await fetch(`${API_BASE_URL}/assinatura`, { headers: authHeaders() });
    if (!(await checarSessao(res))) return;
    if (res.status === 403) {
      // usuário comum não gerencia a assinatura
      document.querySelector('.menu-item[data-tab="assinatura"]')?.remove();
      return;
    }
    if (!res.ok) throw new Error();
    const { assinatura, planos, faturas } = await res.json();
    assinaturaAtual = assinatura;

    statusEl.innerHTML = textoStatusAssinatura(assinatura);
    renderBannerAssinatura(assinatura);

    const atual = assinatura && assinatura.plano ? assinatura.plano.slug : null;
    const contratado = !!(assinatura && assinatura.tem_assinatura_no_gateway && assinatura.status !== "canceled");

    document.getElementById("planos-grid").innerHTML = planos.map((p) => `
      <button type="button" class="plano-card" data-slug="${p.slug}">
        <div class="plano-nome">${p.nome}</div>
        <div class="plano-preco">${moedaBR(p.preco)}<small>/mês</small></div>
        <ul>
          <li>${p.max_profissionais ? `Até ${p.max_profissionais} profissionais` : "Profissionais ilimitados"}</li>
          <li>Agenda e site de agendamento</li>
          ${p.recursos.map((r) => `<li>${ROTULO_RECURSO[r] || r}</li>`).join("")}
        </ul>
        ${p.slug === atual && contratado ? '<span class="plano-atual">● Seu plano</span>' : ""}
      </button>`).join("");
    document.querySelectorAll(".plano-card").forEach((c) =>
      c.addEventListener("click", () => selecionarPlano(c.dataset.slug)));

    const sugerido = planos.find((p) => p.slug === "pro") || planos[0];
    selecionarPlano(contratado ? atual : sugerido.slug);

    if (assinatura && assinatura.forma_pagamento) {
      document.getElementById("assinatura-forma").value = assinatura.forma_pagamento;
    }
    // CPF/CNPJ só é pedido na primeira assinatura
    document.getElementById("assinatura-cpf-group").style.display = contratado ? "none" : "";
    document.getElementById("btn-assinar").textContent = contratado
      ? "Alterar plano / forma de pagamento"
      : "Continuar para o pagamento";
    document.getElementById("btn-cancelar-assinatura").style.display = contratado ? "" : "none";
    atualizarResumoAssinatura();

    const corpo = document.getElementById("faturas-table-body");
    corpo.innerHTML = faturas.length
      ? faturas.map((f) => `
        <tr>
          <td>${f.vencimento ? f.vencimento.split("-").reverse().join("/") : "—"}</td>
          <td>${moedaBR(f.valor)}</td>
          <td>${ROTULO_FORMA[f.forma_pagamento] || "—"}</td>
          <td>${ROTULO_FATURA[f.status] || f.status}</td>
          <td>${f.link && ["PENDING", "OVERDUE"].includes(f.status)
            ? `<a href="${f.link}" target="_blank" rel="noopener" class="btn-secondary">Pagar</a>` : ""}</td>
        </tr>`).join("")
      : '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Nenhuma fatura ainda.</td></tr>';
  } catch (e) {
    statusEl.textContent = "Não foi possível carregar a assinatura.";
  }
}

document.getElementById("assinatura-forma")?.addEventListener("change", atualizarResumoAssinatura);

document.getElementById("form-assinatura")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = document.getElementById("btn-assinar");
  const corpo = {
    plano: document.getElementById("assinatura-plano").value,
    forma_pagamento: document.getElementById("assinatura-forma").value,
  };
  const cpf = document.getElementById("assinatura-cpf").value.trim();
  if (cpf) corpo.cpf_cnpj = cpf;

  // abre a aba ainda no clique (senão o bloqueador de pop-up barra) e só
  // depois aponta para o link de pagamento
  const janela = window.open("", "_blank");
  btn.disabled = true;
  try {
    const res = await fetch(`${API_BASE_URL}/assinatura`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(corpo),
    });
    if (!(await checarSessao(res))) return;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      janela?.close();
      const msg = data.errors ? Object.values(data.errors).flat()[0] : data.message;
      mostrarToastAdmin(msg || "Não foi possível concluir.", "erro");
      return;
    }
    if (data.link_pagamento && janela) {
      janela.location.href = data.link_pagamento;
    } else {
      janela?.close();
    }
    mostrarToastAdmin(data.link_pagamento
      ? "Cobrança gerada! Conclua o pagamento na aba que abriu."
      : "Assinatura atualizada.");
    await renderAssinatura();
  } catch (e) {
    janela?.close();
    mostrarToastAdmin("Erro de conexão com o servidor.", "erro");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("btn-cancelar-assinatura")?.addEventListener("click", () => {
  abrirModalConfirmacao(
    "Cancelar assinatura",
    "A renovação para e o acesso continua até o fim do período já pago.",
    "Cancelar assinatura",
    "danger",
    async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/assinatura`, { method: "DELETE", headers: authHeaders() });
        const data = await res.json().catch(() => ({}));
        mostrarToastAdmin(
          data.message || (res.ok ? "Assinatura cancelada." : "Não foi possível cancelar."),
          res.ok ? "sucesso" : "erro"
        );
        await renderAssinatura();
      } catch (e) {
        mostrarToastAdmin("Erro de conexão com o servidor.", "erro");
      }
    }
  );
});

renderAssinatura();

// --------------------------------------------------------------------------
// Faixa de "modo suporte" (sessão aberta pelo painel universal)
// --------------------------------------------------------------------------
(async function () {
  try {
    const res = await fetch(`${API_BASE_URL}/me`, { headers: authHeaders() });
    if (!res.ok) return;
    const me = await res.json();
    if (!me.suporte) return;

    const faixa = document.createElement("div");
    faixa.className = "suporte-faixa";
    faixa.innerHTML = '<span>🛟 Modo suporte: você está no painel desta barbearia como administrador da plataforma. Senha, assinatura e usuários ficam bloqueados.</span><button type="button">Encerrar acesso</button>';
    faixa.querySelector("button").onclick = async () => {
      try {
        await fetch(`${API_BASE_URL}/logout`, { method: "POST", headers: authHeaders() });
      } finally {
        localStorage.removeItem("admin_token");
        window.close();
        window.location.href = "login.html";
      }
    };
    document.body.prepend(faixa);
    document.body.classList.add("com-suporte");
  } catch (e) {
    /* sem faixa se /me falhar — o resto do painel segue normal */
  }
})();
