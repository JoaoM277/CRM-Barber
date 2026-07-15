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
// ==========================================================================
// MÓDULO DA AGENDA (INTEGRAÇÃO REAL COM A API REST)
// ==========================================================================

// 1. URL base do seu servidor Node.js/Express
const API_BASE_URL = 'http://localhost:3000/api';

// 2. Formatador de telefone (Mantido, pois o banco deve armazenar apenas números)
function formatarTelefoneAdmin(telefone) {
    if (!telefone) return "";
    return `(${telefone.slice(0,2)}) ${telefone.slice(2,7)}-${telefone.slice(7)}`;
}

// 3. Renderizador assíncrono que busca dados reais do servidor
async function renderAgenda() {
    const tableBody = document.getElementById("agenda-table-body");
    if (!tableBody) return;

    // Feedback visual enquanto a requisição viaja pela rede
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Buscando dados no servidor...</td></tr>`;

    try {
        // Dispara o GET para o seu servidor Express
        const response = await fetch(`${API_BASE_URL}/agendamentos`);
        
        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.status}`);
        }

        // Converte a resposta binária do servidor para um objeto JavaScript (JSON)
        const agendamentos = await response.json();

        tableBody.innerHTML = ""; // Limpa a mensagem de carregamento

        // No mundo real, a filtragem de status muitas vezes é feita direto no Sequelize (ex: WHERE status != 'cancelado')
        const agendamentosAtivos = agendamentos.filter(ag => ag.status !== "cancelado");

        if (agendamentosAtivos.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhum agendamento ativo.</td></tr>`;
            return;
        }

        agendamentosAtivos.forEach(agendamento => {
            const tr = document.createElement("tr");

            let badgeClass = agendamento.status === "confirmado" ? "confirmed" : "pending";
            let badgeText = agendamento.status === "confirmado" ? "Confirmado" : "Aguardando";

            // Monta o HTML assumindo que o Sequelize fará os 'includes' das tabelas relacionadas (JOIN)
            tr.innerHTML = `
                <td>
                    <strong>${agendamento.cliente_nome}</strong><br>
                    <span class="text-small">${formatarTelefoneAdmin(agendamento.cliente_telefone)}</span>
                </td>
                <td>${agendamento.Servico ? agendamento.Servico.nome : 'Serviço não listado'}</td>
                <td>${agendamento.Barbeiro ? agendamento.Barbeiro.nome : 'Sem profissional'}</td>
                <td>
                    ${agendamento.data.split('-').reverse().join('/')} às ${agendamento.horario}
                </td>
                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                <td>
                    ${agendamento.status === "pendente" ? `<button class="btn-action confirm" onclick="alterarStatus(${agendamento.id}, 'confirmado')" title="Confirmar">✔️</button>` : ''}
                    <button class="btn-action cancel" onclick="alterarStatus(${agendamento.id}, 'cancelado')" title="Cancelar">❌</button>
                </td>
            `;

            tableBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Falha ao buscar agenda:", error);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--danger);">Erro de conexão com o banco de dados.</td></tr>`;
    }
}

// 4. Função assíncrona para enviar o UPDATE ao banco
window.alterarStatus = async function(id, novoStatus) {
    if (novoStatus === 'cancelado') {
        const confirmar = confirm("Tem certeza que deseja cancelar este agendamento no banco?");
        if (!confirmar) return;
    }

    try {
        // Envia uma requisição PUT com os dados a serem atualizados no banco
        const response = await fetch(`${API_BASE_URL}/agendamentos/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ status: novoStatus }) // Payload enviado para o body do Express
        });

        if (response.ok) {
            // Se o Express retornar status 200 (sucesso), chamamos a função para redesenhar a tabela
            renderAgenda();
        } else {
            alert("O servidor recusou a atualização. Verifique os logs do back-end.");
        }

    } catch (error) {
        console.error("Erro no PUT:", error);
        alert("Falha na rede. Não foi possível comunicar com o servidor.");
    }
};

// 5. Gatilho de inicialização
window.addEventListener("DOMContentLoaded", () => {
    renderAgenda();
});