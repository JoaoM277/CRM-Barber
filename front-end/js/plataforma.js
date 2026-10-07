// ==========================================================================
//  Painel universal (administração da plataforma)
//  Sessão separada do painel das barbearias: token em "platform_token".
// ==========================================================================
const API = window.API_BASE_URL || "http://localhost:8000/api";
const TOKEN_KEY = "platform_token";

// ---------------------------------------------------------------- utilidades
const $ = (sel) => document.querySelector(sel);

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = (v) => Number(v || 0).toLocaleString("pt-BR");
const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const dataHoraBR = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

function relativo(iso) {
  if (!iso) return "nunca";
  const dias = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}

function toast(msg, tipo = "sucesso") {
  const el = $("#admin-toast");
  $("#admin-toast-texto").innerText = msg;
  el.className = `toast-visivel ${tipo === "erro" ? "toast-erro" : "toast-sucesso"}`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.className = "toast-escondido"), 3500);
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    if (path === "/plataforma/me" || res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "login.html";
      throw new Error("sessão");
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.errors ? Object.values(data.errors).flat()[0] : data.message;
    throw new Error(msg || "Não foi possível concluir.");
  }
  return data;
}

// ---------------------------------------------------------------- navegação
function abrirAba(tab) {
  if (!document.getElementById(`panel-${tab}`)) tab = "visao";
  history.replaceState(null, "", tab === "visao" ? location.pathname : `#${tab}`);
  document.querySelectorAll(".menu-item").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${tab}`));
  $("#sidebar").classList.remove("open");
  $("#drawer-backdrop").classList.remove("active");
  if (tab === "barbearias") carregarBarbearias();
  if (tab === "config") carregarConfig();
}
document.querySelectorAll(".menu-item").forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.tab)));
$("#btn-abrir-menu").addEventListener("click", () => {
  $("#sidebar").classList.add("open");
  $("#drawer-backdrop").classList.add("active");
});
$("#drawer-backdrop").addEventListener("click", () => {
  $("#sidebar").classList.remove("open");
  $("#drawer-backdrop").classList.remove("active");
});
$("#btn-sair").addEventListener("click", async () => {
  try { await api("/logout", { method: "POST" }); } catch (e) { /* sessão local cai de qualquer jeito */ }
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = "login.html";
});

// ---------------------------------------------------------------- situação
const SITUACOES = {
  em_teste: "Em teste",
  pagantes: "Pagantes",
  em_atraso: "Em atraso",
  modo_leitura: "Modo leitura",
  canceladas: "Canceladas",
  suspensas: "Suspensas",
};

function selo(b) {
  if (!b.ativa) return '<span class="pl-selo erro">Suspensa</span>';
  if (b.acesso === "read_only") return '<span class="pl-selo erro">Modo leitura</span>';
  switch (b.status) {
    case "trialing": return '<span class="pl-selo teste">Em teste</span>';
    case "active": return b.mensalidade ? '<span class="pl-selo ok">Pagante</span>' : '<span class="pl-selo ok">Cortesia</span>';
    case "past_due": return '<span class="pl-selo aviso">Em atraso</span>';
    case "canceled": return '<span class="pl-selo neutro">Cancelada</span>';
    default: return '<span class="pl-selo neutro">Sem assinatura</span>';
  }
}

// ---------------------------------------------------------------- visão geral
async function carregarMetricas() {
  const m = await api("/plataforma/metricas");

  $("#m-mrr").textContent = moeda(m.mrr);
  $("#m-mrr-sub").textContent = m.mrr_contratado_em_teste
    ? `+ ${moeda(m.mrr_contratado_em_teste)} já contratados por barbearias ainda em teste`
    : `${inteiro(m.situacao.pagantes)} barbearia(s) pagante(s)`;

  const pct = (v) => (v === null || v === undefined ? "—" : `${String(v).replace(".", ",")}%`);
  const kpis = [
    ["Receita recebida (30 dias)", moeda(m.receita_30d), ""],
    ["Pagantes", inteiro(m.situacao.pagantes), `ticket médio ${moeda(m.ticket_medio)}`],
    ["Em teste grátis", inteiro(m.situacao.em_teste), `${inteiro(m.barbearias_total)} barbearias no total`],
    ["Conversão do teste", pct(m.conversao_trial.taxa), `${m.conversao_trial.convertidos} de ${m.conversao_trial.encerrados_90d} testes encerrados (90d)`],
    ["Cancelamentos (30 dias)", pct(m.churn_30d.taxa), `${m.churn_30d.canceladas} cancelada(s)`],
    ["Agendamentos (30 dias)", inteiro(m.uso.agendamentos_30d), `${inteiro(m.uso.barbearias_ativas_30d)} barbearia(s) com movimento`],
  ];
  $("#pl-kpis").innerHTML = kpis.map(([rotulo, valor, nota]) => `
    <div class="pl-kpi">
      <div class="pl-label">${rotulo}</div>
      <div class="pl-kpi-valor">${valor}</div>
      ${nota ? `<div class="pl-kpi-nota">${esc(nota)}</div>` : ""}
    </div>`).join("");

  $("#pl-situacoes").innerHTML = Object.entries(SITUACOES).map(([chave, rotulo]) => `
    <li><button type="button" data-situacao="${chave}"><span>${rotulo}</span><span class="num">${inteiro(m.situacao[chave])}</span></button></li>`).join("");
  document.querySelectorAll("[data-situacao]").forEach((b) => b.addEventListener("click", () => {
    $("#f-situacao").value = b.dataset.situacao;
    abrirAba("barbearias");
  }));

  const planos = Object.entries(m.por_plano || {});
  const max = Math.max(1, ...planos.map(([, n]) => n));
  $("#pl-por-plano").innerHTML = planos.length
    ? planos.map(([nome, n]) => `
      <li><span>${esc(nome)}</span><span class="trilho"><span class="preenchido" style="width:${(n / max) * 100}%"></span></span><span class="num">${n}</span></li>`).join("")
    : '<li class="pl-muted" style="display:block">Nenhuma barbearia pagante ainda.</li>';

  desenharColunas($("#chart-cadastros"), m.cadastros_30d);
  $("#cad-total").textContent = inteiro(m.cadastros_30d.reduce((s, d) => s + d.total, 0));
  $("#cad-tabela").innerHTML = m.cadastros_30d.slice().reverse()
    .map((d) => `<tr><td>${d.dia.split("-").reverse().join("/")}</td><td>${d.total}</td></tr>`).join("");
}

/** Colunas de uma série só (sem legenda: o título nomeia a série). */
function desenharColunas(el, dados) {
  desenharColunas.ultimo = [el, dados];
  const W = Math.max(320, el.clientWidth || 600), H = 200, ESQ = 28, BASE = 176, TOPO = 12;
  const max = Math.max(1, ...dados.map((d) => d.total));
  // marcas do eixo em números inteiros redondos
  const passo = Math.max(1, Math.ceil(max / 4));
  const teto = passo * Math.ceil(max / passo);
  const y = (v) => BASE - ((BASE - TOPO) * v) / teto;
  const faixa = (W - ESQ) / dados.length;
  const larg = Math.min(14, faixa - 2); // fica com o espaço entre colunas

  let svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
  for (let v = 0; v <= teto; v += passo) {
    svg += `<line class="grade" x1="${ESQ}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="eixo-texto" x="${ESQ - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  }
  dados.forEach((d, i) => {
    const cx = ESQ + faixa * i + faixa / 2;
    const h = BASE - y(d.total);
    // alvo de hover = a faixa inteira (maior que a coluna)
    svg += `<rect class="alvo" data-i="${i}" x="${ESQ + faixa * i}" y="${TOPO}" width="${faixa}" height="${BASE - TOPO}"/>`;
    if (d.total > 0) {
      const r = Math.min(4, h, larg / 2);
      const x0 = cx - larg / 2, x1 = cx + larg / 2, yt = BASE - h;
      // topo arredondado (4px), base reta no eixo
      svg += `<path class="coluna" data-c="${i}" d="M${x0},${BASE} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x1 - r} Q${x1},${yt} ${x1},${yt + r} V${BASE} Z"/>`;
    }
    // rótulos a cada 7 dias + o último; pula o semanal que encostaria no último
    const ultimo = i === dados.length - 1;
    if (i === 0 || ultimo || (i % 7 === 0 && dados.length - 1 - i >= 4)) {
      const [, mes, dia] = d.dia.split("-");
      svg += `<text class="eixo-texto" x="${cx}" y="${H - 4}" text-anchor="middle">${dia}/${mes}</text>`;
    }
  });
  svg += "</svg>";
  el.innerHTML = svg + '<div class="pl-tooltip"></div>';

  const tip = el.querySelector(".pl-tooltip");
  el.querySelectorAll(".alvo").forEach((alvo) => {
    alvo.addEventListener("mouseenter", () => {
      const i = Number(alvo.dataset.i);
      const d = dados[i];
      el.querySelectorAll(".coluna").forEach((c) => c.classList.toggle("ativa", c.dataset.c === String(i)));
      const caixa = el.getBoundingClientRect();
      const r = alvo.getBoundingClientRect();
      tip.style.left = `${r.left - caixa.left + r.width / 2}px`;
      tip.style.top = `${(y(d.total) / H) * caixa.height - 6}px`;
      tip.textContent = `${d.dia.split("-").reverse().join("/")}: ${d.total} cadastro(s)`;
      tip.style.display = "block";
    });
  });
  el.addEventListener("mouseleave", () => {
    tip.style.display = "none";
    el.querySelectorAll(".coluna").forEach((c) => c.classList.remove("ativa"));
  });
}

