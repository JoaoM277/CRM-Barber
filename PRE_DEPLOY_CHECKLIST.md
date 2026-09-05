# PRE_DEPLOY_CHECKLIST — CRM-Barber (MVP / ambiente de testes)

Três serviços + um MySQL compartilhado:

| Serviço | Pasta | Stack | Porta padrão |
|---|---|---|---|
| API principal | `backend/crm-barber` | Laravel 13 / PHP 8.3+ | 8000 |
| Serviço de mensagens | `messages-service` | Node 18+ / Express | 3000 |
| Frontend | `front-end` | HTML/CSS/JS estático (sem build) | 5500 (ou qualquer) |

Fluxo: **Frontend → Laravel (`:8000/api`) → Node (`:3000`) → Evolution API / Infobip**.
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
| `SESSION_DRIVER` | `database` | precisa da tabela `sessions` (já vem nas migrations) |
| `CACHE_STORE` | `database` | idem tabela `cache` |
| `QUEUE_CONNECTION` | `database` | não há jobs no MVP; worker é opcional |

> CORS: o projeto não publicou `config/cors.php`, então vale o default do Laravel (`api/*` liberado para qualquer origem). Suficiente para o teste; travar depois.

### 2.2 Node — `messages-service/.env`

Copiar de `messages-service/.env.example`:

| Var | Para que serve |
|---|---|
| `PORT` | porta do serviço (default 3000) |
| `API_URL_BACKEND` | URL base do Laravel **sem `/api`** (ex.: `http://127.0.0.1:8000`) — usada para gravar logs em `POST {API_URL_BACKEND}/api/logs` |
| `API_TOKEN_BACKEND` | token para autenticar no Laravel (hoje a rota `/api/logs` está pública, mas o provider já manda o header) |
| `EVOLUTION_URL` | URL da instância da Evolution API |
| `EVOLUTION_API_KEY` | apikey global da Evolution API |
| `INFOBIP_BASE_URL` | base da Infobip (canal legado/fallback de WhatsApp) |
| `INFOBIP_API_KEY` | chave da Infobip |
| `INFOBIP_SENDER_ID` | ex.: `InfoSMS` |
| `INFOBIP_WHATSAPP_NUMBER` | número remetente no formato internacional |

> O envio de WhatsApp do fluxo de agendamento passa hoje pelo **provider Infobip** (`src/providers/message.provider.js`). A Evolution API é usada só para o ciclo de vida de instâncias (`/instance/*`).

### 2.3 Frontend — `front-end/`

Sem `.env` e sem build. A URL da API está **hardcoded** em 3 arquivos e precisa ser trocada para a URL pública do Laravel antes de subir:

- `front-end/js/admin.js`  → `const API_BASE_URL = "http://localhost:8000/api";`
- `front-end/js/script.js` → `const API_BASE_URL = "http://localhost:8000/api";`
- `front-end/js/login.js`  → `const API_BASE_URL = "http://localhost:8000/api";`

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

# subir (dev server; em produção real usar nginx + php-fpm):
php artisan serve --host=0.0.0.0 --port=8000
```

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
# 1. editar API_BASE_URL nos 3 arquivos js (seção 2.3)
# 2. servir a pasta estática, ex.:
npx serve front-end -l 5500
#   ou: python -m http.server 5500 --directory front-end
```

Páginas: `index.html` (agendamento público), `login.html` (login admin), `admin.html` (painel).

---

## 4. Smoke test do fluxo principal

1. **Health**: `curl :3000/health` e `curl :8000/up` respondem OK.
2. **Login admin**: `login.html` com `admin@alphabarber.test` / `123456` → redireciona para `admin.html` sem erro no console.
3. **Cadastro base** (no painel): criar 1 serviço e 1 profissional → devem salvar sem erro (payloads já alinhados).
4. **Agendamento público**: `index.html`, seguir o fluxo até "Finalizar" → resposta `201` e toast verde.
   - Conferir no banco: nova linha em `clients` (se telefone novo) e em `schedules` com `status = 'pendente'`.
5. **Disparo WhatsApp**: ao finalizar o agendamento o Laravel chama `POST {MESSAGE_SERVICE_URL}message` → conferir log do Node (`req.body` + `status: "dispatched"` ou o erro do provider).
   - Se o Node estiver fora do ar, o agendamento **ainda assim** é criado (o disparo é best-effort com timeout de 5s).
6. **Log de mensagem**: conferir nova linha em `logs` (`action = WHATSAPP_MENSAGE_SENT`).
7. **Confirmar / Cancelar no painel**: na agenda do `admin.html`, clicar ✔️ → linha vira "Confirmado"; clicar ❌ → agendamento some da lista (`status = 'cancelado'`). `PUT /agendamentos/{id}` deve responder `200`.

---

## 5. Pendências conhecidas (não bloqueiam o teste, mas registrar)

| Item | Impacto |
|---|---|
| Endpoints chamados pelo front que não existem: `GET /faturamento`, `GET|PUT /avisos/1`, `GET /api/avisos/ativo` | Telas de faturamento/avisos ficam vazias ou com erro no console. |
| `services.duration_time` é coluna `TIME` mas recebe minutos como inteiro | Duração grava errada; o cálculo de `end_time` no agendamento usa fallback de 30 min. |
| `ScheduleController@index` sem `->with()` e sem filtro `?data=` | Colunas "Serviço"/"Barbeiro" aparecem como "N/A" na agenda; filtro de data não funciona. |
| `web.php` (`/login`, `/cadastrar`) aponta para métodos/views inexistentes | Rotas web dão 500. O frontend não depende delas (é servido à parte). |
| API base URL hardcoded nos 3 JS | Externalizar em config antes de um deploy "de verdade". |
| `.env` com segredos versionado em `messages-service` no passado / `backend/.env` local | Garantir que os `.env` reais do servidor **não** vão para o git (o `.gitignore` da raiz já cobre). |
| Rota `/api/logs` pública | Sem auth; ok para teste interno, fechar depois. |

---

## 6. Ordem de subida recomendada

1. MySQL  →  2. Laravel (migrate --seed)  →  3. Node  →  4. Frontend

Derrubar na ordem inversa.
