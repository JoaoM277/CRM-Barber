# PRE_DEPLOY_CHECKLIST — CRM-Barber (MVP / ambiente de testes)

> **Status:** smoke test local (seção 4) rodado end-to-end contra MySQL — os 10 passos passaram
> (auth, RBAC/401, throttle, cadastro base, agendamento público, fila → WhatsApp → log,
> confirmar/cancelar, faturamento, avisos).


Três serviços + um MySQL compartilhado:

| Serviço | Pasta | Stack | Porta padrão |
|---|---|---|---|
| API principal | `backend/crm-barber` | Laravel 13 / PHP 8.3+ | 8000 |
| Serviço de mensagens | `messages-service` | Node 18+ / Express | 3000 |
| Frontend | `front-end` | HTML/CSS/JS estático (sem build) | 5500 (ou qualquer) |

Fluxo: **Frontend → Laravel (`:8000/api`) → Node (`:3000`) → Evolution API**.
O Node fala com o Laravel **só por HTTP** (nunca direto no banco).

---

## 1. Pré-requisitos do servidor

- PHP 8.3+ com extensões: `pdo_mysql`, `mbstring`, `openssl`, `bcmath`, `ctype`, `fileinfo`, `tokenizer`, `curl`
- Composer 2
- Node.js 18+ e npm
- MySQL 8 rodando, com um banco vazio chamado **`crm_barber`** e um usuário com permissão total nele
- (Opcional) um servidor estático para o frontend (nginx, `serve`, etc.)

```bash
# no MySQL, uma vez:
CREATE DATABASE crm_barber CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 2. Variáveis de ambiente

### 2.1 Laravel — `backend/crm-barber/.env`

Copiar de `.env.example` e ajustar. Chaves que **precisam** ser revisadas:

| Var | Valor no teste | Observação |
|---|---|---|
| `APP_ENV` | `production` (ou `staging`) | `.env.example` vem como `local` |
| `APP_DEBUG` | `false` | deixar `true` só se precisar depurar |
| `APP_KEY` | *(gerado)* | `php artisan key:generate` preenche |
| `APP_URL` | `http://SEU_HOST:8000` | URL pública da API |
| `DB_CONNECTION` | `mysql` | |
| `DB_HOST` | `127.0.0.1` | |
| `DB_PORT` | `3306` | |
| `DB_DATABASE` | `crm_barber` | tem que bater com o banco criado |
| `DB_USERNAME` | *(seu user)* | |
| `DB_PASSWORD` | *(sua senha)* | |
| `MESSAGE_SERVICE_URL` | `http://127.0.0.1:3000/` | **tem que terminar com `/`** (o `InstanceController` concatena sem barra) |
| `MESSAGES_SERVICE_TOKEN` | *(segredo aleatório longo)* | **igual ao do Node.** Autentica `POST /api/logs` (header `X-Service-Token`) |
| `FRONTEND_URL` | `http://SEU_HOST:5500` | origem do front; usada nos redirects de `web.php` e como fallback do CORS |
| `CORS_ALLOWED_ORIGINS` | `http://SEU_HOST:5500` | lista separada por vírgula das origens liberadas; se vazio, usa `FRONTEND_URL` |
| `SESSION_DRIVER` | `database` | precisa da tabela `sessions` (já vem nas migrations) |
| `CACHE_STORE` | `database` | idem tabela `cache` |
| `QUEUE_CONNECTION` | `database` | **o disparo de WhatsApp virou job** — precisa de worker rodando (ver 3.1) |

> CORS agora é controlado por `config/cors.php` + `CORS_ALLOWED_ORIGINS`. Só as origens listadas conseguem consumir a API pelo navegador.

### 2.2 Node — `messages-service/.env`

Copiar de `messages-service/.env.example`:

| Var | Para que serve |
|---|---|
| `PORT` | porta do serviço (default 3000) |
| `API_URL_BACKEND` | URL base do Laravel **sem `/api`** (ex.: `http://127.0.0.1:8000`) — usada para gravar logs em `POST {API_URL_BACKEND}/api/logs` |
| `MESSAGES_SERVICE_TOKEN` | **mesmo valor** do `MESSAGES_SERVICE_TOKEN` do Laravel; enviado no header `X-Service-Token` |
| `EVOLUTION_URL` | URL da instância da Evolution API |
| `EVOLUTION_API_KEY` | apikey global da Evolution API |

