# 9. Verify the installation

[← nginx](08-nginx-and-tls.md) · [Index](README.md) · [Next: Troubleshooting →](10-troubleshooting.md)

Work through all four sections. `systemctl is-active` is not evidence that
anything works — it only means a process has not exited.

## 9.1 Services

```bash
for u in <INSTANCE> <INSTANCE>-celery-worker <INSTANCE>-celery-beat \
         <INSTANCE>-celery-worker-background redis-<REDIS_PORT>; do
  printf '%-52s %s\n' "$u" "$(systemctl is-active $u)"
done
```

All five `active`.

They must also be enabled, or the instance disappears at the next reboot:

```bash
for u in <INSTANCE> <INSTANCE>-celery-worker <INSTANCE>-celery-beat \
         <INSTANCE>-celery-worker-background redis-<REDIS_PORT>; do
  printf '%-52s %s\n' "$u" "$(systemctl is-enabled $u)"
done
```

All five `enabled`.

## 9.2 The web tier

```bash
curl -s -o /dev/null -w "local  health -> %{http_code}\n" \
     http://127.0.0.1:<GUNICORN_PORT>/health
curl -s -o /dev/null -w "public health -> %{http_code}\n" https://<DOMAIN>/health
curl -s -o /dev/null -w "public login  -> %{http_code}\n" https://<DOMAIN>/login/
curl -s -o /dev/null -w "http redirect -> %{http_code} -> %{redirect_url}\n" \
     http://<DOMAIN>/
```

`200`, `200`, `200`, `301`.

### Log in as a real user

```bash
J=$(mktemp)
TOK=$(curl -s -c $J https://<DOMAIN>/login/ \
      | grep -oP 'name="csrf_token"[^>]*value="\K[^"]+' | head -1)
curl -s -b $J -c $J -o /dev/null -w "login POST -> %{http_code}\n" \
     -d "csrf_token=$TOK&username=admin&password=<ADMIN_PASSWORD>" \
     https://<DOMAIN>/login/
curl -s -b $J -o /dev/null -w "welcome    -> %{http_code}\n" \
     https://<DOMAIN>/superset/welcome/
rm -f $J
```

`302` then `200`. A `200` on the login POST means the login **failed** and the
form was re-rendered with an error.

