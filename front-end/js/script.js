// ==========================================================================
// 1. ESTADO GLOBAL DA APLICAÇÃO (O que será enviado para o Banco no final)
// ==========================================================================
const agendamento = {
    servicos: [],      // Array de IDs de serviços selecionados
    barbeiroId: null,  // ID do barbeiro escolhido
    data: null,        // Objeto Date selecionado
    hora: null         // String da hora escolhida (ex: "14:00")
};

// Controle de Telas (Passos)
let currentStep = 1;

// Mês de referência para o Calendário (Julho de 2026)
let currentDateObj = new Date(2026, 6, 14); // 14 de Julho de 2026 (Mês é indexado em 0)

// ==========================================================================
// 2. SIMULAÇÃO DE DADOS DO BANCO (Substituir por fetch() quando ligar o Back-End)
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

// O banco vai retornar horários indisponíveis dependendo do dia e barbeiro
const dbHorariosDisponiveis = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

// ==========================================================================
// 3. RENDERIZADORES DINÂMICOS (Injetam os dados no HTML)
// ==========================================================================

// Renderiza a lista de Serviços
function renderServicos() {
    const container = document.getElementById("services-container");
    container.innerHTML = ""; // Limpa lixo antigo

    dbServicos.forEach(servico => {
        const card = document.createElement("article");
        card.className = `service-card ${agendamento.servicos.includes(servico.id) ? 'selected' : ''}`;
        card.setAttribute("data-id", servico.id);
        card.innerHTML = `
            <div class="service-icon">${servico.icon}</div>
            <h3>${servico.nome}</h3>
            <div class="service-info">
                <span class="price">R$ ${servico.preco}</span>
                <span class="duration">⏱ ${servico.duracao}min</span>
            </div>
        `;

        // Evento de Seleção Múltipla
        card.addEventListener("click", () => {
            const index = agendamento.servicos.indexOf(servico.id);
            if (index > -1) {
                agendamento.servicos.splice(index, 1); // Desmarca se já estava ativo
            } else {
                agendamento.servicos.push(servico.id); // Marca
            }
            renderServicos(); // Redesenha com o estado atualizado
            validateStep();
        });

        container.appendChild(card);
    });
}

// Renderiza os Barbeiros
function renderBarbeiros() {
    const container = document.getElementById("barbers-container");
    container.innerHTML = "";

    dbBarbeiros.forEach(barbeiro => {
        const card = document.createElement("article");
        card.className = `barber-card ${agendamento.barbeiroId === barbeiro.id ? 'selected' : ''}`;
        card.setAttribute("data-id", barbeiro.id);
        card.innerHTML = `
            <div class="barber-profile">
                <div class="barber-avatar">
                    <span class="avatar-placeholder">👤</span>
                </div>
                <div class="barber-details">
                    <h3>${barbeiro.nome}</h3>
                </div>
            </div>
        `;

        card.addEventListener("click", () => {
            agendamento.barbeiroId = barbeiro.id;
            renderBarbeiros();
            validateStep();
        });

        container.appendChild(card);
    });
}