> O envio de WhatsApp passa **exclusivamente pela Evolution API** usando a instância conectada da barbearia: o Laravel escolhe a instância com status `conectado` e manda o nome no payload; o Node envia via `POST {EVOLUTION_URL}/message/sendText/{instance}`. **Sem uma instância criada e conectada na aba Instâncias, nenhuma mensagem é enviada** (fica registrada no log como `SEM_INSTANCIA`).

### 2.3 Frontend — `front-end/`

Sem `.env` e sem build. A URL da API fica num **único arquivo**:

- `front-end/js/config.js` → `window.API_BASE_URL = "http://SEU_HOST:8000/api";`

Trocar só essa linha para a URL pública do Laravel. Os 3 scripts (`admin.js`, `script.js`, `login.js`) já leem de `window.API_BASE_URL`.

---

## 3. Comandos de inicialização (servidor de teste)

### 3.1 Laravel

```bash
cd backend/crm-barber

composer install --no-dev --optimize-autoloader
cp .env.example .env            # depois edite conforme a seção 2.1
php artisan key:generate
php artisan migrate --seed --force     # cria as tabelas e popula dados de teste
php artisan config:cache
php artisan route:cache

# subir a API (dev server; em produção real usar nginx + php-fpm):
php artisan serve --host=0.0.0.0 --port=8000

# em OUTRO processo — worker da fila (disparo de WhatsApp):
php artisan queue:work --tries=3
```

> O `migrate` já inclui as migrations novas: `status` do agendamento
> (`pendente`/`confirmado`/`concluido`/`cancelado`), `services.duration_time` em
> minutos, `workers.photo`/`speciality` nullable, `operation_times` reformulado (dia da semana 0-6 + intervalo), `barbershops` ganhou `subtitle`/`accent_color` (identidade da página pública), campos de pagamento em `workers`
> (`payment_type`, `commission_percent`, `fixed_salary`, `pix_key`), `price` +
> `commission_value` em `schedules`, pivô `schedule_service` (multi-serviço por
> agendamento, com snapshot de preço/comissão por serviço), tabelas `avisos`,
> `instances`, `payouts` e as tabelas de fila (`jobs`, `failed_jobs`, `job_batches`).

Dados semeados úteis para o teste (senha de todos: **`123456`**):
- `admin@alphabarber.test` / `admin@kingbarber.test` — role admin
- `cliente@test.com` / `joao.cliente@test.com` — role user

### 3.2 Node (messages-service)

```bash
cd messages-service

npm ci
cp .env.example .env            # depois edite conforme a seção 2.2
npm start                       # node src/server.js  (porta 3000)
```

Verificação rápida: `curl http://127.0.0.1:3000/health` → `{"service":"message service","status":"online"}`

### 3.3 Frontend

```bash
# 1. editar front-end/js/config.js (window.API_BASE_URL)
# 2. servir a pasta estática, ex.:
npx serve front-end -l 5500
#   ou: python -m http.server 5500 --directory front-end
```

> A origem em que o front é servido tem que estar em `CORS_ALLOWED_ORIGINS` do Laravel.

Páginas: `index.html` (agendamento público), `login.html` (login admin), `admin.html` (painel).

---

## 4. Smoke test do fluxo principal

1. **Health**: `curl :3000/health` e `curl :8000/up` respondem OK.
2. **Login admin**: `login.html` com `admin@alphabarber.test` / `123456` → redireciona para `admin.html` sem erro no console.
3. **Cadastro base** (no painel): criar 1 serviço e 1 profissional → devem salvar sem erro (payloads já alinhados).
4. **Agendamento público**: `index.html`, seguir o fluxo até "Finalizar" → resposta `201` e toast verde.
   - Conferir no banco: nova linha em `clients` (se telefone novo) e em `schedules` com `status = 'pendente'`.
   - **Multi-serviço**: escolher 2+ serviços na tela 1 → `schedules.price` = soma dos preços, `end_time` = início + soma das durações, e N linhas em `schedule_service` (uma por serviço, com `price`/`commission_value` de cada). `schedules.service_id` guarda o 1º serviço (compat).
