// ==========================================================================
// 1. ESTADO GLOBAL DA APLICAÇÃO (Pronto para o Sequelize)
// ==========================================================================
const agendamento = {
    servicos: [],      
    barbeiroId: null,  
    data: null,        
    hora: null,
    cliente: { nome: "", telefone: "", notas: "" }
};

let currentStep = 1;
let currentDateObj = new Date(2026, 6, 14); // 14 de Julho de 2026

// ==========================================================================
// 2. SIMULAÇÃO DE DADOS DO BANCO
// ==========================================================================
const dbServicos = [
    { id: 1, nome: "Corte", preco: 50, duracao: 30, icon: "✂" },
    { id: 2, nome: "Barba", preco: 35, duracao: 20, icon: "🧔" },
    { id: 3, nome: "Alisante", preco: 60, duracao: 40, icon: "🧪" },
    { id: 4, nome: "Hidratação", preco: 30, duracao: 20, icon: "✨" },
    { id: 5, nome: "Pezinho", preco: 15, duracao: 10, icon: "📐" },
    { id: 6, nome: "Tinta", preco: 45, duracao: 30, icon: "🎨" },
    { id: 7, nome: "Botox", preco: 70, duracao: 40, icon: "🔥" },
    { id: 8, nome: "Cera Nasal", preco: 20, duracao: 15, icon: "👃" },
    { id: 9, nome: "Selagem", preco: 80, duracao: 50, icon: "🔒" },
    { id: 10, nome: "Penteado", preco: 25, duracao: 15, icon: "💈" }
];

const dbBarbeiros = [
    { id: 101, nome: "Rafael Mendes" },
    { id: 102, nome: "Diego Costa" },
    { id: 103, nome: "Lucas Ferreira" }
];

const dbHorariosDisponiveis = ["08:00","09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

// ==========================================================================
// 3. RENDERIZADORES DINÂMICOS
// ==========================================================================

function renderServicos() {
    const container = document.getElementById("services-container");
    container.innerHTML = "";
    dbServicos.forEach(servico => {
        const card = document.createElement("article");
        card.className = `service-card ${agendamento.servicos.includes(servico.id) ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="service-icon">${servico.icon}</div>
            <h3>${servico.nome}</h3>
            <div class="service-info">
                <span class="price">R$ ${servico.preco}</span>
                <span class="duration">⏱ ${servico.duracao}min</span>
            </div>
        `;
        card.addEventListener("click", () => {
            const index = agendamento.servicos.indexOf(servico.id);
            if (index > -1) agendamento.servicos.splice(index, 1);
            else agendamento.servicos.push(servico.id);
            renderServicos();
            validateStep();
        });
        container.appendChild(card);
    });
}

function renderBarbeiros() {
    const container = document.getElementById("barbers-container");
    if (!container) return;
    
    container.innerHTML = "";
    container.className = "barbers-list"; 

    dbBarbeiros.forEach(barbeiro => {
        const card = document.createElement("article");
        
        // CORREÇÃO AQUI: Verifica se este barbeiro é o selecionado no estado global
        // Se for, adiciona a classe 'selected' que ativa o CSS dourado do seu arquivo
        if (agendamento.barbeiroId === barbeiro.id) {
            card.className = "barber-card selected";
        } else {
            card.className = "barber-card";
        }
        
        const tagsHTML = barbeiro.tags ? barbeiro.tags.map(tag => `<span class="barber-tag">${tag}</span>`).join("") : "";

        card.innerHTML = `
            <div class="barber-profile">
                <div class="barber-avatar">
                    <img src="${barbeiro.avatar}" alt="${barbeiro.nome}" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div class="barber-details">
                    <h3>${barbeiro.nome}</h3>
                    <span class="barber-role" style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">${barbeiro.cargo || 'BARBER'}</span>
                    <div class="barber-tags-box" style="display: flex; gap: 6px; margin-top: 6px;">${tagsHTML}</div>
                </div>
            </div>
           
        `;

        // Evento de clique para selecionar o barbeiro e remontar a lista atualizada
        card.addEventListener("click", () => {
            agendamento.barbeiroId = barbeiro.id;
            renderBarbeiros(); // Redesenha a lista para aplicar a classe 'selected' no elemento clicado
            validateStep();    // Libera o botão "Continuar"
        });

        container.appendChild(card);
    });
}

function renderCalendario(date) {
    const calendarDays = document.getElementById("calendar-days");
    const monthYearText = document.getElementById("calendar-month-year");
    calendarDays.innerHTML = "";
    const year = date.getFullYear();
    const month = date.getMonth();
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthYearText.textContent = `${meses[month]} de ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        const emptySpan = document.createElement("span");
        emptySpan.className = "day empty";
        calendarDays.appendChild(emptySpan);
    }

    for (let day = 1; day <= lastDay; day++) {
        const dayBtn = document.createElement("button");
        dayBtn.className = "day";
        dayBtn.textContent = day;
        const loopDate = new Date(year, month, day);
        const today = new Date(2026, 6, 14);

        if (loopDate < today.setHours(0,0,0,0)) dayBtn.classList.add("disabled");
        if (agendamento.data && agendamento.data.toDateString() === loopDate.toDateString()) dayBtn.classList.add("selected");

        dayBtn.addEventListener("click", () => {
            agendamento.data = loopDate;
            agendamento.hora = null;
            renderCalendario(date);
            renderHorarios();
            validateStep();
        });
        calendarDays.appendChild(dayBtn);
    }
}

function renderHorarios() {
    const container = document.getElementById("slots-container");
    container.innerHTML = "";
    if (!agendamento.data) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size:14px; grid-column:1/-1; text-align:center;">Selecione um dia primeiro</p>`;
        return;
    }
    dbHorariosDisponiveis.forEach(hora => {
        const btn = document.createElement("button");
        btn.className = `slot-btn ${agendamento.hora === hora ? 'selected' : ''}`;
        btn.textContent = hora;
        btn.addEventListener("click", () => {
            agendamento.hora = hora;
            renderHorarios();
            validateStep();
        });
        container.appendChild(btn);
    });
}

