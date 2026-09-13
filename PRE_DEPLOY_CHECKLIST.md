# PRE_DEPLOY_CHECKLIST — CRM-Barber (MVP / ambiente de testes)

> **Status:** Tier 1 (robustez) e Tier 2 (produto) do endurecimento pré-produção
> fechados: multi-tenant, multi-serviço, trava de concorrência, telefone
> normalizado, timezone, monitor de instância de WhatsApp, anti-bot, paginação,
> soft delete, expiração de token, cache-busting, log rotacionado, auditoria e
> backup/restore testado. Suíte automatizada: 38/38. Falta só a configuração
> específica do servidor de produção (seção 2) e o smoke test manual (seção 4).


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
| `APP_TIMEZONE` | `America/Sao_Paulo` | fuso da agenda/faturamento; padrão já é BRT |
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
| `SANCTUM_TOKEN_EXPIRATION` | `43200` (30 dias) | minutos até o token do painel expirar; depois disso é 401 e login de novo |
| `LOG_STACK` | `daily` | arquivo de log por dia (`LOG_DAILY_DAYS` controla a retenção, padrão 14) |

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

Sem `.env` e sem build. Config no `front-end/js/config.js`:

- `window.API_BASE_URL` → URL pública do Laravel (ex.: `https://api.seudominio.com/api`).
- `window.BARBERSHOP_SLUG` (só o site público) é resolvido em runtime: `?b=slug` na URL → primeiro rótulo do subdomínio (`barbearia-x.agendar.seudominio.com`) → fallback fixo no arquivo. **O painel (`admin.html`/`login.html`) não usa slug** — o tenant vem do usuário logado.

**Multi-tenant:** um único deploy atende N barbearias. Cada barbearia tem um `slug` (gerado no cadastro). O link de agendamento de uma barbearia é `https://agendar.seudominio.com/index.html?b=<slug>` (ou um subdomínio, se você configurar DNS/cert wildcard). As rotas públicas da API são `/api/b/<slug>/...`.

**Cache-busting:** como não há build, o `<link>`/`<script>` dos 3 HTMLs (`index.html`, `admin.html`, `login.html`) carrega `css/*.css`/`js/*.js` com `?v=AAAAMMDD`. **Toda vez que editar CSS ou JS, bump esse `?v=`** (busca/substitui a data antiga pela nova nos 3 arquivos) — sem isso o navegador do cliente pode continuar servindo a versão em cache indefinidamente.

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

