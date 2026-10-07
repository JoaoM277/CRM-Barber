#!/usr/bin/env bash
# ==========================================================================
#  Deploy do CRM-Barber na VPS.
#
#  Layout (CloudPanel): API e front são clones separados do mesmo repositório,
#  cada um com o usuário do seu site.
#    API  (Laravel + fila + scheduler + Node): $API_DIR,   dono $API_USER
#    Front (estático: app.* e barber.*):       $FRONT_DIR, dono $FRONT_USER
#
#  Uso (na VPS, como um usuário com sudo):
#    ./deploy.sh              # API + front
#    ./deploy.sh api          # só a API
#    ./deploy.sh front        # só o front
#
#  Variáveis de ambiente (opcionais; os padrões são a produção atual):
#    API_DIR         (default: /home/api/htdocs/api.crm-barber.local)
#    API_USER        (default: api)
#    FRONT_DIR       (default: /home/app/htdocs/app.usevellis.tech)
#    FRONT_USER      (default: app)
#    BRANCH          (default: branch atual de cada clone)
#    PHP_BIN         (default: php8.5 — mesma versão dos serviços systemd)
#    SERVICE_SUFFIX  (default: vazio — ex.: "-staging" usa crm-queue-staging etc.)
#    SKIP_BACKUP     (default: 0 — 1 pula o backup antes de migrations pendentes)
#    HEALTH_URL      (default: https://api.usevellis.tech/up — vazio desliga)
#    DISCARD         (default: vazio — arquivos versionados que podem ser
#                     descartados se estiverem modificados na VPS, separados
#                     por espaço; ex.: "messages-service/package-lock.json")
#
#  O que faz, em cada clone:
#    1. Recusa rodar com arquivos versionados modificados (evita perder ajuste local)
#    2. git pull --ff-only
#  e na API, além disso:
#    3. composer install --no-dev + caches do Laravel
#    4. Se houver migration pendente: backup do banco -> modo manutenção -> migrate
#    5. npm ci do messages-service (se o package-lock mudou ou falta node_modules)
#    6. Reinicia fila, scheduler e Node; health check
#
#  Rollback: o commit anterior de cada clone é impresso no início. Para voltar:
#    sudo -u <dono> git -C <clone> checkout <commit>   (e rode as etapas da API à mão)
#  Migrations não são revertidas automaticamente — use o backup se precisar.
# ==========================================================================
set -euo pipefail

# o git pull pode reescrever este arquivo no meio da execução — roda de uma cópia
if [ -z "${CRM_DEPLOY_COPY:-}" ]; then
  tmp="$(mktemp /tmp/crm-deploy.XXXXXX.sh)"
  cp "$0" "$tmp"
  CRM_DEPLOY_COPY="$tmp" exec bash "$tmp" "$@"
fi
rm -f "$CRM_DEPLOY_COPY"   # o bash já está com o arquivo aberto; no Linux pode apagar

TARGET="${1:-all}"
case "$TARGET" in all|api|front) ;; *) echo "uso: $0 [all|api|front]"; exit 2 ;; esac

API_DIR="${API_DIR:-/home/api/htdocs/api.crm-barber.local}"
API_USER="${API_USER:-api}"
FRONT_DIR="${FRONT_DIR:-/home/app/htdocs/app.usevellis.tech}"
FRONT_USER="${FRONT_USER:-app}"
PHP_BIN="${PHP_BIN:-php8.5}"
SERVICE_SUFFIX="${SERVICE_SUFFIX:-}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
HEALTH_URL="${HEALTH_URL-https://api.usevellis.tech/up}"
DISCARD="${DISCARD:-}"

log() { echo "[$(date '+%H:%M:%S')] $*" >&2; }

# roda um comando como o dono do clone
as() {
  local user="$1"; shift
  if [ "$(id -un)" = "$user" ]; then "$@"; else sudo -u "$user" -H "$@"; fi
}