// ==========================================================================
// 5. PROCESSAMENTO DO RESUMO FINAL (CÁLCULO DOS DADOS DO BANCO)
// ==========================================================================
function renderResumo() {
    // 1. Filtrar objetos completos dos serviços selecionados
    const servicosEscolhidos = dbServicos.filter(s => agendamento.servicos.includes(s.id));
    
    // 2. Injetar a lista na tela
    const listContainer = document.getElementById("summary-services-list");
    listContainer.innerHTML = servicosEscolhidos.map(s => `<li><span>${s.icon} ${s.nome}</span><span>R$ ${s.preco}</span></li>`).join("");

    // 3. Somar preço total e tempo total
    const precoTotal = servicosEscolhidos.reduce((acc, current) => acc + current.preco, 0);
    const tempoTotal = servicosEscolhidos.reduce((acc, current) => acc + current.duracao, 0);

    document.getElementById("summary-total-price").textContent = `R$ ${precoTotal}`;
    document.getElementById("summary-total-duration").textContent = `${tempoTotal} min`;

    // 4. Buscar nome do Barbeiro
    const barbeiro = dbBarbeiros.find(b => b.id === agendamento.barbeiroId);
    document.getElementById("summary-barber-name").textContent = barbeiro ? barbeiro.nome : "Não selecionado";

    // 5. Formatar Data e Hora
    if (agendamento.data && agendamento.hora) {
        document.getElementById("summary-date-time").textContent = `${agendamento.data.toLocaleDateString('pt-BR')} às ${agendamento.hora}`;
    } else {
        document.getElementById("summary-date-time").textContent = "Não selecionado";
    }
}

