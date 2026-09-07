# 11. Day-to-day operations

[← Troubleshooting](10-troubleshooting.md) · [Index](README.md)

## 11.1 Restarting

Order matters when the configuration has changed. Stop the things that produce
work before the things that consume it, and bring them back in reverse:

```bash
# Stop
sudo systemctl stop <INSTANCE>-celery-beat
sudo systemctl stop <INSTANCE>-celery-worker-background
sudo systemctl stop <INSTANCE>-celery-worker
sudo systemctl stop <INSTANCE>

# Start
sudo systemctl start <INSTANCE>
sudo systemctl start <INSTANCE>-celery-worker
sudo systemctl start <INSTANCE>-celery-worker-background
sudo systemctl start <INSTANCE>-celery-beat
```

For a code change with no config change, a plain restart of all four is fine:

```bash
sudo systemctl restart <INSTANCE> <INSTANCE>-celery-worker \
     <INSTANCE>-celery-beat <INSTANCE>-celery-worker-background
```

> **Warning**
> After editing `<ENV_FILE>` or `superset_config.py`, restart **all four**.
> Restarting only the web service leaves the workers running the old
> configuration — and if `SECRET_KEY` was among the changes, the two halves can
> no longer decrypt each other's data.

Editing a systemd unit needs a reload first:

```bash
sudo systemctl daemon-reload
sudo systemctl restart <INSTANCE>
```

## 11.2 Deploying new code

```bash
cd <APP_DIR>
sudo -u <APP_USER> git pull

# If requirements changed
sudo -u <APP_USER> ./.venv/bin/pip install -r requirements/moh.txt

# If the frontend changed -- see §4.3 for the copy-instead-of-build shortcut
cd <APP_DIR>/superset-frontend && sudo -u <APP_USER> npm ci && sudo -u <APP_USER> npm run build

# Always, after a pull: apply any new migrations
sudo -u <APP_USER> <INSTANCE>-cli db upgrade

sudo systemctl restart <INSTANCE> <INSTANCE>-celery-worker \
     <INSTANCE>-celery-beat <INSTANCE>-celery-worker-background
```

Back up the metadata database before `db upgrade`. Migrations are not reliably
reversible.

## 11.3 Backups

The metadata database holds every dashboard, chart and user. Nothing else in
this installation is irreplaceable — the code is in git and the caches rebuild
themselves.

```bash
PGPASSWORD='<PG_PASSWORD>' pg_dump -h 127.0.0.1 -p 5432 -U <PG_USER> \
  -d '<PG_DB>' -Fc -f /var/backups/<INSTANCE>-$(date +%F).dump
```

Restore:

```bash
PGPASSWORD='<PG_PASSWORD>' pg_restore -h 127.0.0.1 -p 5432 -U <PG_USER> \
  -d '<PG_DB>' --clean --if-exists /var/backups/<INSTANCE>-<DATE>.dump
```

Also keep a copy of `<ENV_FILE>` somewhere safe and access-controlled. Losing
`SECRET_KEY` means every stored data-source password becomes undecryptable, and
you will be re-entering all of them by hand.

> **Warning**
> If you restore a dump **from a different instance**, its data-source passwords
> are encrypted with *that* instance's `SECRET_KEY`. Re-encrypt them once,
> immediately after the restore:
>
> ```bash
> sudo -u <APP_USER> bash -c '
>   set -a; . <ENV_FILE>; set +a
>   export SUPERSET_PREVIOUS_SECRET_KEY="<THE_SOURCE_INSTANCE_KEY>"
>   cd <APP_DIR>; export PYTHONPATH=<APP_DIR>
>   ./.venv/bin/superset re-encrypt-secrets'
> ```
>
> And remember that the dump also carries the source instance's alerts and
> scheduled reports, enabled and addressed to real recipients. Confirm
> `EMAIL_NOTIFICATIONS = False` and that `reports.scheduler` is absent from the
> beat schedule *before* you start Celery beat.