# atualiza um clone; imprime "PREV NEW" no stdout (o resto vai pro stderr)
update_clone() {
  local dir="$1" user="$2" branch prev new
  branch="${BRANCH:-$(as "$user" git -C "$dir" rev-parse --abbrev-ref HEAD)}"

  for f in $DISCARD; do
    if ! as "$user" git -C "$dir" diff --quiet -- "$f"; then
      log "descartando modificação local em $f (DISCARD)"
      as "$user" git -C "$dir" checkout -- "$f"
    fi
  done

  if ! as "$user" git -C "$dir" diff --quiet || ! as "$user" git -C "$dir" diff --cached --quiet; then
    log "ERRO: arquivos versionados modificados em $dir:"
    as "$user" git -C "$dir" status --short --untracked-files=no >&2
    log "Mova o ajuste para o .env/env.js ou o repositório (ou use DISCARD=...)."
    return 1
  fi

  prev="$(as "$user" git -C "$dir" rev-parse HEAD)"
  log "$dir: commit atual $prev ($branch) — anote para rollback"
  as "$user" git -C "$dir" fetch --quiet origin "$branch"
  as "$user" git -C "$dir" checkout --quiet "$branch"
  as "$user" git -C "$dir" pull --ff-only --quiet origin "$branch"
  new="$(as "$user" git -C "$dir" rev-parse HEAD)"

  if [ "$prev" = "$new" ]; then
    log "$dir: já estava atualizado"
  else
    log "$dir: atualizado para $new"
    as "$user" git -C "$dir" log --oneline "$prev..$new" >&2
  fi
  echo "$prev $new"
}

# ---------------------------------------------------------------- front
if [ "$TARGET" != "api" ]; then
  log "===== FRONT"
  update_clone "$FRONT_DIR" "$FRONT_USER" >/dev/null
  if ! sudo test -f "$FRONT_DIR/front-end/js/env.js"; then
    log "AVISO: $FRONT_DIR/front-end/js/env.js não existe — o front vai procurar a API em :8000."
    log "       Crie a partir de front-end/js/env.example.js."
  fi
fi

# ---------------------------------------------------------------- API
if [ "$TARGET" != "front" ]; then
  log "===== API"
  CLONE_OUT="$(update_clone "$API_DIR" "$API_USER")"
  read -r PREV NEW <<<"$CLONE_OUT"
  BACKEND_DIR="$API_DIR/backend/crm-barber"
  NODE_DIR="$API_DIR/messages-service"
  # env -C: troca de pasta já como o dono (o usuário do deploy não entra em /home/<site>)
  art() { as "$API_USER" env -C "$BACKEND_DIR" "$PHP_BIN" artisan "$@"; }

  log "composer install"
  as "$API_USER" env -C "$BACKEND_DIR" "$PHP_BIN" "$(command -v composer)" install \
      --no-dev --optimize-autoloader --no-interaction --no-progress

  MIGRATE_STATUS="$(art migrate:status)"   # falha aqui se o banco estiver fora
  if grep -qw "Pending" <<<"$MIGRATE_STATUS"; then
    log "Há migrations pendentes:"
    grep -w "Pending" <<<"$MIGRATE_STATUS" >&2
    if [ "$SKIP_BACKUP" != "1" ]; then
      log "Backup do banco antes de migrar"
      (
        set -a
        # shellcheck disable=SC1090
        . <(sudo grep -E '^DB_(HOST|PORT|DATABASE|USERNAME|PASSWORD)=' "$BACKEND_DIR/.env" | sed 's/\r$//')
        set +a
        BACKUP_DIR="${BACKUP_DIR:-/var/backups/crm-barber}"
        sudo --preserve-env=DB_HOST,DB_PORT,DB_DATABASE,DB_USERNAME,DB_PASSWORD,BACKUP_DIR \
          bash "$API_DIR/scripts/backup-mysql.sh"
      )
    fi
    art down --retry=15
    trap 'art up' EXIT
    art migrate --force
    art up
    trap - EXIT
  else
    log "Sem migrations pendentes."
  fi

  log "Caches do Laravel"
  art optimize:clear >/dev/null
  art optimize >/dev/null

  if ! sudo test -d "$NODE_DIR/node_modules" || \
     ! as "$API_USER" git -C "$API_DIR" diff --quiet "$PREV" "$NEW" -- messages-service/package-lock.json; then
    log "npm ci (messages-service)"
    as "$API_USER" env -C "$NODE_DIR" npm ci --omit=dev --no-audit --no-fund
  fi

  log "Reiniciando serviços"
  art queue:restart >/dev/null
  sudo systemctl restart "crm-scheduler$SERVICE_SUFFIX" "crm-node$SERVICE_SUFFIX"
  sudo systemctl is-active --quiet "crm-queue$SERVICE_SUFFIX" || sudo systemctl restart "crm-queue$SERVICE_SUFFIX"
  for s in queue scheduler node; do
    log "  crm-$s$SERVICE_SUFFIX: $(systemctl is-active "crm-$s$SERVICE_SUFFIX")"
  done

  if [ -n "$HEALTH_URL" ]; then
    sleep 2
    STATUS="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
    [ "$STATUS" = "200" ] || { log "ERRO: health check em $HEALTH_URL respondeu $STATUS"; exit 1; }
    log "Health check OK ($HEALTH_URL)"
  fi
fi

log "Deploy concluído."
