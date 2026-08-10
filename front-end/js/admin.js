// --------------------------------------------------------------------------
// 1. NAVEGAÇÃO DE ABAS E TOAST (MENSAGENS)
// --------------------------------------------------------------------------
const menuItems = document.querySelectorAll('.menu-item');
const tabPanels = document.querySelectorAll('.tab-panel');

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        menuItems.forEach(btn => btn.classList.remove('active'));
        item.classList.add('active');

        const targetTab = item.getAttribute('data-tab');
        tabPanels.forEach(panel => panel.classList.remove('active'));
        document.getElementById(`panel-${targetTab}`).classList.add('active');
    });
});

window.mostrarToastAdmin = function(mensagem, tipo = 'sucesso') {
    const toast = document.getElementById("admin-toast");
    const texto = document.getElementById("admin-toast-texto");

    if (!toast || !texto) return;

    texto.innerText = mensagem;
    toast.classList.remove("toast-sucesso", "toast-erro");

    if (tipo === 'erro') {
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
const API_BASE_URL = 'http://localhost:8000/api';

function formatarTelefoneAdmin(telefone) {
    if (!telefone) return "";
    return `(${telefone.slice(0,2)}) ${telefone.slice(2,7)}-${telefone.slice(7)}`;
}

let acaoPendente = null; 

window.abrirModalConfirmacao = function(titulo, mensagem, textoBotao, tipoBotao, callback) {
    document.getElementById("confirm-titulo").innerText = titulo;
    document.getElementById("confirm-mensagem").innerText = mensagem;
    
    const btnConfirmar = document.getElementById("btn-confirmar-acao");
    btnConfirmar.innerText = textoBotao;
    
    if (tipoBotao === 'danger') {
        btnConfirmar.style.backgroundColor = 'var(--danger)';
        btnConfirmar.style.color = '#ffffff';
    } else {
        btnConfirmar.style.backgroundColor = 'var(--brand-primary)';
        btnConfirmar.style.color = 'var(--brand-bg-dark)';
    }
    
    acaoPendente = callback;
    document.getElementById("modal-confirmacao").classList.add("active");
}

window.fecharModalConfirmacao = function() {
    document.getElementById("modal-confirmacao").classList.remove("active");
    acaoPendente = null; 
}

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

        const response = await fetch(url);
        
        if (!response.ok) throw new Error("Erro de rede");
        const agendamentos = await response.json();
        
        tableBody.innerHTML = "";
        
        const agendamentosAtivos = agendamentos.filter(ag => ag.status !== "cancelado");

        if (agendamentosAtivos.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhum agendamento para esta data.</td></tr>`;
            return;
        }

        agendamentosAtivos.forEach(agendamento => {
            const tr = document.createElement("tr");
            let badgeClass = agendamento.status === "confirmado" ? "confirmed" : "pending";
            let badgeText = agendamento.status === "confirmado" ? "Confirmado" : "Aguardando";

            tr.innerHTML = `
                <td>
                    <strong>${agendamento.cliente_nome}</strong><br>
                    <span class="text-small">${formatarTelefoneAdmin(agendamento.cliente_telefone)}</span>
                </td>
                <td>${agendamento.Servico ? agendamento.Servico.nome : 'N/A'}</td>
                <td>${agendamento.Barbeiro ? agendamento.Barbeiro.nome : 'N/A'}</td>
                <td>${agendamento.data.split('-').reverse().join('/')} às ${agendamento.horario}</td>
                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                <td>
                    ${agendamento.status === "pendente" ? `<button class="btn-action confirm" onclick="alterarStatus(${agendamento.id}, 'confirmado')" title="Confirmar">✔️</button>` : ''}
                    <button class="btn-action cancel" onclick="alterarStatus(${agendamento.id}, 'cancelado')" title="Cancelar">❌</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">Servidor offline</td></tr>`;
    }
}

// Atualizado para usar Toast e Modal
window.alterarStatus = async function(id, novoStatus) {
    const executarAlteracao = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/agendamentos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: novoStatus })
            });
            if (res.ok) {
                mostrarToastAdmin(novoStatus === 'confirmado' ? "Horário confirmado!" : "Agendamento cancelado com sucesso!");
                // Pega a data que está no filtro no momento para não perder a pesquisa
                const dataAtualFiltro = document.getElementById("filter-date") ? document.getElementById("filter-date").value : "";
                renderAgenda(dataAtualFiltro);
            } else {
                mostrarToastAdmin("Erro ao alterar o status.", "erro");
            }
        } catch (error) {
            mostrarToastAdmin("Falha na conexão. Tente novamente.", "erro");
        }
    };

    if (novoStatus === 'cancelado') {
        abrirModalConfirmacao("Cancelar Horário", "Deseja realmente cancelar este agendamento? Esta ação não pode ser desfeita.", "Sim, Cancelar", "danger", executarAlteracao);
    } else {
        executarAlteracao(); // Confirma direto, sem modal
    }
};

