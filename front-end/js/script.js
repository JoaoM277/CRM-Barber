// ==========================================================================
// 1. ESTADO GLOBAL DA APLICAÇÃO
// ==========================================================================
const agendamento = {
    servicos: [],      
    barbeiroId: null,  
    data: null,        
    hora: null,
    cliente: { nome: "", telefone: "", notas: "" }
};

let currentStep = 1;
let currentDateObj = new Date(); 

// ==========================================================================
// 2. VARIÁVEIS QUE RECEBERÃO OS DADOS DO BANCO
// ==========================================================================
// Trocamos 'const' por 'let' e iniciamos vazios. Eles serão preenchidos pela API.
let dbServicos = [];
let dbBarbeiros = [];
let dbHorariosDisponiveis = [];

// ==========================================================================
// 3. FUNÇÃO DE INTEGRAÇÃO COM A API (Substituindo os Mocks)
// ==========================================================================
async function carregarDadosIniciais() {
    try {
        // 1. Dispara todas as requisições
        const [resServicos, resBarbeiros, resHorarios] = await Promise.all([
            fetch('http://localhost:8000/api/servicos'), 
            fetch('http://localhost:8000/api/profissionais'), 
            fetch('http://localhost:8000/api/agendamentos')  
        ]);

        // 2. Converte para JSON
        const dataServicos = await resServicos.json();
        const dataBarbeiros = await resBarbeiros.json();
        const dataHorarios = await resHorarios.json();

        // 3. Extrai os dados
        const rawServicos = dataServicos.data ? dataServicos.data : dataServicos;
        const rawBarbeiros = dataBarbeiros.data ? dataBarbeiros.data : dataBarbeiros;
        const rawHorarios = dataHorarios.data ? dataHorarios.data : dataHorarios;

        // 🛑 OLHE PARA ESTES LOGS NO F12 PARA VER O NOME EXATO DAS COLUNAS
        console.log("🔍 DADOS DOS SERVIÇOS:", rawServicos);
        console.log("🔍 DADOS DOS HORÁRIOS:", rawHorarios);

        // ==========================================
        // 4. ARRUMANDO OS SERVIÇOS (Fim do NaN)
        // ==========================================
        dbServicos = rawServicos.map(item => {
            
            // Pega o valor do banco
            let tempoDoBanco = item.duration_time || item.duration || item.duracao || item.tempo || 30;
            
            // Tratamento 1: Se for formato de relógio ("00:30:00" ou "00:30")
            if (typeof tempoDoBanco === 'string' && tempoDoBanco.includes(':')) {
                const partes = tempoDoBanco.split(':');
                // Pega as horas (vezes 60) + os minutos
                tempoDoBanco = (parseInt(partes[0], 10) * 60) + parseInt(partes[1], 10);
            } 
            // Tratamento 2: Se vier com texto tipo "30 min", o parseInt pega só o número
            else {
                tempoDoBanco = parseInt(tempoDoBanco, 10);
            }

            // Tratamento 3: Se mesmo assim falhar e virar NaN, força para 30
            if (isNaN(tempoDoBanco) || tempoDoBanco <= 0) {
                tempoDoBanco = 30;
            }

            return {
                id: item.id,
                nome: item.name || item.nome || item.titulo || "Sem Nome", 
                preco: Number(item.price || item.preco || item.valor || 0), 
                duracao: tempoDoBanco // Agora sim, é um número garantido!
            };
        });

        // ==========================================
        // 5. ARRUMANDO OS BARBEIROS
        // ==========================================
        dbBarbeiros = rawBarbeiros.map(item => ({
            id: item.id,
            nome: item.name || item.nome || "Profissional",
            avatar: item.avatar || item.foto || "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&q=80", 
            cargo: item.role || item.cargo || "Barber"
        }));

        // ==========================================
        // 6. ARRUMANDO OS HORÁRIOS (Fim do [object Object])
        // ==========================================
        if (Array.isArray(rawHorarios)) {
            dbHorariosDisponiveis = rawHorarios.map(item => {
                // Se o horário vier como um objeto (o que estava causando o erro)
                if (typeof item === 'object' && item !== null) {
                    // Ele procura a string de texto. Se não achar, não retorna o objeto, retorna "Inválido"
                    return item.hora || item.horario || item.time || item.inicio || item.data_hora || "Inválido";
                }
                // Se já vier como texto ("08:00"), converte garantindo que é string
                return String(item); 
            });
            
            // Limpa qualquer coisa que não tenha encontrado no banco (Remove os "Inválido")
            dbHorariosDisponiveis = dbHorariosDisponiveis.filter(hora => hora !== "Inválido");
            
            // Se o array ficar vazio porque a coluna estava errada, coloca os horários padrão
            if (dbHorariosDisponiveis.length === 0) {
                 dbHorariosDisponiveis = ["08:00", "09:00", "10:00", "14:00", "15:00"];
            }
        } else {
            dbHorariosDisponiveis = ["08:00", "09:00", "10:00", "14:00", "15:00"];
        }

    } catch (error) {
        console.error("Erro ao carregar dados do banco:", error);
        alert("Houve um erro ao carregar os dados. Por favor, atualize a página.");
    }
}
// ==========================================================================
// 4. RENDERIZADORES DINÂMICOS
// ==========================================================================
function renderServicos() {
    const container = document.getElementById("services-container");
    container.innerHTML = "";
    container.className = "mobile-service-list";

    dbServicos.forEach(servico => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `service-row ${agendamento.servicos.includes(servico.id) ? 'selected' : ''}`;
        
        // Formata o número (ex: 50 vira "50,00")
        const precoFormatado = servico.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        
        btn.innerHTML = `
            <div class="service-details">
                <span class="service-title">${servico.nome}</span>
                <span class="service-time">${servico.duracao}min</span>
            </div>
            <span class="service-price">R$ ${precoFormatado}</span> 
        `;
        // ... (o resto da função continua igual)
        
        btn.addEventListener("click", () => {
            const index = agendamento.servicos.indexOf(servico.id);
            if (index > -1) agendamento.servicos.splice(index, 1);
            else agendamento.servicos.push(servico.id);
            renderServicos();
            validateStep();
        });
        
        container.appendChild(btn);
    });
}