// ==========================================================================
// 6. MÁQUINA DE ESTADO E FLUXO DE TELAS
// ==========================================================================
function updateFlowUI() {
    document.querySelectorAll(".booking-section").forEach(sec => sec.classList.add("hidden"));
    document.querySelectorAll(".step").forEach(step => step.classList.remove("active"));

    if (currentStep === 1) {
        document.getElementById("step-servicos").classList.remove("hidden");
        document.getElementById("nav-step-1").classList.add("active");
        document.getElementById("btn-prev").classList.add("hidden");
        document.getElementById("btn-next").textContent = "Continuar";
    } else if (currentStep === 2) {
        document.getElementById("step-barbeiros").classList.remove("hidden");
        document.getElementById("nav-step-2").classList.add("active");
        document.getElementById("btn-prev").classList.remove("hidden");
        document.getElementById("btn-next").textContent = "Continuar";
    } else if (currentStep === 3) {
        document.getElementById("step-agenda").classList.remove("hidden");
        document.getElementById("nav-step-3").classList.add("active");
        document.getElementById("btn-prev").classList.remove("hidden");
        document.getElementById("btn-next").textContent = "Continuar";
    } else if (currentStep === 4) {
        renderResumo();
        document.getElementById("step-confirmacao").classList.remove("hidden");
        document.getElementById("nav-step-4").classList.add("active");
        document.getElementById("btn-prev").classList.remove("hidden");
        document.getElementById("btn-next").textContent = "Finalizar Agendamento";
    }

    validateStep();
}

function validateStep() {
    const btnNext = document.getElementById("btn-next");
    let isValid = false;

    if (currentStep === 1 && agendamento.servicos.length > 0) isValid = true;
    if (currentStep === 2 && agendamento.barbeiroId !== null) isValid = true;
    if (currentStep === 3 && agendamento.data !== null && agendamento.hora !== null) isValid = true;
    if (currentStep === 4) {
        // Valida se o formulário HTML está preenchido corretamente
        const form = document.getElementById("client-form");
        isValid = form.checkValidity(); 
    }

    btnNext.disabled = !isValid;
}

// Escutar preenchimento do form para liberar o botão de Finalizar
document.getElementById("client-form").addEventListener("input", validateStep);

document.getElementById("btn-next").addEventListener("click", () => {
    if (currentStep < 4) {
        currentStep++;
        updateFlowUI();
    } else {
        // 1. Captura os dados do formulário final
        agendamento.cliente.nome = document.getElementById("client-name").value;
        agendamento.cliente.telefone = document.getElementById("client-phone").value;
        agendamento.cliente.notas = document.getElementById("client-notes").value;

        // 2. Formata a estrutura exata (Payload) que o Sequelize vai receber no Back-End
        const payloadParaOExpress = {
            barbeiroId: agendamento.barbeiroId,
            servicosIds: agendamento.servicos, // Envia o array de IDs ex: [1, 4]
            dataAgendamento: agendamento.data.toISOString().split('T')[0], // Converte de Objeto Date para "YYYY-MM-DD"
            horario: agendamento.hora,
            clienteNome: agendamento.cliente.nome,
            clienteTelefone: agendamento.cliente.telefone,
            observacoes: agendamento.cliente.notes
        };

        console.log("🚀 Payload estruturado pronto para a API:", payloadParaOExpress);

        /* ==========================================================================
        CONEXÃO REAL COM O BACK-END (Descomente quando criarmos as rotas no Express)
        ==========================================================================
        fetch("http://localhost:3000/api/agendamentos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payloadParaOExpress)
        })
        .then(response => response.json())
        .then(dados => {
            alert("Agendamento gravado com sucesso no banco de dados!");
        })
        .catch(erro => console.error("Erro ao salvar no banco:", erro));
        */

        // Alerta visual temporário para você testar no navegador
        alert(`Perfeito, ${payloadParaOExpress.clienteNome}!\nAgendamento simulado. Abra o Console (F12) para ver o JSON estruturado para o Sequelize.`);
    }
});

document.getElementById("btn-prev").addEventListener("click", () => {
    if (currentStep > 1) {
        currentStep--;
        updateFlowUI();
    }
});

window.addEventListener("DOMContentLoaded", () => {
    // Mantemos a ordem correta de inicialização
    renderBarbeiros();
    renderServicos();
    renderCalendario(currentDateObj);
    renderHorarios();
    updateFlowUI();
});