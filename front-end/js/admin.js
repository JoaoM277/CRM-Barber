// --------------------------------------------------------------------------
// 1. NAVEGAÇÃO DE ABAS E TOAST (MENSAGENS)
// --------------------------------------------------------------------------
const menuItems = document.querySelectorAll(".menu-item");
const tabPanels = document.querySelectorAll(".tab-panel");
const token = localStorage.getItem("admin_token");

function authHeaders(extra = {}) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
    ...extra,
  };
}

async function checarSessao(res) {
  if (res && res.status === 401) {
    localStorage.removeItem("admin_token");
    window.location.href = "login.html";
    return false;
  }
  return true;
}

menuItems.forEach((item) => {
  item.addEventListener("click", () => {
    menuItems.forEach((btn) => btn.classList.remove("active"));
    item.classList.add("active");

    const targetTab = item.getAttribute("data-tab");
    tabPanels.forEach((panel) => panel.classList.remove("active"));
    document.getElementById(`panel-${targetTab}`).classList.add("active");
  });
});

document.querySelectorAll(".btn-logout").forEach((btnLogout) => {
  btnLogout.addEventListener("click", async () => {
    try {
      await fetch(`${window.API_BASE_URL || "http://localhost:8000/api"}/logout`, {
        method: "POST",
        headers: authHeaders(),
      });
    } catch (e) {
      /* mesmo se a API estiver fora do ar, ainda derruba a sessão local */
    } finally {
      localStorage.removeItem("admin_token");
      window.location.href = "login.html";
    }
  });
});

window.mostrarToastAdmin = function (mensagem, tipo = "sucesso") {
  const toast = document.getElementById("admin-toast");
  const texto = document.getElementById("admin-toast-texto");

  if (!toast || !texto) return;

  texto.innerText = mensagem;
  toast.classList.remove("toast-sucesso", "toast-erro");

  if (tipo === "erro") {
    toast.classList.add("toast-erro");
  } else {
    toast.classList.add("toast-sucesso");
  }

  toast.classList.remove("toast-escondido");
  toast.classList.add("toast-visivel");

  setTimeout(() => {
    toast.classList.remove("toast-visivel");
    toast.classList.add("toast-escondido");
  }, 3500);
};

// --------------------------------------------------------------------------
// 2. CONFIGURAÇÕES BASE E MODAL UNIVERSAL
// --------------------------------------------------------------------------
const API_BASE_URL = window.API_BASE_URL || "http://localhost:8000/api";

function formatarTelefoneAdmin(telefone) {
  if (!telefone) return "";
  return `(${telefone.slice(0, 2)}) ${telefone.slice(2, 7)}-${telefone.slice(7)}`;
}

let acaoPendente = null;

window.abrirModalConfirmacao = function (
  titulo,
  mensagem,
  textoBotao,
  tipoBotao,
  callback,
) {
  document.getElementById("confirm-titulo").innerText = titulo;
  document.getElementById("confirm-mensagem").innerText = mensagem;

  const btnConfirmar = document.getElementById("btn-confirmar-acao");
  btnConfirmar.innerText = textoBotao;

  if (tipoBotao === "danger") {
    btnConfirmar.style.backgroundColor = "var(--danger)";
    btnConfirmar.style.color = "#ffffff";
  } else {
    btnConfirmar.style.backgroundColor = "var(--brand-primary)";
    btnConfirmar.style.color = "var(--brand-bg-dark)";
  }

  acaoPendente = callback;
  document.getElementById("modal-confirmacao").classList.add("active");
};

window.fecharModalConfirmacao = function () {
  document.getElementById("modal-confirmacao").classList.remove("active");
  acaoPendente = null;
};

const btnConfirmarAcao = document.getElementById("btn-confirmar-acao");
if (btnConfirmarAcao) {
  btnConfirmarAcao.addEventListener("click", () => {
    if (acaoPendente) acaoPendente();
    fecharModalConfirmacao();
  });
}

