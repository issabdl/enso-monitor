#!/bin/sh
# Sauvegarde quotidienne de PostgreSQL (à lancer depuis la racine du projet, par cron).
#   0 3 * * * cd /srv/enso-monitor && ./deploy/backup.sh >> /var/log/enso-backup.log 2>&1
# Restauration :
#   docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean < backups/enso-AAAA-MM-JJ.dump
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Identifiants lus dans .env (jamais en dur dans le script)
set -a
. ./.env
set +a

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/enso-$(date +%F).dump"

docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$FILE"
echo "$(date -Iseconds) sauvegarde créée : $FILE ($(du -h "$FILE" | cut -f1))"

# Rotation : suppression des sauvegardes plus anciennes que la durée de conservation
find "$BACKUP_DIR" -name 'enso-*.dump' -mtime +"$RETENTION_DAYS" -delete

# Copie hors du serveur (à configurer, ex. rclone vers un stockage objet) :
# rclone copy "$FILE" remote:enso-backups/
