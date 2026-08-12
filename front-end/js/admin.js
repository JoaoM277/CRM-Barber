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

        const response = await fetch(url, {
            headers: { "Accept": "application/json" } // Garante retorno em JSON do Laravel
        });
        
        if (!response.ok) throw new Error("Erro de rede");
        const jsonBody = await response.json();
        const agendamentos = jsonBody.data ? jsonBody.data : jsonBody;
        
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

            // Se o Laravel devolver os dados em inglês (client_name, client_phone, etc), 
            // precisaremos ajustar essas chaves depois.
            const nomeCli = agendamento.cliente_nome || agendamento.client_name || '';
            const telCli = agendamento.cliente_telefone || agendamento.client_phone || '';
            const dataAg = agendamento.data || agendamento.date || '';
            const horaAg = agendamento.horario || agendamento.time || '';

            tr.innerHTML = `
                <td>
                    <strong>${nomeCli}</strong><br>
                    <span class="text-small">${formatarTelefoneAdmin(telCli)}</span>
                </td>
                <td>${agendamento.Servico ? agendamento.Servico.nome : 'N/A'}</td>
                <td>${agendamento.Barbeiro ? agendamento.Barbeiro.nome : 'N/A'}</td>
                <td>${dataAg.split('-').reverse().join('/')} às ${horaAg}</td>
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

window.alterarStatus = async function(id, novoStatus) {
    const executarAlteracao = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/agendamentos/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ status: novoStatus })
            });
            if (res.ok) {
                mostrarToastAdmin(novoStatus === 'confirmado' ? "Horário confirmado!" : "Agendamento cancelado com sucesso!");
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
        executarAlteracao(); 
    }
};

// --------------------------------------------------------------------------
// 4. MÓDULO: SERVIÇOS
// --------------------------------------------------------------------------
async function renderServicos() {
    const tableBody = document.getElementById("servicos-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Buscando serviços...</td></tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/servicos`, {
            headers: { "Accept": "application/json" }
        });
        if (!response.ok) throw new Error("Erro");
        const jsonBody = await response.json();
        
        // Pega a lista dentro de "data" se vier do Laravel
        const servicos = jsonBody.data ? jsonBody.data : jsonBody;
        
        tableBody.innerHTML = "";
        if (servicos.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Sem serviços.</td></tr>`;
            return;
        }

        servicos.forEach(servico => {
            const tr = document.createElement("tr");
            
            // Aceitando chaves em português ou inglês
            const nomeSvc = servico.nome || servico.name || '';
            const precoSvc = servico.preco || servico.price || 0;
            const duracaoSvc = servico.duracao || servico.duration || 0;

            const precoFormatado = Number(precoSvc).toFixed(2).replace('.', ',');

            tr.innerHTML = `
                <td><strong>${nomeSvc}</strong></td>
                <td style="color: var(--brand-primary); font-weight: 600;">R$ ${precoFormatado}</td>
                <td>${duracaoSvc} min</td>
                <td>
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

window.deletarServico = function(id) {
    abrirModalConfirmacao("Excluir Serviço", "Tem certeza que deseja apagar este serviço definitivamente?", "Excluir Serviço", "danger", async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/servicos/${id}`, { 
                method: 'DELETE',
                headers: { "Accept": "application/json" } 
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
        
        let precoString = document.getElementById("servico-preco").value;
        let precoFloat = parseFloat(precoString.replace(/\./g, '').replace(',', '.'));

        // ATUALIZADO: Payload usando chaves em INGLÊS para bater com o Laravel
        const payload = {
            icon: null, 
            name: document.getElementById("servico-nome").value,
            price: precoFloat,
            duration: parseInt(document.getElementById("servico-duracao").value)
        };

        const url = id ? `${API_BASE_URL}/servicos/${id}` : `${API_BASE_URL}/servicos`;
        const method = id ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method, 
                headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json" // <-- EVITA REDIRECIONAMENTO DE ERRO
                }, 
                body: JSON.stringify(payload)
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
            headers: { "Accept": "application/json" }
        });
        if (!response.ok) throw new Error("Erro");
        
        const jsonBody = await response.json();
        const listaBarbeiros = jsonBody.data ? jsonBody.data : jsonBody;

        tableBody.innerHTML = "";
        if (listaBarbeiros.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum cadastrado.</td></tr>`;
            return;
        }

        listaBarbeiros.forEach(barbeiro => {
            const tr = document.createElement("tr");
            
            const nomeBarb = barbeiro.nome || barbeiro.name || '';
            const telBarb = barbeiro.telefone || barbeiro.phone || '';
            const inicial = nomeBarb ? nomeBarb.charAt(0).toUpperCase() : "?";
            
            tr.innerHTML = `
                <td><div class="table-avatar">${inicial}</div></td>
                <td><strong>${nomeBarb}</strong></td>
                <td>${formatarTelefoneAdmin(telBarb)}</td>
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

window.deletarBarbeiro = function(id) {
    abrirModalConfirmacao("Excluir Profissional", "Tem certeza que deseja apagar este profissional do sistema?", "Excluir Profissional", "danger", async () => {
        try {
            // CORRIGIDO PARA /profissionais
            const response = await fetch(`${API_BASE_URL}/profissionais/${id}`, { 
                method: 'DELETE',
                headers: { "Accept": "application/json" } 
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
        
        // Captura direta e limpa dos campos do formulário
        const nomeInput = document.getElementById("barbeiro-nome").value;
        const telefoneInput = document.getElementById("barbeiro-telefone").value.replace(/\D/g, ""); // Remove parênteses e traços, deixando apenas os números

        const payload = {
            name: nomeInput,
            phone: telefoneInput, 
            speciality: "Geral", 
            photo: null,      
            active: true      
        };

        const url = id ? `${API_BASE_URL}/profissionais/${id}` : `${API_BASE_URL}/profissionais`;
        const method = id ? "PUT" : "POST";

        try {
            const res = await fetch(url, {
                method, 
                headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }, 
                body: JSON.stringify(payload)
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
            headers: { "Accept": "application/json" }
        });
        if (!response.ok) throw new Error(`Erro na resposta do servidor`);
        
        const jsonBody = await response.json();
        const faturamento = jsonBody.data ? jsonBody.data : jsonBody;

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
        const response = await fetch(`${API_BASE_URL}/avisos/1`, {
            headers: { "Accept": "application/json" }
        }); 
        
        if (response.ok) {
            const jsonBody = await response.json();
            const aviso = jsonBody.data ? jsonBody.data : jsonBody;

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
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
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

    await Promise.all([
        renderAgenda(),
        renderServicos(),
        renderBarbeiros(),
        renderDashboard(),
        renderAviso()
    ]);

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