// --------------------------------------------------------------------------
// 3. MÓDULO: AGENDA
// --------------------------------------------------------------------------
async function renderAgenda(dataFiltro = "") {
  const tableBody = document.getElementById("agenda-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Buscando agendamentos...</td></tr>`;

  try {
    let url = `${API_BASE_URL}/agendamentos`;
    if (dataFiltro !== "") {
      url += `?data=${dataFiltro}`;
    }

    

    const response = await fetch(url, {
      headers: authHeaders(), // Garante retorno em JSON do Laravel
    });

    if (!(await checarSessao(response))) return;
    if (!response.ok) throw new Error("Erro de rede");
    const jsonBody = await response.json();
    const agendamentos = jsonBody.data ? jsonBody.data : jsonBody;

    tableBody.innerHTML = "";

    const agendamentosAtivos = agendamentos.filter(
      (ag) => ag.status !== "cancelado",
    );

    if (agendamentosAtivos.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhum agendamento para esta data.</td></tr>`;
      return;
    }

    agendamentosAtivos.forEach((agendamento) => {
      const tr = document.createElement("tr");
      const mapBadge = {
        pendente: ["pending", "Aguardando"],
        confirmado: ["confirmed", "Confirmado"],
        concluido: ["confirmed", "Concluído"],
        cancelado: ["cancel", "Cancelado"],
      };
      const [badgeClass, badgeText] = mapBadge[agendamento.status] || ["pending", agendamento.status];

      // Se o Laravel devolver os dados em inglês (client_name, client_phone, etc),
      // precisaremos ajustar essas chaves depois.
      const nomeCli = agendamento.cliente_nome || agendamento.client_name || "";
      const telCli =
        agendamento.cliente_telefone || agendamento.client_phone || "";
      const dataAg = agendamento.data || agendamento.date || "";
      const horaAg = agendamento.horario || agendamento.time || "";

      // Lista completa de serviços (multi-serviço); cai pro serviço "primário" nos registros antigos.
      let servicosTxt = "N/A";
      if (Array.isArray(agendamento.servicos) && agendamento.servicos.length) {
        servicosTxt = agendamento.servicos.map((s) => s.nome).join(", ");
      } else if (agendamento.servicos_nomes) {
        servicosTxt = agendamento.servicos_nomes;
      } else if (agendamento.Servico) {
        servicosTxt = agendamento.Servico.nome;
      }

      tr.innerHTML = `
                <td data-label="Cliente">
                    <div>
                        <strong>${nomeCli}</strong><br>
                        <span class="text-small">${formatarTelefoneAdmin(telCli)}</span>
                    </div>
                </td>
                <td data-label="Serviço">${servicosTxt}</td>
                <td data-label="Barbeiro">${agendamento.Barbeiro ? agendamento.Barbeiro.nome : "N/A"}</td>
                <td data-label="Data e Hora">${dataAg.split("-").reverse().join("/")} às ${horaAg}</td>
                <td data-label="Status"><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                <td data-label="Ações">
                    ${agendamento.status === "pendente" ? `<button class="btn-action confirm" onclick="alterarStatus(${agendamento.id}, 'confirmado')" title="Confirmar">✔️</button>` : ""}
                    ${agendamento.status === "confirmado" ? `<button class="btn-action confirm" onclick="alterarStatus(${agendamento.id}, 'concluido')" title="Marcar como concluído">✅</button>` : ""}
                    ${agendamento.status !== "cancelado" && agendamento.status !== "concluido" ? `<button class="btn-action cancel" onclick="alterarStatus(${agendamento.id}, 'cancelado')" title="Cancelar">❌</button>` : ""}
                </td>
            `;
      tableBody.appendChild(tr);
    });
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">Servidor offline</td></tr>`;
  }
}

window.alterarStatus = async function (id, novoStatus) {
  const executarAlteracao = async () => {


    

    try {
      const res = await fetch(`${API_BASE_URL}/agendamentos/${id}`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status: novoStatus }),
      });
      if (res.ok) {
        mostrarToastAdmin(
          { confirmado: "Horário confirmado!", concluido: "Atendimento concluído!", cancelado: "Agendamento cancelado com sucesso!" }[novoStatus] || "Status atualizado!",
        );
        if (typeof renderFaturamento === "function") renderFaturamento();
        const dataAtualFiltro = document.getElementById("filter-date")
          ? document.getElementById("filter-date").value
          : "";
        renderAgenda(dataAtualFiltro);
      } else {
        mostrarToastAdmin("Erro ao alterar o status.", "erro");
      }
    } catch (error) {
      mostrarToastAdmin("Falha na conexão. Tente novamente.", "erro");
    }
  };

  if (novoStatus === "cancelado") {
    abrirModalConfirmacao(
      "Cancelar Horário",
      "Deseja realmente cancelar este agendamento? Esta ação não pode ser desfeita.",
      "Sim, Cancelar",
      "danger",
      executarAlteracao,
    );
  } else {
    executarAlteracao();
  }
};

// --------------------------------------------------------------------------
// 4. MÓDULO: SERVIÇOS
// --------------------------------------------------------------------------
async function renderServicos() {
  const tableBody = document.getElementById("servicos-table-body");
  const token = localStorage.getItem("admin_token");
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Buscando serviços...</td></tr>`;

  try {
    const response = await fetch(`${API_BASE_URL}/servicos`, {
      headers: authHeaders()
    });
    if (!(await checarSessao(response))) return;
    if (!response.ok) throw new Error("Erro");
    const jsonBody = await response.json();

    // Pega a lista dentro de "data" se vier do Laravel
    const servicos = jsonBody.data ? jsonBody.data : jsonBody;

    tableBody.innerHTML = "";
    if (servicos.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Sem serviços.</td></tr>`;
      return;
    }

    servicos.forEach((servico) => {
      const tr = document.createElement("tr");

      // Aceitando chaves em português ou inglês
      const nomeSvc = servico.nome || servico.name || "";
      const precoSvc = servico.preco || servico.price || 0;
      const duracaoSvc = servico.duracao || servico.duration || 0;

      const precoFormatado = Number(precoSvc).toFixed(2).replace(".", ",");

      tr.innerHTML = `
                <td data-label="Serviço"><strong>${nomeSvc}</strong></td>
                <td data-label="Preço" style="color: var(--brand-primary); font-weight: 600;">R$ ${precoFormatado}</td>
                <td data-label="Tempo">${duracaoSvc} min</td>
                <td data-label="Ações">
                    <button class="btn-action" onclick="abrirModalServico(${servico.id})" title="Editar">✏️</button>
                    <button class="btn-action cancel" onclick="deletarServico(${servico.id})" title="Excluir">🗑️</button>
                </td>
            `;
      tableBody.appendChild(tr);
    });
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger);">Servidor offline.</td></tr>`;
  }
}