let redesenho;
window.addEventListener("resize", () => {
  clearTimeout(redesenho);
  redesenho = setTimeout(() => desenharColunas.ultimo && desenharColunas(...desenharColunas.ultimo), 150);
});

// ---------------------------------------------------------------- barbearias
let paginaAtual = 1;
let buscaTimer;

async function carregarBarbearias(pagina = 1) {
  paginaAtual = pagina;
  const params = new URLSearchParams({ page: pagina });
  if ($("#f-busca").value.trim()) params.set("busca", $("#f-busca").value.trim());
  if ($("#f-situacao").value) params.set("situacao", $("#f-situacao").value);

  const corpo = $("#barbearias-body");
  try {
    const { data, meta } = await api(`/plataforma/barbearias?${params}`);
    corpo.innerHTML = data.length
      ? data.map((b) => `
        <tr>
          <td><div class="pl-nome">${esc(b.nome)}</div><div class="pl-sub">${esc(b.dono ? b.dono.email : "sem dono")} · /${esc(b.slug)}</div></td>
          <td data-label="Plano"><span>${esc(b.plano || "—")}${b.mensalidade ? `<span class="pl-sub" style="display:block">${moeda(b.mensalidade)}/mês</span>` : ""}</span></td>
          <td data-label="Situação">${selo(b)}</td>
          <td data-label="Acesso até">${dataBR(b.acesso_ate)}</td>
          <td data-label="Profissionais">${b.profissionais}</td>
          <td data-label="Agend. 30d">${b.agendamentos_30d}</td>
          <td data-label="Último acesso">${relativo(b.ultimo_acesso)}</td>
          <td data-label=""><button class="btn-secondary" type="button" data-detalhe="${b.id}">Detalhes</button></td>
        </tr>`).join("")
      : '<tr><td colspan="8" style="text-align:center; color: var(--text-muted);">Nenhuma barbearia encontrada.</td></tr>';
    corpo.querySelectorAll("[data-detalhe]").forEach((b) => b.addEventListener("click", () => abrirDetalhe(b.dataset.detalhe)));

    const paginas = Math.max(1, Math.ceil(meta.total / meta.per_page));
    $("#barbearias-paginacao").innerHTML = `
      <span>${meta.total} barbearia(s) · página ${pagina} de ${paginas}</span>
      <button class="btn-secondary" type="button" ${pagina <= 1 ? "disabled" : ""} data-pag="${pagina - 1}">‹</button>
      <button class="btn-secondary" type="button" ${pagina >= paginas ? "disabled" : ""} data-pag="${pagina + 1}">›</button>`;
    document.querySelectorAll("[data-pag]").forEach((b) => b.addEventListener("click", () => carregarBarbearias(Number(b.dataset.pag))));
  } catch (e) {
    corpo.innerHTML = `<tr><td colspan="8">${esc(e.message)}</td></tr>`;
  }
}
$("#f-busca").addEventListener("input", () => {
  clearTimeout(buscaTimer);
  buscaTimer = setTimeout(() => carregarBarbearias(1), 300);
});
$("#f-situacao").addEventListener("change", () => carregarBarbearias(1));

