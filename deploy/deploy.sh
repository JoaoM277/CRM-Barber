#!/usr/bin/env bash
# ==========================================================================
#  Deploy do CRM-Barber na VPS (produção ou staging).
#
#  Uso (na VPS):
#    ./deploy/deploy.sh                 # produção, com os padrões abaixo
#    APP_DIR=/var/www/crm-barber-staging BRANCH=main \
#      SERVICE_SUFFIX=-staging ./deploy/deploy.sh   # staging
#
#  Variáveis de ambiente (todas opcionais):
#    APP_DIR         (default: /var/www/crm-barber)
#    BRANCH          (default: branch atual do checkout)
#    APP_USER        (default: www-data — dono dos arquivos; comandos de app rodam como ele)
#    SERVICE_SUFFIX  (default: vazio — ex.: "-staging" usa crm-queue-staging etc.)
#    SKIP_BACKUP     (default: 0 — 1 pula o backup antes de migrations pendentes)
#    HEALTH_URL      (default: vazio — se definido, faz GET nele no final e falha se != 200)
#
#  O que faz:
#    1. Recusa rodar com arquivos versionados modificados na VPS (evita perder ajuste local)
#    2. git pull --ff-only
#    3. composer install --no-dev + caches do Laravel
#    4. Se houver migration pendente: backup do banco -> modo manutenção -> migrate
#    5. npm ci do messages-service (só se o package-lock mudou)
#    6. Reinicia fila, scheduler e Node
#    7. Health check opcional
#
#  Rollback rápido: o commit anterior é impresso no início. Para voltar:
#    git -C "$APP_DIR" checkout <commit> && ./deploy/deploy.sh
#  (migrations não são revertidas automaticamente — use o backup se precisar)
# ==========================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/crm-barber}"
APP_USER="${APP_USER:-www-data}"
SERVICE_SUFFIX="${SERVICE_SUFFIX:-}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
HEALTH_URL="${HEALTH_URL:-}"

BACKEND_DIR="$APP_DIR/backend/crm-barber"
NODE_DIR="$APP_DIR/messages-service"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# roda como o dono dos arquivos (se o script estiver rodando como root)
as_app() {
  if [ "$(id -un)" = "$APP_USER" ]; then
    "$@"
  else
    sudo -u "$APP_USER" -H "$@"
  fi
}

cd "$APP_DIR"
BRANCH="${BRANCH:-$(as_app git rev-parse --abbrev-ref HEAD)}"

# 1. working tree limpo
if ! as_app git diff --quiet || ! as_app git diff --cached --quiet; then
  log "ERRO: há arquivos versionados modificados na VPS:"
  as_app git status --short --untracked-files=no
  log "Mova esses ajustes para o .env / repositório antes de fazer deploy."
  exit 1
fi

PREV_COMMIT="$(as_app git rev-parse HEAD)"
log "Commit atual: $PREV_COMMIT (anote para rollback)"

# 2. atualiza código
as_app git fetch --quiet origin "$BRANCH"
as_app git checkout --quiet "$BRANCH"
as_app git pull --ff-only --quiet origin "$BRANCH"
NEW_COMMIT="$(as_app git rev-parse HEAD)"

if [ "$PREV_COMMIT" = "$NEW_COMMIT" ]; then
  log "Nada novo em origin/$BRANCH. Seguindo mesmo assim (caches/restart)."
else
  log "Atualizado para $NEW_COMMIT:"
  as_app git log --oneline "$PREV_COMMIT..$NEW_COMMIT"
fi

changed() { as_app git diff --name-only "$PREV_COMMIT" "$NEW_COMMIT" -- "$@" | grep -q .; }

# 3. backend
cd "$BACKEND_DIR"
log "composer install"
as_app composer install --no-dev --optimize-autoloader --no-interaction --no-progress

# 4. migrations
MIGRATE_STATUS="$(as_app php artisan migrate:status)"   # falha aqui se o banco estiver fora
if grep -qw "Pending" <<<"$MIGRATE_STATUS"; then
  log "Há migrations pendentes."
  if [ "$SKIP_BACKUP" != "1" ]; then
    log "Backup do banco antes de migrar"
    # lê as credenciais do .env do Laravel
    set -a
    # shellcheck disable=SC1091
    . <(grep -E '^DB_(HOST|PORT|DATABASE|USERNAME|PASSWORD)=' .env | sed 's/\r$//')
    set +a
    "$APP_DIR/scripts/backup-mysql.sh"
  fi
  as_app php artisan down --retry=15
  trap 'as_app php artisan up' EXIT
  as_app php artisan migrate --force
  as_app php artisan up
  trap - EXIT
else
  log "Sem migrations pendentes."
fi

log "Caches do Laravel"
as_app php artisan optimize:clear >/dev/null
as_app php artisan optimize

# 5. Node
if [ ! -d "$NODE_DIR/node_modules" ] || changed messages-service/package-lock.json; then
  log "npm ci (messages-service)"
  (cd "$NODE_DIR" && as_app npm ci --omit=dev --no-audit --no-fund)
fi

# 6. processos de fundo
log "Reiniciando serviços"
as_app php artisan queue:restart
sudo systemctl restart "crm-scheduler$SERVICE_SUFFIX" "crm-node$SERVICE_SUFFIX"
sudo systemctl is-active --quiet "crm-queue$SERVICE_SUFFIX" || sudo systemctl restart "crm-queue$SERVICE_SUFFIX"

# 7. health check
if [ -n "$HEALTH_URL" ]; then
  sleep 2
  STATUS="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  if [ "$STATUS" != "200" ]; then
    log "ERRO: health check em $HEALTH_URL respondeu $STATUS"
    exit 1
  fi
  log "Health check OK ($HEALTH_URL)"
fi

log "Deploy concluído: $NEW_COMMIT"