window.deletarServico = function (id) {
  abrirModalConfirmacao(
    "Excluir Serviço",
    "Tem certeza que deseja apagar este serviço definitivamente?",
    "Excluir Serviço",
    "danger",
    async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/servicos/${id}`, {
          method: "DELETE",
          headers: authHeaders()
        });
        if (response.ok) {
          mostrarToastAdmin("Serviço excluído com sucesso!");
          renderServicos();
        } else {
          mostrarToastAdmin("Erro ao apagar o serviço.", "erro");
        }
      } catch (error) {
        mostrarToastAdmin("Erro de rede. Tente novamente.", "erro");
      }
    },
  );
};

window.abrirModalServico = function (id = null) {
  document.getElementById("form-servico").reset();
  document.getElementById("modal-titulo").innerText = id
    ? "Editar Serviço"
    : "Novo Serviço";
  document.getElementById("servico-id").value = id || "";
  document.getElementById("modal-servico").classList.add("active");
};

window.fecharModalServico = () =>
  document.getElementById("modal-servico").classList.remove("active");

const formServico = document.getElementById("form-servico");
if (formServico) {
  formServico.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("servico-id").value;

    let precoString = document.getElementById("servico-preco").value;
    let precoFloat = parseFloat(
      precoString.replace(/\./g, "").replace(",", "."),
    );

    // ATUALIZADO: Payload usando chaves em INGLÊS para bater com o Laravel
    const payload = {
      name: document.getElementById("servico-nome").value,
      price: precoFloat,
      duration_time: parseInt(document.getElementById("servico-duracao").value),
      active: true,
    };

    const url = id
      ? `${API_BASE_URL}/servicos/${id}`
      : `${API_BASE_URL}/servicos`;
    const method = id ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fecharModalServico();
        renderServicos();
        mostrarToastAdmin("Serviço salvo com sucesso!");
      } else {
        // Captura do erro exato vindo do Laravel
        const errData = await res.json();
        console.error("Erro Servicos:", errData);
        let erroMsg = "Erro ao salvar serviço.";
        if (errData.errors) erroMsg = Object.values(errData.errors)[0][0];
        else if (errData.message) erroMsg = errData.message;
        mostrarToastAdmin(erroMsg, "erro");
      }
    } catch (err) {
      mostrarToastAdmin("Erro de conexão com o servidor.", "erro");
    }
  });
}

// --------------------------------------------------------------------------
// 5. MÓDULO: BARBEIROS (PROFISSIONAIS)
// --------------------------------------------------------------------------
async function renderBarbeiros() {
  const tableBody = document.getElementById("barbeiros-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Buscando profissionais...</td></tr>`;

  try {
    // CORRIGIDO PARA O ENDEREÇO CERTO DA API DO LARAVEL
    const response = await fetch(`${API_BASE_URL}/profissionais`, {
      headers: authHeaders()
    });
    if (!(await checarSessao(response))) return;
    if (!response.ok) throw new Error("Erro");

    const jsonBody = await response.json();
    const listaBarbeiros = jsonBody.data ? jsonBody.data : jsonBody;

    tableBody.innerHTML = "";
    if (listaBarbeiros.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum cadastrado.</td></tr>`;
      return;
    }

    listaBarbeiros.forEach((barbeiro) => {
      const tr = document.createElement("tr");

      const nomeBarb = barbeiro.nome || barbeiro.name || "";
      const telBarb = barbeiro.telefone || barbeiro.phone || "";
      const inicial = nomeBarb ? nomeBarb.charAt(0).toUpperCase() : "?";

      tr.innerHTML = `
                <td data-label="Perfil"><div class="table-avatar">${inicial}</div></td>
                <td data-label="Nome"><strong>${nomeBarb}</strong></td>
                <td data-label="Telefone">${formatarTelefoneAdmin(telBarb)}</td>
                <td data-label="Ações">
                    <button class="btn-action" onclick="abrirModalBarbeiro(${barbeiro.id})" title="Editar">✏️</button>
                    <button class="btn-action cancel" onclick="deletarBarbeiro(${barbeiro.id})" title="Excluir">🗑️</button>
                </td>
            `;
      tableBody.appendChild(tr);
    });
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger);">Servidor offline.</td></tr>`;
  }
}

window.deletarBarbeiro = function (id) {
  abrirModalConfirmacao(
    "Excluir Profissional",
    "Tem certeza que deseja apagar este profissional do sistema?",
    "Excluir Profissional",
    "danger",
    async () => {
      try {
        // CORRIGIDO PARA /profissionais
        const response = await fetch(`${API_BASE_URL}/profissionais/${id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (response.ok) {
          mostrarToastAdmin("Profissional removido com sucesso!");
          renderBarbeiros();
        } else {
          mostrarToastAdmin("Erro ao apagar profissional.", "erro");
        }
      } catch (error) {
        mostrarToastAdmin("Erro de rede. Tente novamente.", "erro");
      }
    },
  );
};

window.abrirModalBarbeiro = async function (id = null) {
  const form = document.getElementById("form-barbeiro");
  form.reset();
  document.getElementById("modal-titulo-barbeiro").innerText = id ? "Editar Profissional" : "Novo Profissional";
  document.getElementById("barbeiro-id").value = id || "";
  document.getElementById("modal-barbeiro").classList.add("active");

  if (!id) return;
  try {
    const res = await fetch(`${API_BASE_URL}/profissionais/${id}`, { headers: authHeaders() });
    if (!res.ok) return;
    const b = await res.json();
    const w = b.data ? b.data : b;
    document.getElementById("barbeiro-nome").value = w.name || "";
    document.getElementById("barbeiro-telefone").value = w.phone || "";
    document.getElementById("barbeiro-payment-type").value = w.payment_type || "comissao";
    document.getElementById("barbeiro-comissao").value = w.commission_percent ?? "";
    document.getElementById("barbeiro-fixo").value = w.fixed_salary ?? "";
    document.getElementById("barbeiro-pix").value = w.pix_key || "";
  } catch (e) { /* silencioso */ }
};

window.fecharModalBarbeiro = () =>
  document.getElementById("modal-barbeiro").classList.remove("active");

const formBarbeiro = document.getElementById("form-barbeiro");
if (formBarbeiro) {
  formBarbeiro.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("barbeiro-id").value;

    // Captura direta e limpa dos campos do formulário
    const nomeInput = document.getElementById("barbeiro-nome").value;
    const telefoneInput = document
      .getElementById("barbeiro-telefone")
      .value.replace(/\D/g, ""); // Remove parênteses e traços, deixando apenas os números

    const payload = {
      name: nomeInput,
      phone: telefoneInput,
      speciality: "Geral",
      photo: "",
      active: true,
      payment_type: document.getElementById("barbeiro-payment-type").value,
      commission_percent: parseFloat(document.getElementById("barbeiro-comissao").value) || 0,
      fixed_salary: parseFloat(document.getElementById("barbeiro-fixo").value) || 0,
      pix_key: document.getElementById("barbeiro-pix").value || null,
    };

    const url = id
      ? `${API_BASE_URL}/profissionais/${id}`
      : `${API_BASE_URL}/profissionais`;
    const method = id ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        fecharModalBarbeiro();
        renderBarbeiros();
        mostrarToastAdmin("Profissional salvo com sucesso!");
      } else {
        const errData = await res.json();
        console.error("ERRO COMPLETO DO LARAVEL:", errData); // <-- VAI MOSTRAR TUDO NO F12

        // Exibe a mensagem real que vier do servidor
        let erroMsg = errData.message || "Erro ao salvar profissional.";
        if (errData.errors) {
          erroMsg = Object.values(errData.errors)[0][0];
        }

        mostrarToastAdmin(erroMsg, "erro");
      }
    } catch (err) {
      mostrarToastAdmin("Erro de conexão.", "erro");
    }
  });
}
// --------------------------------------------------------------------------
// 6. MÓDULO: DASHBOARD FINANCEIRO
// --------------------------------------------------------------------------
async function renderDashboard() {
  const elDia = document.getElementById("faturamento-dia");
  const elMes = document.getElementById("faturamento-mes");
  const elAno = document.getElementById("faturamento-ano");

  if (!elDia || !elMes || !elAno) return;

  try {
    const response = await fetch(`${API_BASE_URL}/faturamento`, {
      headers: authHeaders()
    });
    if (!(await checarSessao(response))) return;
    if (!response.ok) throw new Error(`Erro na resposta do servidor`);

    const jsonBody = await response.json();
    const faturamento = jsonBody.data ? jsonBody.data : jsonBody;

    elDia.innerText = Number(faturamento.dia || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    elMes.innerText = Number(faturamento.mes || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    elAno.innerText = Number(faturamento.ano || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  } catch (error) {
    elDia.innerText = "R$ 0,00";
    elMes.innerText = "R$ 0,00";
    elAno.innerText = "R$ 0,00";
  }
}

// --------------------------------------------------------------------------
// 7. MÓDULO: AVISO GERAL (POP-UP DOS CLIENTES)
// --------------------------------------------------------------------------
async function renderAviso() {


  try {
    const response = await fetch(`${API_BASE_URL}/avisos/1`, {
      headers: authHeaders()
      
    });

    if (response.ok) {
      const jsonBody = await response.json();
      const aviso = jsonBody.data ? jsonBody.data : jsonBody;

      document.getElementById("aviso-status").value = aviso.ativo
        ? "ativo"
        : "inativo";
      document.getElementById("aviso-titulo").value = aviso.titulo || "";
      document.getElementById("aviso-texto").value = aviso.mensagem || "";
    }
  } catch (error) {
    console.error("Nenhum aviso configurado");
  }
}

const formAviso = document.getElementById("form-aviso");
if (formAviso) {
  formAviso.addEventListener("submit", async (e) => {
    e.preventDefault();


    const payload = {
      ativo: document.getElementById("aviso-status").value === "ativo",
      titulo: document.getElementById("aviso-titulo").value,
      mensagem: document.getElementById("aviso-texto").value,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/avisos/1`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        mostrarToastAdmin("Aviso do aplicativo atualizado com sucesso!");
      } else {
        mostrarToastAdmin("Erro ao salvar o aviso.", "erro");
      }
    } catch (error) {
      mostrarToastAdmin("Erro de conexão com o servidor.", "erro");
    }
  });
}

// --------------------------------------------------------------------------
// 8. TELA DE CARREGAMENTO, MÁSCARAS E INICIALIZAÇÃO
// --------------------------------------------------------------------------
function esconderLoading() {
  const loading = document.getElementById("loading-overlay");
  if (loading) {
    loading.classList.add("loading-escondido");
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  // SEGURANÇA: Verifica se o token de login existe antes de carregar o painel
  const token = localStorage.getItem("admin_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

/*   await Promise.all([
    renderAgenda(),
    renderServicos(),
    renderBarbeiros(),
    renderDashboard(),
    renderAviso(),
  ]); */

    await renderAgenda()
    await renderServicos()
    await renderBarbeiros()
    await renderDashboard()
    await renderAviso()
    await renderFaturamento()
    await renderInstancias()
    await renderExpediente()
    await renderAuditoria()
    await renderConfiguracoes()

  const btnFiltrar = document.getElementById("btn-filtrar-agenda");
  const inputData = document.getElementById("filter-date");

  if (btnFiltrar && inputData) {
    btnFiltrar.addEventListener("click", () => {
      const dataEscolhida = inputData.value;
      renderAgenda(dataEscolhida);
    });
  }

  const inputPreco = document.getElementById("servico-preco");
  if (inputPreco) {
    inputPreco.addEventListener("input", (e) => {
      let valor = e.target.value.replace(/\D/g, "");
      if (valor === "") {
        e.target.value = "";
        return;
      }
      valor = (parseInt(valor, 10) / 100).toFixed(2);
      valor = valor.replace(".", ",");
      valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
      e.target.value = valor;
    });
  }

  const inputTelefone = document.getElementById("barbeiro-telefone");
  if (inputTelefone) {
    inputTelefone.addEventListener("input", (e) => {
      let valor = e.target.value.replace(/\D/g, "");
      if (valor.length > 2) {
        valor = `(${valor.substring(0, 2)})${valor.substring(2)}`;
      }
      e.target.value = valor;
    });
  }

  esconderLoading();
});

// --------------------------------------------------------------------------
// 9. MÓDULO: FATURAMENTO E FOLHA DE COMISSÕES
// --------------------------------------------------------------------------
function moedaBR(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function renderFaturamento() {
  const corpoProf = document.getElementById("fat-profissionais-body");
  if (!corpoProf) return;

  const inicio = document.getElementById("fat-inicio") ? document.getElementById("fat-inicio").value : "";
  const fim = document.getElementById("fat-fim") ? document.getElementById("fat-fim").value : "";
  let url = `${API_BASE_URL}/faturamento`;
  const qs = [];
  if (inicio) qs.push(`inicio=${inicio}`);
  if (fim) qs.push(`fim=${fim}`);
  if (qs.length) url += `?${qs.join("&")}`;

  corpoProf.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:16px;">Carregando...</td></tr>`;

  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!(await checarSessao(res))) return;
    if (!res.ok) throw new Error("erro");
    const d = await res.json();

    const p = d.periodo || {};
    document.getElementById("fat-total").innerText = moedaBR(p.faturamento_total);
    document.getElementById("fat-comissoes").innerText = moedaBR(p.total_comissoes);
    document.getElementById("fat-fixo").innerText = moedaBR(p.total_fixo);
    document.getElementById("fat-liquido").innerText = moedaBR(p.lucro_liquido);

    const tipoLabel = { comissao: "Comissão", fixo: "Fixo", comissao_mais_fixo: "Com.+Fixo" };

    corpoProf.innerHTML = "";
    (d.por_profissional || []).forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td data-label="Profissional"><strong>${r.profissional || "-"}</strong></td>` +
        `<td data-label="Tipo">${tipoLabel[r.payment_type] || r.payment_type || "-"}</td>` +
        `<td data-label="Atend.">${r.atendimentos}</td>` +
        `<td data-label="Bruto">${moedaBR(r.bruto)}</td>` +
        `<td data-label="Comissão">${moedaBR(r.comissao)}</td>` +
        `<td data-label="Fixo">${moedaBR(r.fixo)}</td>` +
        `<td data-label="Total a pagar" style="color: var(--brand-primary); font-weight:600;">${moedaBR(r.total_a_pagar)}</td>` +
        `<td data-label="Ação"><button class="btn-action confirm" title="Registrar repasse" onclick="abrirModalPayout(${r.worker_id}, '${(r.profissional || "").replace(/'/g, "")}', ${r.total_a_pagar})">💸</button></td>`;
      corpoProf.appendChild(tr);
    });
    if (!(d.por_profissional || []).length) {
      corpoProf.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--text-muted);">Nenhum atendimento concluído no período.</td></tr>`;
    }

    const corpoServ = document.getElementById("fat-servicos-body");
    corpoServ.innerHTML = "";
    (d.por_servico || []).forEach((r) => {
      corpoServ.insertAdjacentHTML("beforeend", `<tr><td data-label="Serviço">${r.servico || "-"}</td><td data-label="Qtd">${r.quantidade}</td><td data-label="Total">${moedaBR(r.total)}</td></tr>`);
    });

    const corpoItens = document.getElementById("fat-itens-body");
    corpoItens.innerHTML = "";
    (d.itens || []).forEach((r) => {
      const dt = (r.data || "").split("-").reverse().join("/");
      corpoItens.insertAdjacentHTML("beforeend", `<tr><td data-label="Data">${dt}</td><td data-label="Cliente">${r.cliente || "-"}</td><td data-label="Serviço">${r.servico || "-"}</td><td data-label="Profissional">${r.profissional || "-"}</td><td data-label="Valor">${moedaBR(r.valor)}</td><td data-label="Comissão">${moedaBR(r.comissao)}</td></tr>`);
    });
    if (!(d.itens || []).length) {
      corpoItens.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text-muted);">Sem atendimentos.</td></tr>`;
    }

    await renderRepasses();
  } catch (e) {
    corpoProf.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger);">Servidor offline.</td></tr>`;
  }
}