Then open `https://<DOMAIN>/` in a real browser and check the UI renders. If
you get a blank page with 404s for `/static/assets/…` in the browser console,
the frontend assets are missing — see
[§4.3](04-application-code.md#43-frontend-assets).

## 9.3 Celery — prove a job actually runs

This is the check that most installs skip and most broken installs fail.

Both workers must answer, and on **your** broker:

```bash
sudo -u <APP_USER> bash -c '
  set -a; . <ENV_FILE>; set +a
  cd <APP_DIR>; export PYTHONPATH=<APP_DIR>
  ./.venv/bin/celery -A superset.tasks.celery_app:app \
     -b redis://127.0.0.1:<REDIS_PORT>/0 inspect ping' 2>&1 | tail -6
```

Expect two `OK`/`pong` entries and `2 nodes online.` — the default worker and
the background worker.

Check the queue split is right:

```bash
sudo -u <APP_USER> bash -c '
  set -a; . <ENV_FILE>; set +a
  cd <APP_DIR>; export PYTHONPATH=<APP_DIR>
  ./.venv/bin/celery -A superset.tasks.celery_app:app \
     -b redis://127.0.0.1:<REDIS_PORT>/0 inspect active_queues' \
  | grep -o "'name': '[a-z]*'" | sort -u
```

You want `'name': 'celery'` and `'name': 'background'` — one each.

### The end-to-end round trip

Ping proves the workers are alive. This proves the whole chain works: the app
can enqueue a job, a worker picks it up, runs it, and the result comes back
through the results backend.

```bash
sudo -u <APP_USER> bash -c '
  set -a; . <ENV_FILE>; set +a
  cd <APP_DIR>; export PYTHONPATH=<APP_DIR>
  ./.venv/bin/python - <<PY
from superset.app import create_app
app = create_app()
with app.app_context():
    from superset.tasks.celery_app import app as celery_app
    r = celery_app.send_task("reports.prune_log")
    print("task id:", r.id)
    try:
        r.get(timeout=60)
        print("ROUND_TRIP_OK")
    except Exception as e:
        print("ROUND_TRIP_FAILED:", type(e).__name__, e)
PY' 2>&1 | tail -3
```

`ROUND_TRIP_OK` means Redis, the worker, the metadata database and the results
backend are all wired up correctly.

If it times out, the job was queued but nothing consumed it — almost always
because the worker is on a different Redis than the app. Compare:

```bash
grep 'Connected to redis' /var/log/<INSTANCE>/celery-worker.log | tail -1
sudo -u <APP_USER> bash -c '. <ENV_FILE>; echo "app  -> $SUPERSET_REDIS_PORT"'
```

Beat should be scheduling:

```bash
tail -5 /var/log/<INSTANCE>/celery-beat.log
```

Expect `beat: Starting...` and, once an interval passes, `Scheduler: Sending
due task …`.

## 9.4 Isolation — prove you did not touch anything else

Skip this only if this is the only instance on the server.

### Other sites still serve

```bash
for u in https://<OTHER_SITE_1>/login/ https://<OTHER_SITE_2>/login/; do
  curl -s -o /dev/null -w "%{http_code}  $u\n" "$u"
done
```

### Nothing is shared

```bash
# Distinct gunicorn ports
sudo ss -tlnp | grep gunicorn

# Distinct Redis processes
sudo ss -tlnp | grep redis

# A key written here must not appear there
redis-cli -p <REDIS_PORT> set iso_probe x
redis-cli -p <OTHER_REDIS_PORT> get iso_probe     # expect (nil)
redis-cli -p <REDIS_PORT> del iso_probe

# Distinct metadata databases and roles
sudo -u <APP_USER> bash -c '. <ENV_FILE>; \
  echo "$SUPERSET_DATABASE_URI" | sed "s/:[^:@]*@/:***@/"'
```

### No other instance's resources appear in the config

```bash
grep -nE '<OTHER_PORT>|<OTHER_REDIS_PORT>|<OTHER_DB_NAME>|<OTHER_APP_DIR>' \
  <APP_DIR>/superset_config.py <ENV_FILE>
```

Anything outside a comment is a bug.

### Secrets differ

```bash
sudo grep SUPERSET_SECRET_KEY <ENV_FILE> <OTHER_ENV_FILE>
```

The two values must not match.

### The scheduler cannot email people

For any instance that is not production:

```bash
grep -n 'EMAIL_NOTIFICATIONS' <APP_DIR>/superset_config.py       # want False
grep -n 'reports.scheduler'  <APP_DIR>/superset_config.py       # want only comments
```

## 9.5 File permissions

```bash
ls -la <ENV_FILE>                        # -rw-r----- root <APP_USER>
ls -la <APP_DIR>/superset_config.py      # -rw-r----- <APP_USER> <APP_USER>
```

Neither should be world-readable; both contain credentials.

## 9.6 Reboot safety

The most common "it worked yesterday" cause is a unit that was started but
never enabled. If you can take an outage, prove it:

```bash
sudo systemctl reboot
# then, once it is back:
systemctl is-active <INSTANCE> <INSTANCE>-celery-worker \
                    <INSTANCE>-celery-beat <INSTANCE>-celery-worker-background \
                    redis-<REDIS_PORT>
curl -s -o /dev/null -w "%{http_code}\n" https://<DOMAIN>/health
```

If you cannot reboot, the `is-enabled` check in §9.1 is the next best thing.

## 9.7 Sign-off checklist

- [ ] All five services `active` **and** `enabled`
- [ ] `https://<DOMAIN>/health` returns 200
- [ ] HTTP redirects to HTTPS; certificate valid
- [ ] Admin can log in through the browser and the UI renders
- [ ] Read-only user can log in; write via API returns 403
- [ ] `inspect ping` shows 2 nodes; queues are `celery` and `background`
- [ ] Celery round trip prints `ROUND_TRIP_OK`
- [ ] `db current` equals `db heads`
- [ ] Other sites on the server still return 200
- [ ] Redis, database, ports, unit names and `SECRET_KEY` all distinct
- [ ] `EMAIL_NOTIFICATIONS = False` if this is not production
- [ ] Env file is `0640`, not world-readable
- [ ] Metadata database included in the backup schedule

---

[← nginx](08-nginx-and-tls.md) · [Index](README.md) · [Next: Troubleshooting →](10-troubleshooting.md)