// ---------------------------------------------------------------- detalhe
const modal = $("#modal-barbearia");
modal.querySelector("[data-fechar]").addEventListener("click", () => modal.classList.remove("active"));
modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); });

const ROTULO_FATURA = { PENDING: "Em aberto", OVERDUE: "Vencida", CONFIRMED: "Paga", RECEIVED: "Paga", RECEIVED_IN_CASH: "Paga", REFUNDED: "Estornada", DELETED: "Cancelada" };
let planosCache = null;

async function abrirDetalhe(id) {
  const corpo = $("#d-corpo");
  corpo.innerHTML = '<p class="pl-muted">Carregando…</p>';
  modal.classList.add("active");

  try {
    const [b, cfg] = await Promise.all([
      api(`/plataforma/barbearias/${id}`),
      planosCache ? Promise.resolve({ planos: planosCache }) : api("/plataforma/configuracoes"),
    ]);
    planosCache = cfg.planos;
    $("#d-nome").textContent = b.nome;
    const a = b.assinatura || {};

    corpo.innerHTML = `
      <dl class="pl-info">
        <div><dt>Situação</dt><dd>${selo(b)}</dd></div>
        <div><dt>Plano</dt><dd>${esc(b.plano || "—")}${b.mensalidade ? ` · ${moeda(b.mensalidade)}/mês` : " · sem cobrança no gateway"}</dd></div>
        <div><dt>Acesso total até</dt><dd>${dataBR(b.acesso_ate)}</dd></div>
        <div><dt>Dono</dt><dd>${esc(b.dono ? `${b.dono.nome} · ${b.dono.email}` : "—")}</dd></div>
        <div><dt>Telefone</dt><dd>${esc(b.telefone || "—")}</dd></div>
        <div><dt>Cidade</dt><dd>${esc(b.endereco || "—")}</dd></div>
        <div><dt>Link de agendamento</dt><dd>/${esc(b.slug)}</dd></div>
        <div><dt>Cliente desde</dt><dd>${dataBR(b.criada_em)}</dd></div>
        <div><dt>Uso</dt><dd>${b.profissionais} profissional(is) · ${b.agendamentos_30d} agend. em 30d · acesso ${relativo(b.ultimo_acesso)}</dd></div>
        <div><dt>Asaas</dt><dd>${b.gateway && b.gateway.assinatura ? `<code>${esc(b.gateway.assinatura)}</code>` : "sem assinatura"}</dd></div>
      </dl>

      <div>
        <h4>Ações</h4>
        <div class="pl-acoes">
          <div class="pl-acao">
            <strong>Acessar o painel</strong>
            <p>Abre o painel da barbearia como o dono, por 2 horas, para dar suporte. Fica registrado no histórico dela.</p>
            <button class="btn-primary" type="button" id="a-acessar">Acessar como suporte</button>
          </div>
          <div class="pl-acao">
            <strong>Conceder dias</strong>
            <p>${a.status === "trialing" || (!a.periodo_pago_ate && a.status === "canceled") ? "Estende o teste grátis." : "Estende o período pago (cortesia) e tira do atraso."}</p>
            <div class="linha"><input type="number" class="admin-input" id="a-dias" min="1" max="365" value="7"><button class="btn-secondary" type="button" id="a-dias-btn">Conceder</button></div>
          </div>
          <div class="pl-acao">
            <strong>Trocar plano</strong>
            <p>${b.gateway && b.gateway.assinatura ? "Atualiza a mensalidade no Asaas, inclusive faturas em aberto." : "Sem cobrança no gateway: muda só os recursos liberados."}</p>
            <div class="linha">
              <select class="admin-input" id="a-plano">${planosCache.map((p) => `<option value="${esc(p.slug)}" ${p.slug === b.plano_slug ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>
              <button class="btn-secondary" type="button" id="a-plano-btn">Trocar</button>
            </div>
          </div>
          <div class="pl-acao">
            <strong>${b.ativa ? "Suspender conta" : "Reativar conta"}</strong>
            <p>${b.ativa ? "Bloqueia o painel e o site de agendamento e derruba as sessões abertas." : "Libera de novo o painel e o site de agendamento."}</p>
            <button class="${b.ativa ? "btn-perigo" : "btn-primary"}" type="button" id="a-ativa">${b.ativa ? "Suspender" : "Reativar"}</button>
          </div>
        </div>
      </div>

      <div>
        <h4>Faturas</h4>
        <div class="table-container"><table class="admin-table">
          <thead><tr><th>Vencimento</th><th>Valor</th><th>Status</th><th>Pago em</th></tr></thead>
          <tbody>${b.faturas.length ? b.faturas.map((f) => `
            <tr><td>${f.vencimento ? f.vencimento.split("-").reverse().join("/") : "—"}</td><td data-label="Valor">${moeda(f.valor)}</td><td data-label="Status">${ROTULO_FATURA[f.status] || esc(f.status)}</td><td data-label="Pago em">${dataBR(f.pago_em)}</td></tr>`).join("")
            : '<tr><td colspan="4" class="pl-muted">Nenhuma fatura.</td></tr>'}</tbody>
        </table></div>
      </div>

      <div>
        <h4>Usuários</h4>
        <ul class="pl-atividade">${b.usuarios.map((u) => `<li><span>${esc(u.name)} · ${esc(u.email)}</span><span class="pl-sub">${u.role === "admin" ? "administrador" : "usuário"}</span></li>`).join("")}</ul>
      </div>

      <div>
        <h4>Atividade recente</h4>
        <ul class="pl-atividade">${b.atividade.length ? b.atividade.map((l) => `
          <li><time>${dataHoraBR(l.created_at)}</time><span>${esc(l.description || l.action)}${l.user ? ` <span class="pl-sub">· ${esc(l.user.name)}</span>` : ""}</span></li>`).join("")
          : '<li class="pl-muted">Sem registros.</li>'}</ul>
      </div>`;

    const acao = async (fn, okMsg) => {
      try {
        const r = await fn();
        toast(r.message || okMsg);
        abrirDetalhe(id);
        carregarBarbearias(paginaAtual);
        carregarMetricas();
      } catch (e) {
        toast(e.message, "erro");
      }
    };

    $("#a-acessar").addEventListener("click", async () => {
      // abre a aba no clique (bloqueador de pop-up) e depois aponta para o painel
      const janela = window.open("", "_blank");
      try {
        const r = await api(`/plataforma/barbearias/${id}/acessar`, { method: "POST" });
        janela.location.href = `admin.html#suporte=${encodeURIComponent(r.token)}`;
      } catch (e) {
        janela?.close();
        toast(e.message, "erro");
      }
    });
    $("#a-dias-btn").addEventListener("click", () => acao(() => api(`/plataforma/barbearias/${id}/dias`, {
      method: "POST", body: JSON.stringify({ dias: Number($("#a-dias").value) }),
    })));
    $("#a-plano-btn").addEventListener("click", () => acao(() => api(`/plataforma/barbearias/${id}/plano`, {
      method: "PUT", body: JSON.stringify({ plano: $("#a-plano").value }),
    })));
    $("#a-ativa").addEventListener("click", () => {
      if (b.ativa && !confirm(`Suspender "${b.nome}"? O painel e o site de agendamento ficam bloqueados.`)) return;
      acao(() => api(`/plataforma/barbearias/${id}/${b.ativa ? "suspender" : "reativar"}`, { method: "POST" }));
    });
  } catch (e) {
    corpo.innerHTML = `<p>${esc(e.message)}</p>`;
  }
}