async function renderRepasses() {
  const corpo = document.getElementById("fat-repasses-body");
  if (!corpo) return;
  try {
    const res = await fetch(`${API_BASE_URL}/payouts`, { headers: authHeaders() });
    if (!res.ok) return;
    const d = await res.json();
    corpo.innerHTML = "";
    (d.data || []).forEach((r) => {
      const ini = (r.periodo_inicio || "").slice(0, 10).split("-").reverse().join("/");
      const fim = (r.periodo_fim || "").slice(0, 10).split("-").reverse().join("/");
      const dtPago = (r.pago_em || "").slice(0, 10).split("-").reverse().join("/");
      corpo.insertAdjacentHTML("beforeend", `<tr><td data-label="Profissional">${(r.worker && r.worker.name) || "-"}</td><td data-label="Período">${ini} – ${fim}</td><td data-label="Valor pago">${moedaBR(r.valor_pago)}</td><td data-label="Data">${dtPago}</td></tr>`);
    });
    if (!(d.data || []).length) {
      corpo.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text-muted);">Nenhum repasse.</td></tr>`;
    }
  } catch (e) {
    /* silencioso */
  }
}

window.abrirModalPayout = function (workerId, nome, total) {
  const hoje = new Date();
  const campoIni = document.getElementById("fat-inicio");
  const campoFim = document.getElementById("fat-fim");
  const ini = (campoIni && campoIni.value) || new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const fim = (campoFim && campoFim.value) || new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  document.getElementById("payout-worker-id").value = workerId;
  document.getElementById("payout-inicio").value = ini;
  document.getElementById("payout-fim").value = fim;
  document.getElementById("payout-obs").value = "";
  document.getElementById("payout-resumo").innerText = `${nome} — total estimado no período filtrado: ${moedaBR(total)}. O valor final é recalculado no servidor.`;
  document.getElementById("modal-payout").classList.add("active");
};
window.fecharModalPayout = function () {
  document.getElementById("modal-payout").classList.remove("active");
};