5. **Disparo WhatsApp**: ao finalizar o agendamento o Laravel chama `POST {MESSAGE_SERVICE_URL}message` → conferir log do Node (`req.body` + `status: "dispatched"` ou o erro do provider).
   - Se o Node estiver fora do ar, o agendamento **ainda assim** é criado (o disparo é best-effort com timeout de 5s).
6. **Log de mensagem**: `queue:work` processa o job `SendAppointmentWhatsapp`; conferir nova linha em `logs` (`action = WHATSAPP_MENSAGE_SENT`). O `POST /api/logs` do Node só passa se o `X-Service-Token` bater.
7. **Confirmar / Cancelar no painel**: na agenda do `admin.html`, clicar ✔️ → linha vira "Confirmado"; clicar ❌ → agendamento some da lista (`status = 'cancelado'`). `PUT /agendamentos/{id}` deve responder `200`.
8. **Dashboard financeiro**: aba de faturamento → `GET /faturamento` (auth+admin) devolve `{dia,mes,ano}`; valores > 0 depois de confirmar agendamentos.
9. **Avisos**: no painel, salvar um aviso com "ativo"; no site público (`index.html`), o modal do aviso aparece (`GET /avisos/ativo`).
10. **Segurança**: `curl` sem token em `GET /api/agendamentos` ou `GET /api/clientes` → `401`. `GET /api/servicos` sem token → `200` (público, o site precisa). Rotas admin (`/faturamento`, `/instances`, `/payouts`) com token de usuário comum → `403`.
11. **Folha de comissões**: no modal de Profissional, definir `payment_type` + `%`/`fixo` → salvar. Concluir um agendamento (botão ✅ na Agenda). Aba **Faturamento** mostra o atendimento em "Por profissional" com `Total a pagar = comissão + fixo`. Botão 💸 → registrar repasse → aparece em "Histórico de repasses".
12. **Instâncias**: aba **Instâncias** → "Nova instância" → nome sem espaços → o QR Code aparece; escanear no WhatsApp; o status passa a "Conectado" (polling). Botão 🗑️ remove (faz logout+delete na Evolution). Requer o serviço Node no ar e `EVOLUTION_URL`/`EVOLUTION_API_KEY` válidos.

---

## 5. Mapa de acesso das rotas

**Públicas (sem token):** `POST /login`, `POST /cadastrar` (throttle 6/min) · `GET /servicos` · `GET /profissionais` · `POST /agendamentos` (throttle 15/min) · `GET /disponibilidade` · `GET /avisos/ativo`

**Interna (header `X-Service-Token`):** `POST /logs`

**Autenticadas (`auth:sanctum`):** todo o resto de clientes / serviços / profissionais / tempo_de_operação / barbearias / agendamentos (GET lista, show, update, delete) / logs (leitura) / avisos (leitura) / `POST /message` / `instances/*`

**Somente admin (`auth:sanctum` + `admin`):** `usuarios/*` · `GET/PUT /avisos/{id}` · `GET /faturamento` · `GET|POST /payouts` · `GET|POST /instances`, `GET /instances/{id}/qrcode`, `GET /instances/{id}/status`, `DELETE /instances/{id}`

---

## 6. Pendências conhecidas (não bloqueiam)

| Item | Impacto |
|---|---|
| Calendário do site permite clicar em dia fechado | Só mostra "A barbearia não abre neste dia" ao clicar. Poderia desabilitar o dia visualmente. Cosmético menor. |
| `ScheduleController@index` sem paginação | `Schedule::all()` enriquecido; ok para volume de teste. |
| Seeders usam `updateOrCreate($arr)` com 1 argumento | Idempotente só se a linha estiver idêntica; ok em base de teste limpa. |
| `.env` reais no servidor | Garantir que **não** vão pro git (o `.gitignore` da raiz já cobre `*.env` / `.env*`). |

---

## 7. Ordem de subida recomendada

1. MySQL  →  2. Laravel (`migrate --seed`) + `queue:work`  →  3. Node  →  4. Frontend

Derrubar na ordem inversa.