function renderBarbeiros() {
    const container = document.getElementById("barbers-container");
    if (!container) return;
    
    container.innerHTML = "";
    container.className = "barbers-list"; 

    dbBarbeiros.forEach(barbeiro => {
        const card = document.createElement("article");
        
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

        card.addEventListener("click", () => {
            agendamento.barbeiroId = barbeiro.id;
            renderBarbeiros(); 
            validateStep();    
        });

        container.appendChild(card);
    });
}

function renderCalendario(date) {
    const container = document.getElementById("step-agenda");
    if (!container) return;

    container.innerHTML = `
        <div class="section-intro">
            <h2>Selecione o dia e horário</h2>
            <p>Escolha a melhor data para o seu atendimento</p>
        </div>
        
        <div class="calendar-wrapper">
            <div class="calendar-header">
                <button type="button" class="cal-btn" id="cal-prev">‹</button>
                <span class="current-month" id="calendar-month-year"></span>
                <button type="button" class="cal-btn" id="cal-next">›</button>
            </div>
            
            <div class="weekdays-grid">
                <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
            </div>
            
            <div class="days-grid" id="calendar-days"></div>
        </div>

        <div class="time-slots-wrapper">
            <div class="time-period">
                <h4>Horários Disponíveis</h4>
                <div class="slots-grid" id="slots-container"></div>
            </div>
        </div>
    `;

    const calendarDays = document.getElementById("calendar-days");
    const monthYearText = document.getElementById("calendar-month-year");

    const year = date.getFullYear();
    const month = date.getMonth();
    const meses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    monthYearText.textContent = `${meses[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        const emptySpan = document.createElement("span");
        emptySpan.className = "day empty";
        calendarDays.appendChild(emptySpan);
    }

    for (let day = 1; day <= lastDay; day++) {
        const dayBtn = document.createElement("button");
        dayBtn.type = "button";
        dayBtn.className = "day";
        dayBtn.textContent = day;

        const loopDate = new Date(year, month, day);
        const today = new Date();
        today.setHours(0,0,0,0);

        if (loopDate < today) {
            dayBtn.classList.add("disabled");
        }
        
        if (agendamento.data && agendamento.data.toDateString() === loopDate.toDateString()) {
            dayBtn.classList.add("selected");
        }

        dayBtn.addEventListener("click", () => {
            if (loopDate < today) return; 
            agendamento.data = loopDate;
            agendamento.hora = null; 
            
            // DICA: Em um sistema real, você chamaria um fetch('/api/horarios-disponiveis') 
            // enviando `loopDate` e `agendamento.barbeiroId` aqui, e então atualizaria `dbHorariosDisponiveis`.
            
            renderCalendario(date);
            validateStep();
        });

        calendarDays.appendChild(dayBtn);
    }

    document.getElementById("cal-prev").addEventListener("click", () => {
        currentDateObj.setMonth(currentDateObj.getMonth() - 1);
        renderCalendario(currentDateObj);
    });
    
    document.getElementById("cal-next").addEventListener("click", () => {
        currentDateObj.setMonth(currentDateObj.getMonth() + 1);
        renderCalendario(currentDateObj);
    });

    renderHorarios();
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
        btn.type = "button";
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
// 5. PROCESSAMENTO DO RESUMO FINAL
// ==========================================================================
function renderResumo() {
    const servicosEscolhidos = dbServicos.filter(s => agendamento.servicos.includes(s.id));
    
    const listContainer = document.getElementById("summary-services-list");
    
    // 1. Formata o preço de cada item individual na lista
    listContainer.innerHTML = servicosEscolhidos.map(s => {
        const precoItem = s.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        return `<li><span>${s.nome}</span><span>R$ ${precoItem}</span></li>`;
    }).join("");

    // 2. Agora a matemática funciona porque são números reais!
    const precoTotal = servicosEscolhidos.reduce((acc, current) => acc + current.preco, 0);
    const tempoTotal = servicosEscolhidos.reduce((acc, current) => acc + current.duracao, 0);

    // 3. Formata o total final
    const totalFormatado = precoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    document.getElementById("summary-total-price").textContent = `R$ ${totalFormatado}`;
    document.getElementById("summary-total-duration").textContent = `${tempoTotal} min`;

    const barbeiro = dbBarbeiros.find(b => b.id === agendamento.barbeiroId);
    document.getElementById("summary-barber-name").textContent = barbeiro ? barbeiro.nome : "Não selecionado";

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
        const form = document.getElementById("client-form");
        isValid = form.checkValidity(); 
    }

    btnNext.disabled = !isValid;
}

// ==========================================================================
// 7. AVISO E MODAL DA BARBEARIA
// ==========================================================================
async function verificarAvisoBarbearia() {
    try {
        const response = await fetch('/api/avisos/ativo'); 
        const data = await response.json();

        if (data.exibir) {
            const avisoId = data.dados.id;
            const avisoJaVisto = localStorage.getItem(`aviso_barbearia_${avisoId}`);

            if (!avisoJaVisto) {
                mostrarModalNaTela(data.dados.titulo, data.dados.mensagem, avisoId);
            }
        }
    } catch (error) {
        console.error('Erro ao buscar avisos da barbearia:', error);
    }
}

function mostrarModalNaTela(titulo, mensagem, id) {
    const overlay = document.getElementById('modal-overlay');
    const tituloElement = document.getElementById('modal-titulo');
    const mensagemElement = document.getElementById('modal-mensagem');
    const btnFechar = document.getElementById('btn-fechar-modal');

    tituloElement.textContent = titulo;
    mensagemElement.textContent = mensagem;

    overlay.classList.remove('modal-escondido');

    btnFechar.addEventListener('click', () => {
        overlay.classList.add('modal-escondido');
        localStorage.setItem(`aviso_barbearia_${id}`, 'true');
    });
}

// ==========================================================================
// 8. ESCUTADORES DO FORMULÁRIO FINAL E BOTOES
// ==========================================================================
document.getElementById("client-form").addEventListener("input", (e) => {
    if (e.target.id === "client-phone") {
        let valor = e.target.value.replace(/\D/g, "");
        if (valor.length > 11) valor = valor.slice(0, 11);

        if (valor.length > 0) valor = "(" + valor;
        if (valor.length > 3) valor = valor.slice(0, 3) + ") " + valor.slice(3);
        if (valor.length > 10) valor = valor.slice(0, 10) + "-" + valor.slice(10);
        
        e.target.value = valor;
    }
    validateStep();
});

document.getElementById("btn-next").addEventListener("click", async () => {
    if (currentStep < 4) {
        currentStep++;
        updateFlowUI();
    } else {
        agendamento.cliente.nome = document.getElementById("client-name").value;
        agendamento.cliente.telefone = document.getElementById("client-phone").value;
        agendamento.cliente.notas = document.getElementById("client-notes").value;

        const payloadParaOExpress = {
            barbeiroId: agendamento.barbeiroId,
            servicosIds: agendamento.servicos, 
            dataAgendamento: agendamento.data.toISOString().split('T')[0], 
            horario: agendamento.hora,
            clienteNome: agendamento.cliente.nome,
            clienteTelefone: agendamento.cliente.telefone,
            observacoes: agendamento.cliente.notas 
        };

        // Aqui você faria um fetch('sua-url/agendamentos', { method: 'POST', body: JSON.stringify(payloadParaOExpress) })
        console.log("🚀 Payload estruturado pronto para a API:", payloadParaOExpress);
        alert(`Perfeito, ${payloadParaOExpress.clienteNome}!\nAgendamento salvo. Consulte o console para ver o payload.`);
    }
});

document.getElementById("btn-prev").addEventListener("click", () => {
    if (currentStep > 1) {
        currentStep--;
        updateFlowUI();
    }
});

// ==========================================================================
// 9. INICIALIZAÇÃO DA PÁGINA (Unificado e Assíncrono)
// ==========================================================================
window.addEventListener("DOMContentLoaded", async () => {
    // 1. Primeiro carregamos todos os dados do banco
    await carregarDadosIniciais();
    
    // 2. Depois renderizamos a tela com os dados preenchidos
    renderBarbeiros();
    renderServicos();
    renderCalendario(currentDateObj);
    renderHorarios();
    updateFlowUI();

    // 3. Verificamos se há algum aviso ativo
    verificarAvisoBarbearia();
});