const formPayout = document.getElementById("form-payout");
if (formPayout) {
  formPayout.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      worker_id: parseInt(document.getElementById("payout-worker-id").value, 10),
      inicio: document.getElementById("payout-inicio").value,
      fim: document.getElementById("payout-fim").value,
      observacao: document.getElementById("payout-obs").value || null,
    };
    try {
      const res = await fetch(`${API_BASE_URL}/payouts`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) {
        mostrarToastAdmin(`Repasse de ${moedaBR(d.payout && d.payout.valor_pago)} registrado!`);
        fecharModalPayout();
        renderFaturamento();
      } else {
        mostrarToastAdmin(d.message || "Erro ao registrar repasse.", "erro");
      }
    } catch (err) {
      mostrarToastAdmin("Erro de conexão.", "erro");
    }
  });
}

const btnFiltrarFat = document.getElementById("btn-filtrar-fat");
if (btnFiltrarFat) btnFiltrarFat.addEventListener("click", () => renderFaturamento());

// --------------------------------------------------------------------------
// 10. MÓDULO: INSTÂNCIAS DE WHATSAPP
// --------------------------------------------------------------------------
let _pollInstancia = null;

const STATUS_INSTANCIA = {
  conectado: ["confirmed", "Conectado"],
  conectando: ["pending", "Aguardando conexão"],
  desconectado: ["cancel", "Desconectado"],
  erro: ["cancel", "Erro"],
};

