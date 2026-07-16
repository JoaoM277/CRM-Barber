// ==========================================================================
// SCRIPT DE CONTROLE DO PAINEL ADMINISTRATIVO (WHITE-LABEL)
// ==========================================================================

// --------------------------------------------------------------------------
// 1. CONTROLE DE NAVEGAÇÃO ENTRE ABAS (TABS)
// --------------------------------------------------------------------------
const menuItems = document.querySelectorAll('.menu-item');
const tabPanels = document.querySelectorAll('.tab-panel');

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        // Remove a classe de destaque 'active' de todos os botões do menu
        menuItems.forEach(btn => btn.classList.remove('active'));
        // Adiciona o destaque dourado apenas ao botão clicado
        item.classList.add('active');

        // Lê o atributo identificador da aba (ex: 'agenda', 'servicos')
        const targetTab = item.getAttribute('data-tab');

        // Oculta todas as telas centrais do painel
        tabPanels.forEach(panel => panel.classList.remove('active'));
        // Exibe apenas a tela correspondente ao botão clicado
        document.getElementById(`panel-${targetTab}`).classList.add('active');
    });
});

// --------------------------------------------------------------------------
// 2. CONFIGURAÇÕES GERAIS DE CONEXÃO (API REST)
// --------------------------------------------------------------------------
const API_BASE_URL = 'http://localhost:3000/api';

// Helper: Formata o telefone bruto do banco "11988887777" para "(11) 98888-7777"
function formatarTelefoneAdmin(telefone) {
    if (!telefone) return "";
    return `(${telefone.slice(0,2)}) ${telefone.slice(2,7)}-${telefone.slice(7)}`;
}


// --------------------------------------------------------------------------
// 3. MÓDULO DA AGENDA (DADOS EM TEMPO REAL)
// --------------------------------------------------------------------------

// Busca os agendamentos reais cadastrados no banco e desenha a tabela
async function renderAgenda() {
    const tableBody = document.getElementById("agenda-table-body");
    if (!tableBody) return;

    // Feedback visual de rede para o administrador
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Buscando dados no servidor...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/agendamentos`);
        
        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.status}`);
        }

        const agendamentos = await response.json();
        tableBody.innerHTML = ""; // Limpa a linha de carregamento

        // Filtra os registros ativos (tudo o que não estiver cancelado)
        const agendamentosAtivos = agendamentos.filter(ag => ag.status !== "cancelado");

        if (agendamentosAtivos.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhum agendamento ativo.</td></tr>`;
            return;
        }

        agendamentosAtivos.forEach(agendamento => {
            const tr = document.createElement("tr");

            // Configura a etiqueta de status visual com base no retorno do banco
            let badgeClass = agendamento.status === "confirmado" ? "confirmed" : "pending";
            let badgeText = agendamento.status === "confirmado" ? "Confirmado" : "Aguardando";

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

// Dispara um UPDATE (PUT) para atualizar o status do agendamento no back-end
window.alterarStatus = async function(id, novoStatus) {
    if (novoStatus === 'cancelado') {
        const confirmar = confirm("Tem certeza que deseja cancelar este agendamento no banco?");
        if (!confirmar) return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/agendamentos/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ status: novoStatus })
        });

        if (response.ok) {
            renderAgenda(); // Recarrega os registros atualizados na interface
        } else {
            alert("O servidor recusou a atualização. Verifique os logs do back-end.");
        }

    } catch (error) {
        console.error("Erro no PUT:", error);
        alert("Falha na rede. Não foi possível comunicar com o servidor.");
    }
};


// --------------------------------------------------------------------------
// 4. MÓDULO DE SERVIÇOS (TABELA E GERENCIAMENTO)
// --------------------------------------------------------------------------

// Busca os serviços do banco de dados e exibe na tabela do painel
async function renderServicos() {
    const tableBody = document.getElementById("servicos-table-body");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">Buscando serviços no servidor...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/servicos`);
        if (!response.ok) throw new Error("Erro de conexão");
        
        const servicos = await response.json();
        tableBody.innerHTML = ""; // Limpa o carregamento

        if (servicos.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhum serviço cadastrado.</td></tr>`;
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
                    <button class="btn-action cancel" title="Excluir">🗑️</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Falha ao renderizar serviços:", error);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Erro de conexão com o banco de dados.</td></tr>`;
    }
}

// Manipula a visibilidade do modal flutuante e reseta/prepara o formulário
window.abrirModalServico = function(id = null) {
    const modal = document.getElementById("modal-servico");
    const form = document.getElementById("form-servico");
    const titulo = document.getElementById("modal-titulo");

    if (!id) {
        // Fluxo: Cadastro de novo registro
        form.reset(); 
        document.getElementById("servico-id").value = "";
        titulo.innerText = "Novo Serviço";
    } else {
        // Fluxo: Edição de registro existente
        titulo.innerText = "Editar Serviço";
        document.getElementById("servico-id").value = id;
        
        // Futura conexão backend para edição:
        // fetch(`${API_BASE_URL}/servicos/${id}`).then(...) para preencher os inputs
    }

    modal.classList.add("active");
}