// Renderiza o Calendário Dinâmico
function renderCalendario(date) {
    const calendarDays = document.getElementById("calendar-days");
    const monthYearText = document.getElementById("calendar-month-year");
    calendarDays.innerHTML = "";

    const year = date.getFullYear();
    const month = date.getMonth();

    // Nome do Mês
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    monthYearText.textContent = `${meses[month]} de ${year}`;

    // Primeiro dia da semana do mês atual (ex: 0 = Dom, 3 = Qua)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Último dia do mês atual (ex: 31)
    const lastDay = new Date(year, month + 1, 0).getDate();

    // 1. Adiciona dias vazios para alinhar a grade de acordo com o dia da semana
    for (let i = 0; i < firstDayIndex; i++) {
        const emptySpan = document.createElement("span");
        emptySpan.className = "day empty";
        calendarDays.appendChild(emptySpan);
    }

    // 2. Preenche os dias reais do mês
    for (let day = 1; day <= lastDay; day++) {
        const dayBtn = document.createElement("button");
        dayBtn.className = "day";
        dayBtn.textContent = day;

        const loopDate = new Date(year, month, day);
        const today = new Date(2026, 6, 14); // 14 de Julho de 2026

        // Desabilita dias que já passaram de 14/07/2026
        if (loopDate < today.setHours(0,0,0,0)) {
            dayBtn.classList.add("disabled");
        }

        // Destaca o dia selecionado pelo cliente
        if (agendamento.data && agendamento.data.toDateString() === loopDate.toDateString()) {
            dayBtn.classList.add("selected");
        }

        dayBtn.addEventListener("click", () => {
            agendamento.data = loopDate;
            agendamento.hora = null; // Reseta o horário ao trocar o dia
            renderCalendario(date);
            renderHorarios();
            validateStep();
        });

        calendarDays.appendChild(dayBtn);
    }
}

// Renderiza os Horários Disponíveis
function renderHorarios() {
    const container = document.getElementById("slots-container");
    container.innerHTML = "";

    if (!agendamento.data) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size:14px; grid-column: 1/-1; text-align:center;">Selecione um dia no calendário primeiro</p>`;
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
// 4. MÁQUINA DE ESTADO DO FLUXO (Controla os passos)
// ==========================================================================

function updateFlowUI() {
    // Esconde todas as seções
    document.querySelectorAll(".booking-section").forEach(sec => sec.classList.add("hidden"));
    // Tira o active de toda a navbar
    document.querySelectorAll(".step").forEach(step => step.classList.remove("active"));

    // Mostra a seção correta e acende o passo correspondente
    if (currentStep === 1) {
        document.getElementById("step-servicos").classList.remove("hidden");
        document.getElementById("nav-step-1").classList.add("active");
        document.getElementById("btn-prev").classList.add("hidden");
    } else if (currentStep === 2) {
        document.getElementById("step-barbeiros").classList.remove("hidden");
        document.getElementById("nav-step-2").classList.add("active");
        document.getElementById("btn-prev").classList.remove("hidden");
    } else if (currentStep === 3) {
        document.getElementById("step-agenda").classList.remove("hidden");
        document.getElementById("nav-step-3").classList.add("active");
        document.getElementById("btn-prev").classList.remove("hidden");
    }

    validateStep();
}

function validateStep() {
    const btnNext = document.getElementById("btn-next");
    let isValid = false;

    if (currentStep === 1 && agendamento.servicos.length > 0) isValid = true;
    if (currentStep === 2 && agendamento.barbeiroId !== null) isValid = true;
    if (currentStep === 3 && agendamento.data !== null && agendamento.hora !== null) isValid = true;

    btnNext.disabled = !isValid;
}

// Ouvintes de eventos nos botões Continuar / Voltar
document.getElementById("btn-next").addEventListener("click", () => {
    if (currentStep < 3) {
        currentStep++;
        updateFlowUI();
    } else {
        // Envio real para o Back-End / Sequelize acontecerá aqui!
        console.log("DADOS FINAIS ENVIADOS AO BANCO DE DADOS:", agendamento);
        alert(`Sucesso! Agendamento enviado:\nServiços: ${agendamento.servicos.join(", ")}\nBarbeiro ID: ${agendamento.barbeiroId}\nData: ${agendamento.data.toLocaleDateString()}\nHora: ${agendamento.hora}`);
    }
});

document.getElementById("btn-prev").addEventListener("click", () => {
    if (currentStep > 1) {
        currentStep--;
        updateFlowUI();
    }
});

// Inicialização Geral do Sistema
window.addEventListener("DOMContentLoaded", () => {
    renderServicos();
    renderBarbeiros();
    renderCalendario(currentDateObj);
    renderHorarios();
    updateFlowUI();
});