async function renderInstancias() {
  const corpo = document.getElementById("instancias-table-body");
  if (!corpo) return;
  corpo.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;">Carregando...</td></tr>`;
  try {
    const res = await fetch(`${API_BASE_URL}/instances`, { headers: authHeaders() });
    if (!(await checarSessao(res))) return;
    if (!res.ok) throw new Error("erro");
    const d = await res.json();

    // Aviso no topo quando nenhuma instância está conectada
    const aviso = document.getElementById("instancias-alerta");
    if (aviso) {
      if (d.alerta_sem_whatsapp) {
        aviso.style.display = "";
        aviso.textContent =
          "⚠️ Nenhuma instância de WhatsApp conectada — as confirmações de agendamento NÃO estão sendo enviadas. Reconecte uma instância abaixo.";
      } else {
        aviso.style.display = "none";
      }
    }

    corpo.innerHTML = "";
    (d.data || []).forEach((i) => {
      const par = STATUS_INSTANCIA[i.status] || ["pending", i.status];
      const ultima = i.last_connected_at ? new Date(i.last_connected_at).toLocaleString("pt-BR") : "—";
      const nomeSeguro = (i.name || "").replace(/'/g, "");
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td data-label="Nome"><strong>${i.name}</strong></td>` +
        `<td data-label="Status"><span class="status-badge ${par[0]}">${par[1]}</span></td>` +
        `<td data-label="Número">${i.phone_number || "—"}</td>` +
        `<td data-label="Última conexão">${ultima}</td>` +
        `<td data-label="Ações">` +
        `<button class="btn-action" title="Atualizar status" onclick="atualizarStatusInstancia(${i.id})">🔄</button> ` +
        `<button class="btn-action confirm" title="Conectar / novo QR" onclick="conectarInstancia(${i.id}, '${nomeSeguro}')">🔗</button> ` +
        `<button class="btn-action cancel" title="Excluir" onclick="excluirInstancia(${i.id}, '${nomeSeguro}')">🗑️</button>` +
        `</td>`;
      corpo.appendChild(tr);
    });
    if (!(d.data || []).length) {
      corpo.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted);">Nenhuma instância. Crie uma para enviar mensagens.</td></tr>`;
    }
  } catch (e) {
    corpo.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);">Servidor offline.</td></tr>`;
  }
}

window.atualizarStatusInstancia = async function (id) {
  try {
    const res = await fetch(`${API_BASE_URL}/instances/${id}/status`, { headers: authHeaders() });
    const d = await res.json();
    if (res.ok) mostrarToastAdmin(`Status: ${d.status}`);
    renderInstancias();
  } catch (e) {
    mostrarToastAdmin("Erro ao consultar status.", "erro");
  }
};

window.excluirInstancia = function (id, nome) {
  abrirModalConfirmacao(
    "Excluir instância",
    `A instância "${nome}" será desconectada e removida. Continuar?`,
    "Excluir",
    "danger",
    async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/instances/${id}`, { method: "DELETE", headers: authHeaders() });
        if (res.ok) {
          mostrarToastAdmin("Instância removida.");
          renderInstancias();
        } else {
          mostrarToastAdmin("Erro ao remover.", "erro");
        }
      } catch (e) {
        mostrarToastAdmin("Erro de conexão.", "erro");
      }
    },
  );
};

window.abrirModalInstancia = function () {
  document.getElementById("form-instancia").reset();
  document.getElementById("modal-instancia-titulo").innerText = "Nova instância";
  document.getElementById("instancia-nome-wrap").style.display = "";
  document.getElementById("instancia-qr-area").style.display = "none";
  document.getElementById("btn-criar-instancia").style.display = "";
  document.getElementById("btn-criar-instancia").innerText = "Criar e gerar QR";
  document.getElementById("modal-instancia").classList.add("active");
};

window.fecharModalInstancia = function () {
  if (_pollInstancia) {
    clearInterval(_pollInstancia);
    _pollInstancia = null;
  }
  document.getElementById("modal-instancia").classList.remove("active");
  renderInstancias();
};

window.conectarInstancia = async function (id, nome) {
  abrirModalInstancia();
  document.getElementById("modal-instancia-titulo").innerText = `Conectar: ${nome}`;
  document.getElementById("instancia-nome-wrap").style.display = "none";
  document.getElementById("btn-criar-instancia").style.display = "none";
  document.getElementById("instancia-qr-area").style.display = "";
  document.getElementById("instancia-qr-img").src = "";
  document.getElementById("instancia-status-label").innerText = "Gerando QR...";
  try {
    const res = await fetch(`${API_BASE_URL}/instances/${id}/qrcode`, { headers: authHeaders() });
    const d = await res.json();
    if (d.qrCode) {
      document.getElementById("instancia-qr-img").src = d.qrCode;
      document.getElementById("instancia-status-label").innerText = "Aguardando leitura...";
      iniciarPollingInstancia(id);
    } else {
      document.getElementById("instancia-status-label").innerText = d.message || "Não foi possível gerar o QR.";
    }
  } catch (e) {
    document.getElementById("instancia-status-label").innerText = "Serviço indisponível.";
  }
};

function iniciarPollingInstancia(id) {
  if (_pollInstancia) clearInterval(_pollInstancia);
  _pollInstancia = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/instances/${id}/status`, { headers: authHeaders() });
      const d = await res.json();
      const label = document.getElementById("instancia-status-label");
      if (d.status === "conectado") {
        label.innerText = "✅ Conectado!";
        clearInterval(_pollInstancia);
        _pollInstancia = null;
        setTimeout(fecharModalInstancia, 1200);
      } else if (d.status === "erro") {
        label.innerText = "Erro na conexão.";
      } else {
        label.innerText = "Aguardando leitura...";
      }
    } catch (e) {
      /* segue tentando */
    }
  }, 3000);
}

