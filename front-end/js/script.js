// ==========================================================================
// 1. ESTADO GLOBAL DA APLICAÇÃO
// ==========================================================================
const agendamento = {
    servicos: [],
    barbeiroId: null,
    semPreferencia: false,
    data: null,
    hora: null,
    cliente: { nome: "", telefone: "", notas: "" }
};

const API_BASE_URL = window.API_BASE_URL || "http://localhost:8000/api";
const BARBERSHOP_SLUG = window.BARBERSHOP_SLUG || "alpha-barber";

// Rotas públicas são escopadas por barbearia: /api/b/{slug}/...
const apiPublic = (path) =>
    `${API_BASE_URL}/b/${encodeURIComponent(BARBERSHOP_SLUG)}${path.startsWith("/") ? path : "/" + path}`;

let currentStep = 1;
let currentDateObj = new Date(); 

// ==========================================================================
// 2. VARIÁVEIS QUE RECEBERÃO OS DADOS DO BANCO
// ==========================================================================
// Trocamos 'const' por 'let' e iniciamos vazios. Eles serão preenchidos pela API.
let dbServicos = [];
let dbBarbeiros = [];
let dbHorariosDisponiveis = [];
let dbOcupados = [];
let dbExpediente = [];

const hmToMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + (m || 0); };
const minToHm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ==========================================================================
// 3. FUNÇÃO DE INTEGRAÇÃO COM A API (Substituindo os Mocks)
// ==========================================================================
async function carregarDadosIniciais() {
    try {
        // 1. Dispara todas as requisições
        const [resServicos, resBarbeiros, resHorarios] = await Promise.all([
            fetch(apiPublic("/servicos")),
            fetch(apiPublic("/profissionais")),
            fetch(apiPublic("/disponibilidade"))
        ]);

        // 2. Converte para JSON
        const dataServicos = await resServicos.json();
        const dataBarbeiros = await resBarbeiros.json();
        const dataHorarios = await resHorarios.json();

        // 3. Extrai os dados
        const rawServicos = dataServicos.data ? dataServicos.data : dataServicos;
        const rawBarbeiros = dataBarbeiros.data ? dataBarbeiros.data : dataBarbeiros;
        const rawHorarios = dataHorarios.data ? dataHorarios.data : dataHorarios;
        dbOcupados = Array.isArray(rawHorarios) ? rawHorarios : [];
        dbExpediente = Array.isArray(dataHorarios.expediente) ? dataHorarios.expediente : [];

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
            foto: item.photo || item.foto || item.avatar || null,
            especialidade: item.speciality || item.especialidade || item.cargo || "",
            ativo: item.active !== false && item.active !== 0
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
const SVC_ICON = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;
const SVC_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function renderServicos() {
    const track = document.getElementById("services-container");
    if (!track) return;
    track.innerHTML = "";

    if (!dbServicos.length) {
        track.innerHTML = `<p class="svc-empty">Nenhum serviço disponível no momento.</p>`;
        return;
    }

    dbServicos.forEach((servico, i) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = `svc-card${agendamento.servicos.includes(servico.id) ? " selected" : ""}`;
        card.style.setProperty("--i", i);
        card.dataset.id = servico.id;

        const preco = Number(servico.preco || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        const num = String(i + 1).padStart(2, "0");

        card.innerHTML = `
            <span class="svc-card__in">
                <div class="svc-top">
                    <span class="svc-num">( ${num} )</span>
                    <span class="svc-check">${SVC_CHECK}</span>
                </div>
                <span class="svc-icon">${SVC_ICON}</span>
                <div class="svc-bottom">
                    <div class="svc-name">${servico.nome}</div>
                    <div class="svc-meta">
                        <span>${servico.duracao || "—"} min</span>
                        <span class="svc-price">R$ ${preco}</span>
                    </div>
                </div>
            </span>
        `;

        card.addEventListener("click", () => {
            const idx = agendamento.servicos.indexOf(servico.id);
            if (idx > -1) agendamento.servicos.splice(idx, 1);
            else agendamento.servicos.push(servico.id);
            card.classList.toggle("selected");
            validateStep();
        });

        track.appendChild(card);
    });

    initServiceCarousel();
}

const _reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Efeito "coverflow" leve: cards mais longe da âncora do track ficam
   levemente menores e o ícone faz um parallax. Só mexe em CSS vars
   (--k, --px), então não briga com a animação de entrada. */
function atualizarTransformCards() {
    if (_reduzirMovimento) return;
    const track = document.getElementById("services-container");
    if (!track) return;
    const tRect = track.getBoundingClientRect();
    if (!tRect.width) return;
    const padL = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const ancora = tRect.left + padL;

    track.querySelectorAll(".svc-card").forEach((card) => {
        const cRect = card.getBoundingClientRect();
        const d = Math.max(0, Math.min(2.4, (cRect.left - ancora) / tRect.width));
        const escala = Math.max(0.9, 1 - d * 0.05).toFixed(3);
        const px = (d * -18).toFixed(1);
        card.style.setProperty("--k", escala);
        card.style.setProperty("--px", px + "px");
    });
}

let _rafCarrossel = null;
function agendarAtualizacaoCards() {
    if (_rafCarrossel) return;
    _rafCarrossel = requestAnimationFrame(() => {
        _rafCarrossel = null;
        atualizarTransformCards();
    });
}

function initServiceCarousel() {
    const track = document.getElementById("services-container");
    const wrap = track && track.closest(".service-carousel");
    if (!wrap || wrap.dataset.wired) {
        if (wrap) agendarAtualizacaoCards();
        return;
    }
    wrap.dataset.wired = "1";

    const prev = wrap.querySelector(".carousel-prev");
    const next = wrap.querySelector(".carousel-next");

    const passo = () => {
        const card = track.querySelector(".svc-card");
        if (!card) return 300;
        const gap = parseInt(getComputedStyle(track).columnGap || getComputedStyle(track).gap, 10) || 16;
        return card.getBoundingClientRect().width + gap;
    };
    const noFim = () => track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;

    if (prev) prev.onclick = () => {
        if (track.scrollLeft < 8) track.scrollTo({ left: track.scrollWidth, behavior: "smooth" });
        else track.scrollBy({ left: -passo(), behavior: "smooth" });
    };
    if (next) next.onclick = () => {
        if (noFim()) track.scrollTo({ left: 0, behavior: "smooth" });
        else track.scrollBy({ left: passo(), behavior: "smooth" });
    };

    track.addEventListener("scroll", agendarAtualizacaoCards, { passive: true });
    window.addEventListener("resize", agendarAtualizacaoCards);
    agendarAtualizacaoCards();
}

const BARB_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const BARB_SHUFFLE = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`;

function iniciais(nome) {
    return (nome || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase();
}

function renderBarbeiros() {
    const container = document.getElementById("barbers-container");
    if (!container) return;
    container.className = "barbers-grid";
    container.innerHTML = "";

    const ativos = dbBarbeiros.filter(b => b.ativo !== false);

    const selecionar = (tile, barbeiroId, semPref) => {
        container.querySelectorAll(".barber-tile.selected").forEach(t => t.classList.remove("selected"));
        tile.classList.add("selected");
        agendamento.barbeiroId = barbeiroId;
        agendamento.semPreferencia = semPref;
        validateStep();
    };

    // --- Card "Sem preferência" (primeiro) ---
    if (ativos.length) {
        const semPref = document.createElement("button");
        semPref.type = "button";
        semPref.className = "barber-tile barber-tile--sempref" + (agendamento.semPreferencia ? " selected" : "");
        semPref.style.setProperty("--i", 0);
        semPref.innerHTML = `
            <span class="barber-tile__num">( 00 )</span>
            <span class="barber-tile__check">${BARB_CHECK}</span>
            <span class="barber-tile__ico">${BARB_SHUFFLE}</span>
            <span class="barber-tile__body">
                <span class="barber-tile__name">Sem preferência</span>
                <span class="barber-tile__spec">Primeiro disponível</span>
            </span>
        `;
        semPref.addEventListener("click", () => selecionar(semPref, ativos[0].id, true));
        container.appendChild(semPref);
    }

    // --- Um card por barbeiro ativo ---
    ativos.forEach((b, idx) => {
        const marcado = !agendamento.semPreferencia && agendamento.barbeiroId === b.id;
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "barber-tile" + (marcado ? " selected" : "");
        tile.style.setProperty("--i", idx + 1);

        const num = String(idx + 1).padStart(2, "0");
        const fotoHTML = b.foto
            ? `<img class="barber-tile__photo" src="${b.foto}" alt="${b.nome}" onerror="this.style.display='none'">`
            : "";
        const spec = b.especialidade
            ? `<span class="barber-tile__spec">${b.especialidade}</span>`
            : "";

        tile.innerHTML = `
            <span class="barber-tile__initials">${iniciais(b.nome)}</span>
            ${fotoHTML}
            <span class="barber-tile__scrim"></span>
            <span class="barber-tile__num">( ${num} )</span>
            <span class="barber-tile__check">${BARB_CHECK}</span>
            <span class="barber-tile__body">
                <span class="barber-tile__name">${b.nome}</span>
                ${spec}
            </span>
        `;
        tile.addEventListener("click", () => selecionar(tile, b.id, false));
        container.appendChild(tile);
    });
}

function renderCalendario(date) {
    const container = document.getElementById("step-agenda");
    if (!container) return;

    container.innerHTML = `
        <div class="section-intro">
            <span class="intro-kicker">03 / HORÁRIO</span>
            <h2>Escolha o dia e a hora</h2>
            <p>Toque num dia e depois num horário livre</p>
        </div>

        <div class="agenda-card">
            <div class="agenda-cal">
                <div class="agenda-cal__head">
                    <button type="button" class="agenda-nav" id="cal-prev" aria-label="Mês anterior">‹</button>
                    <span class="agenda-cal__month" id="calendar-month-year"></span>
                    <button type="button" class="agenda-nav" id="cal-next" aria-label="Próximo mês">›</button>
                </div>
                <div class="agenda-cal__weekdays">
                    <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
                </div>
                <div class="agenda-cal__days" id="calendar-days"></div>
            </div>

            <div class="agenda-times">
                <div class="agenda-times__label" id="agenda-times-label">Horários</div>
                <div class="agenda-times__list" id="slots-container"></div>
            </div>
        </div>

        <p class="agenda-summary" id="agenda-summary">Escolha um dia e um horário.</p>
    `;

    const calendarDays = document.getElementById("calendar-days");
    const monthYearText = document.getElementById("calendar-month-year");

    const year = date.getFullYear();
    const month = date.getMonth();
    const meses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    monthYearText.textContent = `${meses[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

        if (loopDate < today) dayBtn.classList.add("disabled");
        if (loopDate.getTime() === today.getTime()) dayBtn.classList.add("today");
        if (agendamento.data && agendamento.data.toDateString() === loopDate.toDateString()) {
            dayBtn.classList.add("selected");
        }

        dayBtn.addEventListener("click", () => {
            if (loopDate < today) return;
            agendamento.data = loopDate;
            agendamento.hora = null;
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
    atualizarRodapeAgenda();
}

function atualizarRodapeAgenda() {
    const el = document.getElementById("agenda-summary");
    if (!el) return;
    if (!agendamento.data) {
        el.textContent = "Escolha um dia e um horário.";
        return;
    }
    const diaFmt = agendamento.data.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const exp = dbExpediente.find(e => Number(e.day_of_week) === agendamento.data.getDay());

    if (!exp || !exp.active) {
        el.innerHTML = `<strong>${diaFmt}</strong> — a barbearia não abre nesse dia. Escolha outro.`;
    } else if (agendamento.hora) {
        el.innerHTML = `Agendamento para <strong>${diaFmt}</strong> às <strong>${agendamento.hora}</strong>.`;
    } else {
        el.innerHTML = `<strong>${diaFmt}</strong> — agora escolha o horário.`;
    }
}

const SLOT_INTERVALO = 30; // minutos entre horários oferecidos

function renderHorarios() {
    const container = document.getElementById("slots-container");
    if (!container) return;
    container.innerHTML = "";
    const label = document.getElementById("agenda-times-label");
    const setLabel = (t) => { if (label) label.textContent = t; };

    const aviso = (txt) => {
        setLabel("Horários");
        container.innerHTML = `<p class="agenda-times__empty">${txt}</p>`;
    };

    if (!agendamento.data) return aviso("Selecione um dia primeiro");
    if (!agendamento.barbeiroId) return aviso("Volte e escolha um profissional");

    const diaSemana = agendamento.data.getDay(); // 0=domingo .. 6=sábado
    const exp = dbExpediente.find(e => Number(e.day_of_week) === diaSemana);

    if (!exp || !exp.active) return aviso("A barbearia não abre neste dia.");

    // duração total dos serviços escolhidos
    const dur = Math.max(
        15,
        dbServicos.filter(s => agendamento.servicos.includes(s.id)).reduce((a, s) => a + (s.duracao || 0), 0)
    );

    const abre = hmToMin(exp.start_time);
    const fecha = hmToMin(exp.end_time);
    const almocoIni = exp.waiting_start ? hmToMin(exp.waiting_start) : null;
    const almocoFim = exp.waiting_end ? hmToMin(exp.waiting_end) : null;

    const dataStr = ymdLocal(agendamento.data);
    const hoje = new Date();
    const ehHoje = dataStr === ymdLocal(hoje);
    const agoraMin = hoje.getHours() * 60 + hoje.getMinutes();

    const ocupadosDoDia = dbOcupados.filter(
        o => o.date === dataStr && Number(o.worker_id) === Number(agendamento.barbeiroId)
    );

    const slots = [];
    for (let t = abre; t + dur <= fecha; t += SLOT_INTERVALO) {
        const fim = t + dur;
        if (almocoIni !== null && t < almocoFim && fim > almocoIni) continue;            // colide com almoço
        if (ehHoje && t <= agoraMin) continue;                                           // já passou
        const conflita = ocupadosDoDia.some(o => t < hmToMin(o.end_time) && fim > hmToMin(o.start_time));
        if (conflita) continue;
        slots.push(minToHm(t));
    }

    if (agendamento.hora && !slots.includes(agendamento.hora)) agendamento.hora = null;

    if (slots.length === 0) return aviso("Sem horários livres nesse dia.");

    setLabel(`${slots.length} ${slots.length === 1 ? "horário livre" : "horários livres"}`);

    slots.forEach((hora, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `time-btn${agendamento.hora === hora ? " selected" : ""}`;
        btn.style.setProperty("--i", i);
        btn.textContent = hora;
        btn.addEventListener("click", () => {
            agendamento.hora = hora;
            container.querySelectorAll(".time-btn.selected").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            atualizarRodapeAgenda();
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
    document.getElementById("summary-barber-name").textContent = barbeiro
        ? (agendamento.semPreferencia ? `Sem preferência (${barbeiro.nome})` : barbeiro.nome)
        : "Não selecionado";

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
        const response = await fetch(apiPublic("/avisos/ativo"));
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

// ==========================================================================
// FUNÇÃO PARA MOSTRAR MENSAGENS NA TELA
// ==========================================================================
function mostrarAvisoTela(mensagem, tipo = 'aviso') {
    const box = document.getElementById("box-mensagem");
    const texto = document.getElementById("texto-mensagem");

    if (!box || !texto) {
        alert(mensagem); // Fallback de segurança se esquecer o HTML
        return;
    }

    texto.textContent = mensagem;

    // Reseta as classes de cor
    box.className = '';
    
    // Aplica a cor correta baseada no CSS
    if (tipo === 'erro') box.classList.add('msg-erro');
    else if (tipo === 'sucesso') box.classList.add('msg-sucesso');
    else box.classList.add('msg-aviso');

    // Faz aparecer
    box.classList.add('msg-visivel');

    // Faz sumir após 3.5 segundos
    setTimeout(() => {
        box.classList.remove('msg-visivel');
        box.classList.add('msg-escondida');
    }, 3500);
}


// ==========================================================================
// EVENTO DO BOTÃO CONTINUAR / FINALIZAR AGENDAMENTO
// ==========================================================================
const btnNext = document.getElementById("btn-next");
if (btnNext) {
    btnNext.addEventListener("click", async (e) => {
        e.preventDefault(); // IMPEDE O REFRESH DA PÁGINA

        // 1. Validações chamando nossa nova função (sem desabilitar o botão)
        if (currentStep === 1 && agendamento.servicos.length === 0) {
            return mostrarAvisoTela("Selecione pelo menos um serviço.", "aviso");
        }
        if (currentStep === 2 && agendamento.barbeiroId === null) {
            return mostrarAvisoTela("Escolha um profissional.", "aviso");
        }
        if (currentStep === 3 && (agendamento.data === null || agendamento.hora === null)) {
            return mostrarAvisoTela("Escolha o dia e o horário do atendimento.", "aviso");
        }
        if (currentStep === 4) {
            const formCliente = document.getElementById("client-form");
            if (formCliente && !formCliente.checkValidity()) {
                return mostrarAvisoTela("Preencha todos os seus dados corretamente.", "erro");
            }
        }

        // 2. Se tudo estiver certo, avança a tela ou envia para a API
        if (currentStep < 4) {
            currentStep++;
            updateFlowUI();
        } else {
            // Pega os dados finais do formulário
            agendamento.cliente.nome = document.getElementById("client-name").value;
            agendamento.cliente.telefone = document.getElementById("client-phone").value;
            agendamento.cliente.notas = document.getElementById("client-notes").value;

            const payloadParaBackend = {
                barbeiroId: agendamento.barbeiroId,
                servicosIds: agendamento.servicos,
                dataAgendamento: ymdLocal(agendamento.data),
                horario: agendamento.hora,
                clienteNome: agendamento.cliente.nome,
                clienteTelefone: agendamento.cliente.telefone,
                observacoes: agendamento.cliente.notas,
                // honeypot: só um bot preenche isso; uma pessoa nunca vê o campo
                website: document.getElementById("client-website")?.value || ""
            };

            try {
                btnNext.disabled = true;
                btnNext.textContent = "Aguarde...";

                // Chamada para a sua API
                const response = await fetch(apiPublic("/agendamentos"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payloadParaBackend)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Erro de comunicação com o servidor.");
                }

                // SUCESSO! Mostra a mensagem verde.
                mostrarAvisoTela(`Agendamento confirmado, ${payloadParaBackend.clienteNome}!`, "sucesso");
                
                // Limpa a tela após 3 segundos
                setTimeout(() => { window.location.reload(); }, 3000);

            } catch (error) {
                // ERRO! Mostra a mensagem vermelha.
                console.error("Falha:", error);
                mostrarAvisoTela(error.message || "Houve um problema ao finalizar.", "erro");
                
                btnNext.disabled = false;
                btnNext.textContent = "Finalizar Agendamento";
            }
        }
    });
}
document.getElementById("btn-prev").addEventListener("click", () => {
    if (currentStep > 1) {
        currentStep--;
        updateFlowUI();
    }
});

// ==========================================================================
// 9. INICIALIZAÇÃO DA PÁGINA (Unificado e Assíncrono)
// ==========================================================================
function esconderLoading() {
    const loading = document.getElementById("loading-overlay");
    if (loading) {
        loading.classList.add("loading-escondido");
    }
}

// ==========================================================================
//  IDENTIDADE VISUAL DA BARBEARIA (cabeçalho + cor de destaque)
// ==========================================================================
async function carregarIdentidade() {
    try {
        const res = await fetch(apiPublic("/barbearia"));
        if (!res.ok) return;
        const bs = await res.json();

        const nome = document.getElementById("bs-name");
        const sub = document.getElementById("bs-subtitle");
        const loc = document.getElementById("bs-location");
        const logo = document.getElementById("bs-logo");

        if (nome && bs.name) { nome.textContent = bs.name; document.title = bs.name; }
        if (sub) sub.textContent = bs.subtitle || "BARBEARIA";

        if (loc) {
            const cidadeEstado = [bs.city, bs.state].filter(Boolean).join(", ");
            if (cidadeEstado) {
                loc.textContent = cidadeEstado;
            } else {
                loc.closest(".location-box")?.style.setProperty("display", "none");
            }
        }

        if (logo && bs.logo_url) {
            logo.innerHTML = `<img src="${bs.logo_url}" alt="${bs.name || "logo"}">`;
        }

        if (bs.accent_color) {
            document.documentElement.style.setProperty("--primary", bs.accent_color);
        }
        if (bs.secondary_color) {
            document.documentElement.style.setProperty("--secondary", bs.secondary_color);
        }
    } catch (e) {
        /* mantém os placeholders do HTML */
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    // 1. O HTML já carrega mostrando a tela de Loading por padrão.

    // 1b. Identidade visual (nome, logo, cidade, cor)
    await carregarIdentidade();

    // 2. Espera os dados chegarem da API
    await carregarDadosIniciais();
    
    // 3. Renderiza todas as telas escondidas
    renderBarbeiros();
    renderServicos();
    renderCalendario(currentDateObj);
    renderHorarios();
    updateFlowUI();

    // 4. Checa os pop-ups de aviso
    verificarAvisoBarbearia();

    // 5. Tudo pronto! Esconde a tela de carregamento para o usuário ver o site.
    esconderLoading();
});
// ==========================================================================
// SISTEMA DE MODAL DE CONFIRMAÇÃO UNIVERSAL
// ==========================================================================
let acaoPendente = null; // Guarda a função que será executada se o usuário disser "Sim"

window.abrirModalConfirmacao = function(titulo, mensagem, textoBotao, tipoBotao, callback) {
    // 1. Troca os textos do modal
    document.getElementById("confirm-titulo").innerText = titulo;
    document.getElementById("confirm-mensagem").innerText = mensagem;
    
    // 2. Configura o botão de confirmação
    const btnConfirmar = document.getElementById("btn-confirmar-acao");
    btnConfirmar.innerText = textoBotao;
    
    // Se for uma ação perigosa (excluir), fica vermelho. Se for normal, fica dourado.
    if (tipoBotao === 'danger') {
        btnConfirmar.style.backgroundColor = 'var(--danger)';
        btnConfirmar.style.color = '#ffffff';
    } else {
        btnConfirmar.style.backgroundColor = 'var(--brand-primary)';
        btnConfirmar.style.color = 'var(--brand-bg-dark)';
    }
    
    // 3. Salva a ação que deve acontecer e abre o modal
    acaoPendente = callback;
    document.getElementById("modal-confirmacao").classList.add("active");
}

window.fecharModalConfirmacao = function() {
    document.getElementById("modal-confirmacao").classList.remove("active");
    acaoPendente = null; // Limpa a ação por segurança
}

// Quando clicar no botão "Sim", executa a ação salva e fecha o modal
const btnConfirmarAcao = document.getElementById("btn-confirmar-acao");
if (btnConfirmarAcao) {
    btnConfirmarAcao.addEventListener("click", () => {
        if (acaoPendente) acaoPendente(); 
        fecharModalConfirmacao();
    });
}