# em OUTRO processo — scheduler (monitor de instância de WhatsApp a cada 5 min):
php artisan schedule:work
```

> Em produção real: `queue:work` sob supervisor/systemd (`Restart=always`) e o
> scheduler via cron (`* * * * * cd /app && php artisan schedule:run >> /dev/null 2>&1`).
> O scheduler agora também roda `sanctum:prune-expired` (diário) — sem ele os
> tokens vencidos só deixam de autenticar, mas ficam acumulando na tabela.
> O comando `instances:check` marca instância caída e grava um `Log::error`
> (`SendAppointmentWhatsapp` idem quando esgota as tentativas) — é o ponto pra
> plugar Sentry/e-mail pro dono.

> O `migrate` já inclui as migrations novas: `status` do agendamento
> (`pendente`/`confirmado`/`concluido`/`cancelado`), `services.duration_time` em
> minutos, `workers.photo`/`speciality` nullable, `operation_times` reformulado (dia da semana 0-6 + intervalo), `barbershops` ganhou `subtitle`/`accent_color` (identidade da página pública), campos de pagamento em `workers`
> (`payment_type`, `commission_percent`, `fixed_salary`, `pix_key`), `price` +
> `commission_value` em `schedules`, pivô `schedule_service` (multi-serviço por
> agendamento, com snapshot de preço/comissão por serviço), **`barbershop_id`
> (multi-tenant) em services/workers/clients/schedules/operation_times/avisos/
> payouts** com uniques compostos por barbearia, **índices em `schedules`
> (worker_id+date, barbershop_id+date+status, status) e `services`/`workers`
> (barbershop_id+active)**, **soft delete em services/workers/clients**
> (excluir não apaga mais o histórico — `deleted_at`), tabela **`audit_logs`**
> (quem fez o quê no painel), tabelas `avisos`, `instances`, `payouts` e as
> tabelas de fila (`jobs`, `failed_jobs`, `job_batches`).

> **Multi-tenant no seed:** `db:seed` cria 10 barbearias e popula dados (serviços/
> profissionais/clientes/horários/agendamentos) só nas 2 primeiras (`alpha-barber`,
> `king-barber`). Em produção real, cada barbearia entra pelo cadastro (`POST
> /cadastrar`), que já cria a grade de horário padrão.

Dados semeados úteis para o teste (senha de todos: **`123456`**):
- `admin@alphabarber.test` (barbearia `alpha-barber`) / `admin@kingbarber.test` (`king-barber`) — role admin
- `cliente@test.com` / `joao.cliente@test.com` — role user
- Site público: `index.html?b=alpha-barber` ou `index.html?b=king-barber`

### 3.1.1 Rodar a suíte de testes

```bash
# precisa de pdo_sqlite habilitado no php.ini, OU um banco MySQL de teste:
php artisan test
# com MySQL de teste (ex.: banco crm_barber_test):
DB_DATABASE=crm_barber_test php artisan test
```

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
13. **Anti-bot**: `curl` pro `POST /b/{slug}/agendamentos` com `"website":"qualquer coisa"` no corpo → `422`. 6 agendamentos seguidos com o mesmo telefone (mesmo em horários diferentes) → o 6º dá `422` em `clienteTelefone`.
14. **Auditoria**: confirme/cancele um agendamento ou exclua um profissional/serviço/cliente no painel → aparece na tabela "Atividade Recente" (Visão Geral) e em `GET /auditoria`.
15. **Exclusão não apaga histórico**: exclua um profissional que tem agendamento — ele some da lista de profissionais, mas o agendamento antigo continua mostrando o nome dele (soft delete). Recriar um profissional/cliente com o mesmo telefone restaura o registro em vez de duplicar.

---

## 5. Mapa de acesso das rotas

**Auth global (sem token):** `POST /login`, `POST /cadastrar` (throttle 6/min)

**Públicas por barbearia (middleware `tenant`, slug no path):** `GET /b/{slug}/servicos` · `GET /b/{slug}/profissionais` · `POST /b/{slug}/agendamentos` (throttle 15/min) · `GET /b/{slug}/disponibilidade` · `GET /b/{slug}/avisos/ativo` · `GET /b/{slug}/barbearia`. Slug inválido/inativo → 404.

**Interna (header `X-Service-Token`):** `POST /logs`

**Autenticadas (`auth:sanctum` + `tenant.user`):** todo o resto de clientes / serviços / profissionais (inclui `GET` lista p/ o painel) / tempo_de_operação / barbearias / agendamentos / logs (leitura) / avisos (leitura) / `POST /message` / `instances/*`. Tudo escopado à barbearia do usuário logado (global scope + route-model binding resolvem só recursos do tenant; cross-tenant → 404).

**Somente admin (`auth:sanctum` + `admin`):** `usuarios/*` · `GET/PUT /avisos/{id}` · `GET /faturamento` · `GET|POST /payouts` · `GET|POST /instances`, `GET /instances/{id}/qrcode`, `GET /instances/{id}/status`, `DELETE /instances/{id}` · `GET /auditoria`

---

## 6. Pendências conhecidas (não bloqueiam)

| Item | Impacto |
|---|---|
| Calendário do site permite clicar em dia fechado | Só mostra "A barbearia não abre neste dia" ao clicar. Poderia desabilitar o dia visualmente. Cosmético menor. |
| `ClientController@index`/`WorkerController@index`/`ServiceController@index` sem paginação | Cresce com o número de clientes/profissionais/serviços cadastrados (não com o histórico de agendamentos, que já pagina). Ok até algumas centenas; revisitar se crescer muito. |
| `.env` reais no servidor | Garantir que **não** vão pro git (o `.gitignore` da raiz já cobre `*.env` / `.env*`). |
| Log rotacionado só no Laravel | `messages-service` (Node) ainda loga no stdout puro — em produção real, rode sob PM2 com `pm2 install pm2-logrotate` (ou redirecione pro logrotate do sistema) pra não deixar o arquivo de log crescer pra sempre. |

---

## 7. Backup e restore

Scripts em `scripts/backup-mysql.sh` e `scripts/restore-mysql.sh` (testados de
verdade nesta sessão: dump do banco real → restore num banco novo → contagem de
linhas bateu 100% em `barbershops`/`services`/`workers`/`clients`/`schedules`).

```bash
# backup manual (ou via cron diário — exemplo no topo do script)
DB_PASSWORD='suasenha' BACKUP_DIR=/var/backups/crm-barber ./scripts/backup-mysql.sh

# restore — SEMPRE teste primeiro num banco separado, nunca direto em cima do de produção
DB_PASSWORD='suasenha' ./scripts/restore-mysql.sh /var/backups/crm-barber/crm_barber_20260914_030000.sql.gz crm_barber_teste_restore
```

Cron sugerido (3h da manhã, mantém 14 dias):
```
0 3 * * * DB_PASSWORD='suasenha' BACKUP_DIR=/var/backups/crm-barber /app/scripts/backup-mysql.sh >> /var/log/crm-barber-backup.log 2>&1
```

Some com o snapshot semanal do provedor (Hostinger) — o dump diário cobre o
intervalo entre snapshots.

---

## 8. Ordem de subida recomendada

1. MySQL  →  2. Laravel (`migrate --seed`) + `queue:work` + `schedule:work`  →  3. Node  →  4. Frontend

Derrubar na ordem inversa.