const formInstancia = document.getElementById("form-instancia");
if (formInstancia) {
  formInstancia.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (document.getElementById("btn-criar-instancia").style.display === "none") return;
    const nome = document.getElementById("instancia-nome").value.trim();
    const btn = document.getElementById("btn-criar-instancia");
    btn.disabled = true;
    btn.innerText = "Criando...";
    try {
      const res = await fetch(`${API_BASE_URL}/instances`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name: nome }),
      });
      const d = await res.json();
      btn.disabled = false;
      btn.innerText = "Criar e gerar QR";
      if (!res.ok) {
        mostrarToastAdmin(d.message || (d.errors ? Object.values(d.errors)[0][0] : "Erro ao criar."), "erro");
        return;
      }
      document.getElementById("instancia-nome-wrap").style.display = "none";
      btn.style.display = "none";
      document.getElementById("instancia-qr-area").style.display = "";
      if (d.qrCode) {
        document.getElementById("instancia-qr-img").src = d.qrCode;
        document.getElementById("instancia-status-label").innerText = "Aguardando leitura...";
        iniciarPollingInstancia(d.instance.id);
      } else {
        document.getElementById("instancia-status-label").innerText = "Instância criada, mas o QR não foi retornado. Use o botão 🔗 na lista.";
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerText = "Criar e gerar QR";
      mostrarToastAdmin("Erro de conexão com o servidor.", "erro");
    }
  });
}

// --------------------------------------------------------------------------
// 11. MÓDULO: HORÁRIO DE FUNCIONAMENTO
// --------------------------------------------------------------------------
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

async function renderExpediente() {
  const corpo = document.getElementById("expediente-body");
  if (!corpo) return;
  let grade = {};
  try {
    const res = await fetch(`${API_BASE_URL}/tempo_de_operacao`, { headers: authHeaders() });
    if (!(await checarSessao(res))) return;
    if (res.ok) {
      const d = await res.json();
      (d.data ? d.data : d).forEach((o) => (grade[Number(o.day_of_week)] = o));
    }
  } catch (e) { /* usa vazio */ }

  const hm = (v) => (v ? String(v).slice(0, 5) : "");
  corpo.innerHTML = "";
  for (let dow = 0; dow < 7; dow++) {
    const o = grade[dow] || {};
    const tr = document.createElement("tr");
    tr.dataset.dow = dow;
    tr.innerHTML =
      `<td data-label="Dia"><strong>${DIAS_SEMANA[dow]}</strong></td>` +
      `<td data-label="Aberto"><input type="checkbox" class="exp-active" ${o.active ? "checked" : ""}></td>` +
      `<td data-label="Abre"><input type="time" class="admin-input exp-start" value="${hm(o.start_time) || "08:00"}"></td>` +
      `<td data-label="Fecha"><input type="time" class="admin-input exp-end" value="${hm(o.end_time) || "19:00"}"></td>` +
      `<td data-label="Intervalo início"><input type="time" class="admin-input exp-ws" value="${hm(o.waiting_start)}"></td>` +
      `<td data-label="Intervalo fim"><input type="time" class="admin-input exp-we" value="${hm(o.waiting_end)}"></td>`;
    corpo.appendChild(tr);
  }
}

const btnSalvarExpediente = document.getElementById("btn-salvar-expediente");
if (btnSalvarExpediente) {
  btnSalvarExpediente.addEventListener("click", async () => {
    const linhas = document.querySelectorAll("#expediente-body tr");
    btnSalvarExpediente.disabled = true;
    let erros = 0;
    for (const tr of linhas) {
      const payload = {
        day_of_week: Number(tr.dataset.dow),
        active: tr.querySelector(".exp-active").checked,
        start_time: tr.querySelector(".exp-start").value || "08:00",
        end_time: tr.querySelector(".exp-end").value || "19:00",
        waiting_start: tr.querySelector(".exp-ws").value || null,
        waiting_end: tr.querySelector(".exp-we").value || null,
      };
      try {
        const res = await fetch(`${API_BASE_URL}/tempo_de_operacao`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        });
        if (!res.ok) erros++;
      } catch (e) {
        erros++;
      }
    }
    btnSalvarExpediente.disabled = false;
    mostrarToastAdmin(erros ? `Salvo com ${erros} erro(s).` : "Horários salvos!", erros ? "erro" : "sucesso");
    renderExpediente();
  });
}

