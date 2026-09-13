#!/usr/bin/env bash
# ==========================================================================
#  Backup diário do MySQL do CRM-Barber.
#
#  Uso:
#    ./backup-mysql.sh
#
#  Variáveis de ambiente (todas opcionais, com padrão sensato):
#    DB_HOST      (default: 127.0.0.1)
#    DB_PORT      (default: 3306)
#    DB_DATABASE  (default: crm_barber)
#    DB_USERNAME  (default: root)
#    DB_PASSWORD  (default: vazio)
#    BACKUP_DIR   (default: /var/backups/crm-barber)
#    KEEP_DAYS    (default: 14 — dumps mais velhos que isso são apagados)
#
#  Cron sugerido (todo dia às 3h da manhã):
#    0 3 * * * DB_PASSWORD='...' /caminho/pro/scripts/backup-mysql.sh >> /var/log/crm-barber-backup.log 2>&1
# ==========================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="${DB_DATABASE:-crm_barber}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/crm-barber}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="$BACKUP_DIR/${DB_DATABASE}_${TIMESTAMP}.sql.gz"

MYSQL_PWD="$DB_PASSWORD" mysqldump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --user="$DB_USERNAME" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_DATABASE" \
  | gzip > "$DUMP_FILE"

echo "[$(date -Iseconds)] backup criado: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

# apaga backups mais velhos que KEEP_DAYS
find "$BACKUP_DIR" -name "${DB_DATABASE}_*.sql.gz" -mtime "+${KEEP_DAYS}" -print -delete

echo "[$(date -Iseconds)] backups mantidos (últimos ${KEEP_DAYS} dias):"
ls -lh "$BACKUP_DIR"/"${DB_DATABASE}"_*.sql.gz 2>/dev/null || echo "(nenhum)"
