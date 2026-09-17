# Provisionamento do servidor — CRM-Barber

Runbook de infraestrutura (VPS/domínio/nginx/TLS/Evolution). Config de nível
de aplicação (`.env`, migrations, smoke test) está no
[`PRE_DEPLOY_CHECKLIST.md`](../PRE_DEPLOY_CHECKLIST.md) — siga este arquivo
primeiro, depois aquele.

---

## Fase 0 — Comprar (você faz, ninguém mais pode)

1. **VPS na Hostinger**: plano **KVM 2** (2 vCPU / 8 GB RAM / ~100 GB NVMe) —
   com a Evolution API também na mesma máquina, 4 GB não sobra folga.
   - **Região**: São Paulo, se disponível na lista.
   - **Sistema operacional**: Ubuntu **22.04 LTS** (mais testado com CloudPanel
     hoje; 24.04 também funciona se preferir).
   - Anote o **IP público** que a Hostinger te dá.
2. **Domínio**: pode comprar pela própria Hostinger ou usar um que já tenha.
   Você vai precisar de (pelo menos) 2 subdomínios apontando pro mesmo IP:
   - `agendar.seudominio.com` → site de agendamento + painel (front-end estático)
   - `api.seudominio.com` → API Laravel
   - (opcional) `evo.seudominio.com` → Evolution API, se quiser expor um painel dela
   - No DNS do domínio, crie um registro **A** pra cada subdomínio apontando
     pro IP da VPS. Propagação leva de minutos a ~1h.
3. Depois disso, me passa: **IP da VPS** e os **domínios escolhidos**, que eu
   já preencho os arquivos deste `deploy/` com os valores reais.

---

## Fase 1 — Bootstrap do servidor (via SSH, depois que a VPS existir)

Conecta: `ssh root@SEU_IP`

### 1.1 — CloudPanel (recomendado — nginx + PHP-FPM + MySQL + Node num painel só)

```bash
# script oficial do CloudPanel (Ubuntu/Debian)
curl -sS https://installer.cloudpanel.io/ce/v2/install.sh | sudo bash
```

Isso instala nginx, MySQL 8, PHP 8.3, Node e o painel do CloudPanel (acessível
em `https://SEU_IP:8443`). No painel:

1. Crie um site do tipo **"PHP"** (Laravel-like) pra `api.seudominio.com` — o
   CloudPanel já monta nginx + PHP-FPM + o certificado Let's Encrypt.
2. Crie um site do tipo **"Static (HTML)"** pra `agendar.seudominio.com`.
3. Crie um banco MySQL chamado `crm_barber` (o CloudPanel já cria o usuário).
4. Ative o **Let's Encrypt** nos dois sites (botão na aba SSL de cada site).

Se preferir configurar nginx na mão em vez do CloudPanel, use
[`nginx-api.conf`](nginx-api.conf) e [`nginx-front.conf`](nginx-front.conf)
como ponto de partida (edite os domínios e caminhos) e rode
`certbot --nginx` pra TLS.

### 1.2 — Docker (só pra Evolution API)

```bash
curl -fsSL https://get.docker.com | sudo sh
```

### 1.3 — Firewall

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8443/tcp  # painel do CloudPanel (opcional: restrinja ao seu IP)
ufw enable
```

**Nunca** abra a porta do MySQL (3306), do Node (3000) ou da Evolution (8080)
pro mundo — tudo isso conversa só via `127.0.0.1` entre os processos da
própria VPS.

---

## Fase 2 — Clonar e configurar a aplicação

```bash
cd /var/www   # ou o caminho que o CloudPanel criou pro site
git clone -b backup-refactor-claude https://github.com/JoaoM277/CRM-Barber.git crm-barber
cd crm-barber
```

Segue a partir daqui pelo **`PRE_DEPLOY_CHECKLIST.md`** (seções 2 e 3):
`.env` dos dois serviços, `composer install`, `npm ci`, `migrate --seed`,
`key:generate`.

### 2.1 — Processos de fundo (queue, scheduler, Node)

Copie os 3 arquivos de [`systemd/`](systemd) pra `/etc/systemd/system/`,
ajustando `WorkingDirectory` se o caminho não for `/var/www/crm-barber`:

```bash
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now crm-queue crm-scheduler crm-node
sudo systemctl status crm-queue crm-scheduler crm-node   # confirme "active (running)"
```

Logs de cada um: `journalctl -u crm-queue -f` (troque o nome do serviço).
O `journald` já rotaciona sozinho — não precisa de PM2/logrotate extra pro
Node rodando assim.

---

## Fase 3 — Evolution API

```bash
cp deploy/evolution.env.example deploy/evolution.env
nano deploy/evolution.env   # preenche EVOLUTION_SERVER_URL, EVOLUTION_API_KEY, EVOLUTION_DB_PASSWORD

docker compose -f deploy/docker-compose.evolution.yml --env-file deploy/evolution.env up -d
docker compose -f deploy/docker-compose.evolution.yml logs -f evolution-api   # confirma que subiu
```

No `.env` do Laravel e do `messages-service`:
```
EVOLUTION_URL=http://127.0.0.1:8080
EVOLUTION_API_KEY=<o mesmo valor de deploy/evolution.env>
```

> **Antes de trocar de vez:** confira se `atendai/evolution-api:v2.1.1` (a tag
> fixada no compose) bate com a versão que já está funcionando no Azure
> (`evo-api-jm...`). Se for outra major, confira as env vars na doc da
> Evolution antes — nomes mudam entre versões. Uma vez confirmado, crie a
> instância de novo pelo painel (aba Instâncias) e escaneie o QR — as
> instâncias antigas do Azure não migram automaticamente.

---

## Fase 4 — Smoke test e corte

Siga a seção 4 do `PRE_DEPLOY_CHECKLIST.md` (os 15 passos) contra os domínios
reais. Só depois de tudo verde: atualiza `front-end/js/config.js` com a URL
final da API, ajusta `CORS_ALLOWED_ORIGINS`, e o link de agendamento vira
`https://agendar.seudominio.com/index.html?b=<slug-da-barbearia>`.