// --------------------------------------------------------------------------
// 4. MÓDULO: SERVIÇOS
// --------------------------------------------------------------------------
async function renderServicos() {
    const tableBody = document.getElementById("servicos-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Buscando serviços...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/servicos`);
        if (!response.ok) throw new Error("Erro");
        const servicos = await response.json();
        
        tableBody.innerHTML = "";
        if (servicos.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Sem serviços.</td></tr>`;
            return;
        }

        servicos.forEach(servico => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-size: 24px;">${servico.icon}</td>
                <td><strong>${servico.nome}</strong></td>
                <td style="color: var(--brand-primary); font-weight: 600;">R$ ${Number(servico.preco).toFixed(2)}</td>
                <td>${servico.duracao} min</td>
                <td>
                    <button class="btn-action" onclick="abrirModalServico(${servico.id})" title="Editar">✏️</button>
                    <button class="btn-action cancel" onclick="deletarServico(${servico.id})" title="Excluir">🗑️</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Servidor offline.</td></tr>`;
    }
}

// Atualizado para usar Toast e Modal
window.deletarServico = function(id) {
    abrirModalConfirmacao("Excluir Serviço", "Tem certeza que deseja apagar este serviço definitivamente?", "Excluir Serviço", "danger", async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/servicos/${id}`, { method: 'DELETE' });
            if (response.ok) {
                mostrarToastAdmin("Serviço excluído com sucesso!");
                renderServicos();
            } else {
                mostrarToastAdmin("Erro ao apagar o serviço.", "erro");
            }
        } catch (error) {
            mostrarToastAdmin("Erro de rede. Tente novamente.", "erro");
        }
    });
};

window.abrirModalServico = function(id = null) {
    document.getElementById("form-servico").reset();
    document.getElementById("modal-titulo").innerText = id ? "Editar Serviço" : "Novo Serviço";
    document.getElementById("servico-id").value = id || "";
    document.getElementById("modal-servico").classList.add("active");
}

window.fecharModalServico = () => document.getElementById("modal-servico").classList.remove("active");

const formServico = document.getElementById("form-servico");
if (formServico) {
    formServico.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("servico-id").value;
        const payload = {
            icon: document.getElementById("servico-icon").value,
            nome: document.getElementById("servico-nome").value,
            preco: parseFloat(document.getElementById("servico-preco").value),
            duracao: parseInt(document.getElementById("servico-duracao").value)
        };

        const url = id ? `${API_BASE_URL}/servicos/${id}` : `${API_BASE_URL}/servicos`;
        const method = id ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (res.ok) { 
                fecharModalServico(); 
                renderServicos(); 
                mostrarToastAdmin("Serviço salvo com sucesso!");
            } else {
                mostrarToastAdmin("Erro ao salvar serviço.", "erro");
            }
        } catch (err) { 
            mostrarToastAdmin("Erro de conexão com o servidor.", "erro"); 
        }
    });
}

// --------------------------------------------------------------------------
// 5. MÓDULO: BARBEIROS
// --------------------------------------------------------------------------
async function renderBarbeiros() {
    const tableBody = document.getElementById("barbeiros-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Buscando profissionais...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/barbeiros`);
        if (!response.ok) throw new Error("Erro");
        const barbeiros = await response.json();
        
        tableBody.innerHTML = "";
        if (barbeiros.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum cadastrado.</td></tr>`;
            return;
        }

        barbeiros.forEach(barbeiro => {
            const tr = document.createElement("tr");
            const inicial = barbeiro.nome.charAt(0).toUpperCase();
            tr.innerHTML = `
                <td><div class="table-avatar">${inicial}</div></td>
                <td><strong>${barbeiro.nome}</strong></td>
                <td>${formatarTelefoneAdmin(barbeiro.telefone)}</td>
                <td>
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

// Atualizado para usar Toast e Modal
window.deletarBarbeiro = function(id) {
    abrirModalConfirmacao("Excluir Profissional", "Tem certeza que deseja apagar este profissional do sistema?", "Excluir Profissional", "danger", async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/barbeiros/${id}`, { method: 'DELETE' });
            if (response.ok) {
                mostrarToastAdmin("Profissional removido com sucesso!");
                renderBarbeiros();
            } else {
                mostrarToastAdmin("Erro ao apagar profissional.", "erro");
            }
        } catch (error) {
            mostrarToastAdmin("Erro de rede. Tente novamente.", "erro");
        }
    });
};

window.abrirModalBarbeiro = function(id = null) {
    document.getElementById("form-barbeiro").reset();
    document.getElementById("modal-titulo-barbeiro").innerText = id ? "Editar Profissional" : "Novo Profissional";
    document.getElementById("barbeiro-id").value = id || "";
    document.getElementById("modal-barbeiro").classList.add("active");
}

window.fecharModalBarbeiro = () => document.getElementById("modal-barbeiro").classList.remove("active");

const formBarbeiro = document.getElementById("form-barbeiro");
if (formBarbeiro) {
    formBarbeiro.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("barbeiro-id").value;
        const payload = {
            nome: document.getElementById("barbeiro-nome").value,
            telefone: document.getElementById("barbeiro-telefone").value
        };

        const url = id ? `${API_BASE_URL}/barbeiros/${id}` : `${API_BASE_URL}/barbeiros`;
        const method = id ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (res.ok) { 
                fecharModalBarbeiro(); 
                renderBarbeiros(); 
                mostrarToastAdmin("Profissional salvo com sucesso!");
            } else {
                mostrarToastAdmin("Erro ao salvar profissional.", "erro");
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
        const response = await fetch(`${API_BASE_URL}/faturamento`);
        if (!response.ok) throw new Error(`Erro na resposta do servidor`);
        const faturamento = await response.json();

        elDia.innerText = Number(faturamento.dia || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        elMes.innerText = Number(faturamento.mes || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        elAno.innerText = Number(faturamento.ano || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
        const response = await fetch(`${API_BASE_URL}/avisos/1`); 
        
        if (response.ok) {
            const aviso = await response.json();
            document.getElementById("aviso-status").value = aviso.ativo ? "ativo" : "inativo";
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
            mensagem: document.getElementById("aviso-texto").value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/avisos/1`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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
// 8. TELA DE CARREGAMENTO E INICIALIZAÇÃO ASSÍNCRONA
// --------------------------------------------------------------------------
function esconderLoading() {
    const loading = document.getElementById("loading-overlay");
    if (loading) {
        loading.classList.add("loading-escondido");
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    // 1. Inicia todas as buscas de dados ao mesmo tempo
    await Promise.all([
        renderAgenda(),
        renderServicos(),
        renderBarbeiros(),
        renderDashboard(),
        renderAviso()
    ]);

    // 2. Configura a Lógica do Botão de Filtro da Agenda
    const btnFiltrar = document.getElementById("btn-filtrar-agenda");
    const inputData = document.getElementById("filter-date");

    if (btnFiltrar && inputData) {
        btnFiltrar.addEventListener("click", () => {
            const dataEscolhida = inputData.value; 
            renderAgenda(dataEscolhida);
        });
    }

    // 3. Oculta a animação de loading e revela o painel do administrador
    esconderLoading();
});