## 11.4 Logs

| What | Where |
|---|---|
| Web access/errors | `/var/log/<INSTANCE>/gunicorn-{access,error}.log` |
| Celery worker | `/var/log/<INSTANCE>/celery-worker.log` |
| Celery beat | `/var/log/<INSTANCE>/celery-beat.log` |
| Background worker | `/var/log/<INSTANCE>/celery-background.log` |
| nginx, per site | `/var/log/nginx/<INSTANCE>.{access,error}.log` |
| Service start/stop | `journalctl -u <INSTANCE>` |

Add log rotation, or these will fill the disk:

```bash
sudo tee /etc/logrotate.d/<INSTANCE> > /dev/null <<'EOF2'
/var/log/<INSTANCE>/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF2
```

`copytruncate` avoids having to signal the processes to reopen their files.

## 11.5 Routine health check

```bash
#!/bin/bash
# /usr/local/bin/<INSTANCE>-healthcheck
for u in <INSTANCE> <INSTANCE>-celery-worker <INSTANCE>-celery-beat \
         <INSTANCE>-celery-worker-background redis-<REDIS_PORT>; do
  printf '%-52s %s\n' "$u" "$(systemctl is-active $u)"
done
curl -s -o /dev/null -w "health   -> %{http_code}\n" https://<DOMAIN>/health
redis-cli -p <REDIS_PORT> ping | sed 's/^/redis    -> /'
echo "queue depth (should not grow without bound):"
redis-cli -p <REDIS_PORT> llen celery     | sed 's/^/  celery     /'
redis-cli -p <REDIS_PORT> llen background | sed 's/^/  background /'
df -h /var | tail -1
```

A queue depth that only ever grows means a worker is down or crash-looping.

## 11.6 Adding users

Through the UI: **Settings → List Users → +**.

From the command line:

```bash
sudo -u <APP_USER> <INSTANCE>-cli fab create-user \
  --role Gamma --username <U> --firstname <F> --lastname <L> \
  --email <E> --password '<P>'
```

Remember from [§6.5](06-initialise-and-users.md#gamma-is-not-read-only) that
`Gamma` can create and edit dashboards. For a genuinely read-only account, use
the `ReadOnly` role built there.

Reset a password:

```bash
sudo -u <APP_USER> <INSTANCE>-cli fab reset-password \
  --username <U> --password '<NEW>'
```

## 11.7 Removing the instance

In this order, so nothing restarts while you are deleting its files:

```bash
sudo systemctl disable --now <INSTANCE> <INSTANCE>-celery-worker \
     <INSTANCE>-celery-beat <INSTANCE>-celery-worker-background
sudo rm /etc/systemd/system/<INSTANCE>*.service
sudo systemctl daemon-reload

# Redis instance
sudo systemctl disable --now redis-<REDIS_PORT>
sudo rm /etc/systemd/system/redis-<REDIS_PORT>.service \
        /etc/redis/redis-<REDIS_PORT>.conf
sudo rm -rf /var/lib/redis-<REDIS_PORT>

# nginx -- remove the server block, then:
sudo nginx -t && sudo systemctl reload nginx

# Take a final backup BEFORE dropping anything
PGPASSWORD='<PG_PASSWORD>' pg_dump -h 127.0.0.1 -U <PG_USER> -d '<PG_DB>' -Fc \
  -f /var/backups/<INSTANCE>-final.dump
sudo -u postgres psql -c 'DROP DATABASE "<PG_DB>"'
sudo -u postgres psql -c 'DROP ROLE "<PG_USER>"'

sudo rm -rf <APP_DIR> /etc/<INSTANCE> /var/log/<INSTANCE>
```

Because every resource is this instance's own, none of these commands can
affect another instance. That is the payoff for the isolation work in
[§1.5](01-prerequisites.md#15-plan-your-resources--fill-this-in-before-you-continue).

---

[← Troubleshooting](10-troubleshooting.md) · [Index](README.md)
