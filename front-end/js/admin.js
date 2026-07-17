// --------------------------------------------------------------------------
// 1. NAVEGAÇÃO DE ABAS
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

// --------------------------------------------------------------------------
// 2. CONFIGURAÇÕES BASE
// --------------------------------------------------------------------------
const API_BASE_URL = 'http://localhost:3000/api';

function formatarTelefoneAdmin(telefone) {
    if (!telefone) return "";
    return `(${telefone.slice(0,2)}) ${telefone.slice(2,7)}-${telefone.slice(7)}`;
}

// --------------------------------------------------------------------------
// 3. MÓDULO: AGENDA
// --------------------------------------------------------------------------
async function renderAgenda() {
    const tableBody = document.getElementById("agenda-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Buscando agendamentos...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/agendamentos`);
        if (!response.ok) throw new Error("Erro de rede");
        const agendamentos = await response.json();
        
        tableBody.innerHTML = "";
        const agendamentosAtivos = agendamentos.filter(ag => ag.status !== "cancelado");

        if (agendamentosAtivos.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhum agendamento ativo.</td></tr>`;
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
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger);">Servidor offline.</td></tr>`;
    }
}

window.alterarStatus = async function(id, novoStatus) {
    if (novoStatus === 'cancelado' && !confirm("Cancelar agendamento?")) return;
    try {
        const res = await fetch(`${API_BASE_URL}/agendamentos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });
        if (res.ok) renderAgenda();
    } catch (error) {
        alert("Falha na conexão.");
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

// DELETE Serviços
window.deletarServico = async function(id) {
    if (!confirm("Tem certeza que deseja apagar este serviço definitivamente?")) return;
    try {
        const response = await fetch(`${API_BASE_URL}/servicos/${id}`, { method: 'DELETE' });
        if (response.ok) renderServicos();
        else alert("Erro ao apagar.");
    } catch (error) {
        alert("Erro de rede.");
    }
};

window.abrirModalServico = function(id = null) {
    document.getElementById("form-servico").reset();
    document.getElementById("modal-titulo").innerText = id ? "Editar Serviço" : "Novo Serviço";
    document.getElementById("servico-id").value = id || "";
    // Aqui virá o fetch de edição no futuro
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
            if (res.ok) { fecharModalServico(); renderServicos(); }
        } catch (err) { alert("Erro de conexão."); }
    });
}

// --------------------------------------------------------------------------
// 5. MÓDULO: BARBEIROS (Simplificado)
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

// DELETE Barbeiros
window.deletarBarbeiro = async function(id) {
    if (!confirm("Tem certeza que deseja apagar este profissional?")) return;
    try {
        const response = await fetch(`${API_BASE_URL}/barbeiros/${id}`, { method: 'DELETE' });
        if (response.ok) renderBarbeiros();
        else alert("Erro ao apagar.");
    } catch (error) {
        alert("Erro de rede.");
    }
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
            if (res.ok) { fecharModalBarbeiro(); renderBarbeiros(); }
        } catch (err) { alert("Erro de conexão."); }
    });
}

// --------------------------------------------------------------------------
// 6. GATILHO DE INICIALIZAÇÃO
// --------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    renderAgenda();
    renderServicos();
    renderBarbeiros();
});