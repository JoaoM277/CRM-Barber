# Staging + deploy — CRM-Barber

Staging é uma cópia da produção **na mesma VPS**, com banco, domínio e processos
próprios. Toda mudança passa por lá antes de ir para produção — com SaaS e
clientes pagando, não dá mais para testar direto em prod.

| | Produção | Staging |
|---|---|---|
| Pasta | `/var/www/crm-barber` | `/var/www/crm-barber-staging` |
| Branch | `main` (hoje: `backup-refactor-claude`) | `main` ou a branch em teste |
| Banco | `crm_barber` | `crm_barber_staging` |
| API | `api.SEUDOMINIO.com` | `staging-api.SEUDOMINIO.com` |
| Front | `agendar.SEUDOMINIO.com` | `staging.SEUDOMINIO.com` |
| Node (`PORT`) | 3000 | 3001 |
| systemd | `crm-queue`, `crm-scheduler`, `crm-node` | `crm-queue-staging`, `crm-scheduler-staging`, `crm-node-staging` |

---

## 1. Migrar a produção para o fluxo novo (uma vez)

O `front-end/js/config.js` não deve mais ser editado no servidor — a URL da API
agora vem de `front-end/js/env.js` (fora do git). Na VPS de produção:

```bash
cd /var/www/crm-barber
git status --short                     # veja o que foi editado à mão
grep -n API_BASE_URL front-end/js/config.js   # anote a URL que está em uso

cp front-end/js/env.example.js front-end/js/env.js
nano front-end/js/env.js               # cole a URL anotada em API_BASE_URL

git checkout -- front-end/js/config.js # descarta a edição manual
git status --short                     # precisa ficar vazio para o deploy.sh rodar
```

Se o `git status` mostrar outros arquivos editados à mão, mova o ajuste para o
`.env` (ou traga para o repositório) antes de seguir.

Adicione também ao nginx do front o bloco `location = /js/env.js` de
[`nginx-front.conf`](nginx-front.conf) (sem cache para esse arquivo).

---

## 2. Subir o staging

### 2.1 DNS e sites
- Registros **A** para `staging-api.SEUDOMINIO.com` e `staging.SEUDOMINIO.com` → IP da VPS
- No CloudPanel: site PHP para `staging-api` (root `.../crm-barber-staging/backend/crm-barber/public`)
  e site estático para `staging` (root `.../crm-barber-staging/front-end`), Let's Encrypt nos dois
- Proteja o front de staging com senha (Basic Auth no CloudPanel) — não é para cliente achar

### 2.2 Banco
Crie `crm_barber_staging` com usuário próprio pelo CloudPanel.
Para ter dados realistas, restaure um backup de produção:
```bash
DB_DATABASE=crm_barber_staging DB_USERNAME=... DB_PASSWORD=... \
  ./scripts/restore-mysql.sh /var/backups/crm-barber/<dump>.sql.gz
```
> Dados de produção contêm telefones reais de clientes. Em staging, **não**
> conecte uma instância de WhatsApp com esses dados, ou troque os telefones:
> `UPDATE clients SET phone = CONCAT('5500000', LPAD(id, 6, '0'));`

### 2.3 Código e .env
```bash
cd /var/www
git clone -b main https://github.com/JoaoM277/CRM-Barber.git crm-barber-staging
cd crm-barber-staging
cp backend/crm-barber/.env.example backend/crm-barber/.env
cp messages-service/.env.example messages-service/.env
cp front-end/js/env.example.js front-end/js/env.js
```
No `backend/crm-barber/.env`, diferente da produção:
```
APP_ENV=staging
APP_DEBUG=false
APP_URL=https://staging-api.SEUDOMINIO.com
FRONTEND_URL=https://staging.SEUDOMINIO.com
DB_DATABASE=crm_barber_staging
DB_USERNAME=<usuário do staging>
DB_PASSWORD=<senha do staging>
MESSAGE_SERVICE_URL=http://127.0.0.1:3001/
```
No `messages-service/.env`: `PORT=3001`. No `front-end/js/env.js`:
`API_BASE_URL: "https://staging-api.SEUDOMINIO.com/api"`.

```bash
cd backend/crm-barber
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
cd ../.. && chown -R www-data:www-data /var/www/crm-barber-staging
```

### 2.4 Processos de fundo
```bash
cd /var/www/crm-barber-staging
for s in queue scheduler node; do
  sed 's#/var/www/crm-barber#/var/www/crm-barber-staging#; s#^Description=CRM-Barber#Description=CRM-Barber STAGING#' \
    deploy/systemd/crm-$s.service | sudo tee /etc/systemd/system/crm-$s-staging.service >/dev/null
done
sudo systemctl daemon-reload
sudo systemctl enable --now crm-queue-staging crm-scheduler-staging crm-node-staging
```

---

## 3. Fluxo de deploy

```bash
# staging
cd /var/www/crm-barber-staging
APP_DIR=$PWD SERVICE_SUFFIX=-staging HEALTH_URL=https://staging-api.SEUDOMINIO.com/up \
  ./deploy/deploy.sh

# testou no staging? produção:
cd /var/www/crm-barber
HEALTH_URL=https://api.SEUDOMINIO.com/up ./deploy/deploy.sh
```

O `deploy.sh` (detalhes no cabeçalho do script) recusa rodar com arquivos
editados à mão, faz backup antes de migrations pendentes, coloca a API em
manutenção só durante o `migrate`, recarrega caches e reinicia fila/scheduler/Node.
O commit anterior é impresso no início para rollback.

---

## 4. Backup off-site

O backup local some junto com a VPS. Para mandar cada dump para fora:

1. Crie um bucket no Backblaze B2 (ou S3) com lifecycle de ~30 dias
2. `sudo apt install rclone && rclone config` → remote chamado `b2`
3. No cron do backup, adicione `RCLONE_REMOTE=b2:NOME-DO-BUCKET`:
   ```
   0 3 * * * DB_PASSWORD='...' RCLONE_REMOTE=b2:crm-barber-backups /var/www/crm-barber/scripts/backup-mysql.sh >> /var/log/crm-barber-backup.log 2>&1
   ```
4. Teste o restore de um dump baixado do bucket no banco de staging — backup
   que nunca foi restaurado não conta.

---

## 5. Monitoramento

- **UptimeRobot** (grátis): monitorar `https://api.SEUDOMINIO.com/up`,
  `https://agendar.SEUDOMINIO.com/` e o `/health` do Node (se exposto)
- **Sentry**: `composer require sentry/sentry-laravel` + `SENTRY_LARAVEL_DSN` no `.env`;
  no Node, `@sentry/node` — fica para quando o DSN estiver criado