// --------------------------------------------------------------------------
// AUDITORIA: últimas ações do painel
// --------------------------------------------------------------------------
async function renderAuditoria() {
  const corpo = document.getElementById("auditoria-table-body");
  if (!corpo) return;
  corpo.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;">Carregando...</td></tr>`;
  try {
    const res = await fetch(`${API_BASE_URL}/auditoria?per_page=20`, { headers: authHeaders() });
    if (!(await checarSessao(res))) return;
    if (!res.ok) throw new Error("erro");
    const d = await res.json();
    const linhas = d.data || [];
    corpo.innerHTML = "";
    linhas.forEach((l) => {
      const tr = document.createElement("tr");
      const quando = l.created_at ? new Date(l.created_at).toLocaleString("pt-BR") : "—";
      tr.innerHTML =
        `<td data-label="Quando">${quando}</td>` +
        `<td data-label="Quem">${l.user?.name || "—"}</td>` +
        `<td data-label="Ação">${l.action}</td>` +
        `<td data-label="Detalhe">${l.description || ""}</td>`;
      corpo.appendChild(tr);
    });
    if (!linhas.length) {
      corpo.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--text-muted);">Nenhuma atividade registrada ainda.</td></tr>`;
    }
  } catch (e) {
    corpo.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger);">Servidor offline.</td></tr>`;
  }
}

// --------------------------------------------------------------------------
// 12. MÓDULO: CONFIGURAÇÕES (IDENTIDADE VISUAL DA PÁGINA PÚBLICA)
// --------------------------------------------------------------------------
let barbershopAtual = null;

function sincronizarCorHex(inputColor, inputHex) {
  if (!inputColor || !inputHex) return;
  inputColor.addEventListener("input", () => {
    inputHex.value = inputColor.value.toUpperCase();
  });
  inputHex.addEventListener("input", () => {
    const v = inputHex.value.trim();
    if (/^#([0-9A-Fa-f]{6})$/.test(v)) {
      inputColor.value = v;
    }
  });
}

async function renderConfiguracoes() {
  const form = document.getElementById("form-configuracoes");
  if (!form) return;

  try {
    const res = await fetch(`${API_BASE_URL}/barbearias`, { headers: authHeaders() });
    if (!(await checarSessao(res))) return;
    if (!res.ok) return;
    const lista = await res.json();
    const bs = Array.isArray(lista) ? lista[0] : (lista.data ? lista.data[0] : null);
    if (!bs) return;

    barbershopAtual = bs;

    const linkInput = document.getElementById("config-link-agendamento");
    if (linkInput && bs.slug) {
      linkInput.value = `${window.location.origin}/index.html?b=${encodeURIComponent(bs.slug)}`;
    }

    document.getElementById("config-id").value = bs.id;
    document.getElementById("config-nome").value = bs.name || "";
    document.getElementById("config-subtitulo").value = bs.subtitle || "";
    document.getElementById("config-cidade").value = bs.city || "";
    document.getElementById("config-estado").value = bs.state || "";

    const corPrincipal = bs.accent_color || "#C89B3C";
    const corSecundaria = bs.secondary_color || "#C89B3C";
    document.getElementById("config-cor-principal").value = corPrincipal;
    document.getElementById("config-cor-principal-hex").value = corPrincipal.toUpperCase();
    document.getElementById("config-cor-secundaria").value = corSecundaria;
    document.getElementById("config-cor-secundaria-hex").value = corSecundaria.toUpperCase();
  } catch (e) {
    console.error("Não foi possível carregar as configurações da barbearia.");
  }
}

sincronizarCorHex(
  document.getElementById("config-cor-principal"),
  document.getElementById("config-cor-principal-hex")
);
sincronizarCorHex(
  document.getElementById("config-cor-secundaria"),
  document.getElementById("config-cor-secundaria-hex")
);

const btnCopiarLink = document.getElementById("btn-copiar-link");
if (btnCopiarLink) {
  btnCopiarLink.addEventListener("click", async () => {
    const linkInput = document.getElementById("config-link-agendamento");
    if (!linkInput || !linkInput.value) return;
    try {
      await navigator.clipboard.writeText(linkInput.value);
    } catch (e) {
      linkInput.select();
      document.execCommand("copy");
    }
    mostrarToastAdmin("Link copiado!");
  });
}

const formConfiguracoes = document.getElementById("form-configuracoes");
if (formConfiguracoes) {
  formConfiguracoes.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!barbershopAtual) return;

    const id = document.getElementById("config-id").value;

    // Mantém os demais campos do cadastro (o endpoint exige nome/slug),
    // só sobrescreve o que essa tela edita.
    const payload = {
      ...barbershopAtual,
      name: document.getElementById("config-nome").value,
      subtitle: document.getElementById("config-subtitulo").value || null,
      city: document.getElementById("config-cidade").value || null,
      state: document.getElementById("config-estado").value || null,
      accent_color: document.getElementById("config-cor-principal-hex").value || "#C89B3C",
      secondary_color: document.getElementById("config-cor-secundaria-hex").value || "#C89B3C",
    };

    try {
      const response = await fetch(`${API_BASE_URL}/barbearias/${id}`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      if (!(await checarSessao(response))) return;

      if (response.ok) {
        barbershopAtual = await response.json();
        mostrarToastAdmin("Identidade visual atualizada com sucesso!");
      } else {
        mostrarToastAdmin("Erro ao salvar. Confira os campos.", "erro");
      }
    } catch (error) {
      mostrarToastAdmin("Erro de conexão com o servidor.", "erro");
    }
  });
}