// ---------------------------------------------------------------- configurações
async function carregarConfig() {
  try {
    const { configuracoes: c, planos, gateway: g } = await api("/plataforma/configuracoes");
    planosCache = planos;

    $("#c-trial").value = c.trial_days;
    $("#c-carencia").value = c.grace_days;
    $("#c-cadastro").checked = !!c.signup_open;
    $("#c-plano-trial").innerHTML = planos.map((p) => `<option value="${esc(p.slug)}" ${p.slug === c.trial_plan ? "selected" : ""}>${esc(p.name)}</option>`).join("");

    $("#planos-body").innerHTML = planos.map((p) => `
      <tr data-plano="${p.id}">
        <td><input class="admin-input" data-campo="name" value="${esc(p.name)}"></td>
        <td data-label="Preço (R$)"><input class="admin-input" data-campo="price" type="number" step="0.01" min="0" value="${(p.price_cents / 100).toFixed(2)}"></td>
        <td data-label="Máx. profissionais"><input class="admin-input" data-campo="max_workers" type="number" min="1" placeholder="ilimitado" value="${p.max_workers ?? ""}"></td>
        <td data-label="WhatsApp"><input type="checkbox" data-recurso="whatsapp" ${p.features.includes("whatsapp") ? "checked" : ""} aria-label="WhatsApp no plano ${esc(p.name)}"></td>
        <td data-label="Financeiro"><input type="checkbox" data-recurso="financeiro" ${p.features.includes("financeiro") ? "checked" : ""} aria-label="Financeiro no plano ${esc(p.name)}"></td>
        <td data-label="À venda"><input type="checkbox" data-campo="active" ${p.active ? "checked" : ""} aria-label="Plano ${esc(p.name)} à venda"></td>
        <td data-label=""><button class="btn-secondary" type="button" data-salvar-plano="${p.id}">Salvar</button></td>
      </tr>`).join("");
    document.querySelectorAll("[data-salvar-plano]").forEach((btn) => btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const max = tr.querySelector('[data-campo="max_workers"]').value;
      try {
        const r = await api(`/plataforma/planos/${btn.dataset.salvarPlano}`, {
          method: "PUT",
          body: JSON.stringify({
            name: tr.querySelector('[data-campo="name"]').value,
            price_cents: Math.round(Number(tr.querySelector('[data-campo="price"]').value) * 100),
            max_workers: max === "" ? null : Number(max),
            features: [...tr.querySelectorAll("[data-recurso]:checked")].map((i) => i.dataset.recurso),
            active: tr.querySelector('[data-campo="active"]').checked,
          }),
        });
        toast(r.message);
      } catch (e) {
        toast(e.message, "erro");
      }
    }));

    const sim = (v) => (v ? "✔ configurado" : "✖ falta configurar");
    $("#gateway-status").innerHTML = `
      <div><div class="pl-label">Ambiente</div>${g.ambiente === "production" ? "Produção" : "Sandbox (testes)"}</div>
      <div><div class="pl-label">Chave de API</div>${sim(g.chave_configurada)}</div>
      <div><div class="pl-label">Token do webhook</div>${sim(g.webhook_configurado)}</div>
      <div><div class="pl-label">URL do webhook</div><code>${esc(g.webhook_url)}</code></div>`;

    carregarEventos();
  } catch (e) {
    toast(e.message, "erro");
  }
}