window.fecharModalServico = function() {
    const modal = document.getElementById("modal-servico");
    modal.classList.remove("active");
}

// Intercepta o clique em salvar no formulário de serviços para enviar à API
const formServico = document.getElementById("form-servico");

if (formServico) {
    formServico.addEventListener("submit", async (event) => {
        event.preventDefault(); // Impede o navegador de recarregar a tela

        // Coleta os inputs inseridos pelo administrador
        const id = document.getElementById("servico-id").value;
        const icon = document.getElementById("servico-icon").value;
        const nome = document.getElementById("servico-nome").value;
        const preco = document.getElementById("servico-preco").value;
        const duracao = document.getElementById("servico-duracao").value;

        // Estrutura o objeto JSON tipando preço e duração corretamente
        const dadosServico = {
            icon: icon,
            nome: nome,
            preco: parseFloat(preco),
            duracao: parseInt(duracao)
        };

        try {
            let url = `${API_BASE_URL}/servicos`;
            let metodo = "POST"; // Criação padrão

            // Se possuir ID oculto, redireciona para a rota PUT de atualização
            if (id) {
                url = `${API_BASE_URL}/servicos/${id}`;
                metodo = "PUT";
            }

            const response = await fetch(url, {
                method: metodo,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(dadosServico)
            });

            if (response.ok) {
                fecharModalServico(); // Fecha a janela flutuante
                renderServicos();     // Atualiza a tabela na tela
            } else {
                alert("Erro ao salvar o serviço no servidor.");
            }

        } catch (error) {
            console.error("Erro na requisição de salvamento:", error);
            alert("Não foi possível conectar ao servidor.");
        }
    });
}


// --------------------------------------------------------------------------
// 5. GATILHO DE INICIALIZAÇÃO GERAL DO PAINEL
// --------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    renderAgenda();   // Inicia a busca automática de agendamentos
    renderServicos(); // Inicia a busca automática de serviços cadastrados
    renderBarbeiros(); 
});
async function renderBarbeiros() {
    const tableBody = document.getElementById("barbeiros-table-body");
    if (!tableBody) return;

    // Atenção aqui: mudamos o colspan para 4, pois tiramos uma coluna!
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">Buscando profissionais...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/barbeiros`);
        if (!response.ok) throw new Error("Erro de conexão");
        
        const barbeiros = await response.json();
        tableBody.innerHTML = "";

        if (barbeiros.length === 0) {
            // colspan alterado para 4 aqui também
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">Nenhum profissional cadastrado.</td></tr>`;
            return;
        }

        barbeiros.forEach(barbeiro => {
            const tr = document.createElement("tr");
            const inicial = barbeiro.nome.charAt(0).toUpperCase();

            // Tabela desenhada sem o <td> da especialidade
            tr.innerHTML = `
                <td><div class="table-avatar">${inicial}</div></td>
                <td><strong>${barbeiro.nome}</strong></td>
                <td>${formatarTelefoneAdmin(barbeiro.telefone)}</td>
                <td>
                    <button class="btn-action" onclick="abrirModalBarbeiro(${barbeiro.id})" title="Editar">✏️</button>
                    <button class="btn-action cancel" title="Excluir">🗑️</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Falha ao renderizar barbeiros:", error);
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger);">Erro de conexão com o banco de dados.</td></tr>`;
    }
}

// ... as funções abrirModalBarbeiro e fecharModalBarbeiro continuam iguais ...

// Ouvinte do envio do formulário atualizado
const formBarbeiro = document.getElementById("form-barbeiro");
if (formBarbeiro) {
    formBarbeiro.addEventListener("submit", async (event) => {
        event.preventDefault();

        const id = document.getElementById("barbeiro-id").value;
        
        // Payload (pacote de dados) agora só leva nome e telefone
        const dadosBarbeiro = {
            nome: document.getElementById("barbeiro-nome").value,
            telefone: document.getElementById("barbeiro-telefone").value
        };

        try {
            let url = `${API_BASE_URL}/barbeiros`;
            let metodo = "POST";

            if (id) {
                url = `${API_BASE_URL}/barbeiros/${id}`;
                metodo = "PUT";
            }

            const response = await fetch(url, {
                method: metodo,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dadosBarbeiro) // Envia o pacote enxuto para o servidor
            });

            if (response.ok) {
                fecharModalBarbeiro();
                renderBarbeiros(); 
            } else {
                alert("Erro ao salvar o profissional.");
            }
        } catch (error) {
            console.error(error);
            alert("Erro de rede.");
        }
    });
}