async function carregarEventos() {
  const corpo = $("#eventos-body");
  try {
    const eventos = await api("/plataforma/cobranca/eventos");
    corpo.innerHTML = eventos.length
      ? eventos.map((ev) => `
        <tr>
          <td>${dataHoraBR(ev.created_at)}</td>
          <td data-label="Evento"><code>${esc(ev.event)}</code></td>
          <td data-label="Situação">${ev.processed_at ? '<span class="pl-selo ok">Processado</span>' : ev.error ? `<span class="pl-selo erro" title="${esc(ev.error)}">Falhou</span>` : '<span class="pl-selo neutro">Pendente</span>'}</td>
          <td data-label="">${!ev.processed_at ? `<button class="btn-secondary" type="button" data-reprocessar="${ev.id}">Reprocessar</button>` : ""}</td>
        </tr>`).join("")
      : '<tr><td colspan="4" class="pl-muted">Nenhum webhook recebido ainda.</td></tr>';
    corpo.querySelectorAll("[data-reprocessar]").forEach((b) => b.addEventListener("click", async () => {
      try {
        const r = await api(`/plataforma/cobranca/eventos/${b.dataset.reprocessar}/reprocessar`, { method: "POST" });
        toast(r.message);
        carregarEventos();
      } catch (e) {
        toast(e.message, "erro");
      }
    }));
  } catch (e) {
    corpo.innerHTML = `<tr><td colspan="4">${esc(e.message)}</td></tr>`;
  }
}

$("#form-config").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    const r = await api("/plataforma/configuracoes", {
      method: "PUT",
      body: JSON.stringify({
        trial_days: Number($("#c-trial").value),
        grace_days: Number($("#c-carencia").value),
        trial_plan: $("#c-plano-trial").value,
        signup_open: $("#c-cadastro").checked,
      }),
    });
    toast(r.message);
  } catch (e) {
    toast(e.message, "erro");
  }
});

// ---------------------------------------------------------------- início
(async () => {
  if (!localStorage.getItem(TOKEN_KEY)) {
    window.location.href = "login.html";
    return;
  }
  try {
    const me = await api("/plataforma/me");
    $("#pl-usuario").innerHTML = `Olá, <strong>${esc(me.name)}</strong>`;
    await carregarMetricas();
    if (location.hash.length > 1) abrirAba(location.hash.slice(1));
  } catch (e) {
    if (e.message !== "sessão") toast(e.message, "erro");
  }
})();
