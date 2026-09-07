# 7. systemd services

[← Initialise](06-initialise-and-users.md) · [Index](README.md) · [Next: nginx →](08-nginx-and-tls.md)

You need four units. They all run as `<APP_USER>`, all read the same
`<ENV_FILE>`, and all set `WorkingDirectory=<APP_DIR>` — which, as explained in
[§4.2](04-application-code.md#superset-is-not-installed-as-a-package--this-is-the-key-fact),
is what decides which copy of the code each one runs.

| Unit | Role |
|---|---|
| `<INSTANCE>.service` | gunicorn — the web tier |
| `<INSTANCE>-celery-worker.service` | default queue — interactive chart queries |
| `<INSTANCE>-celery-beat.service` | the scheduler |
| `<INSTANCE>-celery-worker-background.service` | `background` queue — slow scheduled work |

## 7.1 Why the queue is split in two

Beat schedules an hourly cache warm-up that fetches roughly 186 charts. On a
single queue, that burst occupies every worker slot, and a user who opens a
dashboard at that moment waits behind it.

So `task_routes` in `superset_config.py` sends warm-up, thumbnails and report
pruning to a `background` queue, and a second worker consumes only that queue.
The first worker never sees them and stays free for live traffic.

This only works if both workers are running. A `background` worker that is down
means warm-up jobs pile up in Redis forever, consuming memory.

## 7.2 The web unit

```bash
sudo tee /etc/systemd/system/<INSTANCE>.service > /dev/null <<'UNIT'
[Unit]
Description=Gunicorn instance to serve <INSTANCE>
After=network.target postgresql.service redis-<REDIS_PORT>.service
Wants=redis-<REDIS_PORT>.service

[Service]
LimitNOFILE=65535
User=<APP_USER>
Group=<APP_USER>

# Superset is imported from this directory, not from site-packages.
# This line is what makes the service run THIS instance's code.
WorkingDirectory=<APP_DIR>
Environment="PATH=<APP_DIR>/.venv/bin"
EnvironmentFile=<ENV_FILE>

# RuntimeDirectoryPreserve=yes because all four units declare the same
# directory; without it, stopping any one of them deletes it from under the
# other three.
RuntimeDirectory=<INSTANCE>
RuntimeDirectoryMode=0750
RuntimeDirectoryPreserve=yes
LogsDirectory=<INSTANCE>
LogsDirectoryMode=0750

TimeoutStartSec=180

ExecStart=<APP_DIR>/.venv/bin/gunicorn \
    --workers 4 \
    --worker-class gthread \
    --threads 4 \
    --timeout 120 \
    --graceful-timeout 60 \
    --keep-alive 5 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --worker-tmp-dir /run/<INSTANCE> \
    --pid /run/<INSTANCE>/gunicorn.pid \
    --limit-request-line 0 \
    --limit-request-field_size 0 \
    --access-logfile /var/log/<INSTANCE>/gunicorn-access.log \
    --error-logfile /var/log/<INSTANCE>/gunicorn-error.log \
    --capture-output \
    --bind 127.0.0.1:<GUNICORN_PORT> \
    superset.app:create_app()

Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=<INSTANCE>

[Install]
WantedBy=multi-user.target
UNIT
```

### What the gunicorn flags mean

| Flag | Why |
|---|---|
| `--workers 4 --threads 4` | 16 concurrent requests. One dashboard fans out into dozens of chart requests, so this is smaller than it sounds. Size it against the other instances sharing the CPU. |
| `--worker-class gthread` | Threads, not processes, per request. Superset is I/O-bound — it waits on databases. |
| `--timeout 120` | Kill a worker stuck longer than this. Must match `SUPERSET_WEBSERVER_TIMEOUT` and stay **below** nginx's `proxy_read_timeout`. |
| `--max-requests 1000 --max-requests-jitter 100` | Recycle workers periodically to cap memory growth. The jitter stops all workers restarting at once. |
| `--worker-tmp-dir /run/<INSTANCE>` | gunicorn writes worker heartbeats here. It must be a tmpfs, and it must be this instance's own. |
| `--limit-request-line 0` | No URL length limit. Superset puts large encoded chart state in query strings. |

> **Note**
> Sizing rule of thumb: `workers × threads` across **all** instances on the box
> should stay within about 4× the core count. Above that, they mostly compete
> with each other.

## 7.3 The Celery worker

```bash
sudo tee /etc/systemd/system/<INSTANCE>-celery-worker.service > /dev/null <<'UNIT'
[Unit]
Description=<INSTANCE> Celery Worker
After=network.target redis-<REDIS_PORT>.service postgresql.service
Wants=redis-<REDIS_PORT>.service

[Service]
LimitNOFILE=65535
Type=simple
User=<APP_USER>
Group=<APP_USER>

WorkingDirectory=<APP_DIR>
Environment="PATH=<APP_DIR>/.venv/bin"
EnvironmentFile=<ENV_FILE>

RuntimeDirectory=<INSTANCE>
RuntimeDirectoryMode=0750
RuntimeDirectoryPreserve=yes
LogsDirectory=<INSTANCE>
LogsDirectoryMode=0750

ExecStart=<APP_DIR>/.venv/bin/celery \
    -A superset.tasks.celery_app:app worker \
    --loglevel=info \
    -O fair \
    --concurrency=4 \
    -n <INSTANCE>@%%h \
    --pidfile=/run/<INSTANCE>/celery-worker.pid \
    --logfile=/var/log/<INSTANCE>/celery-worker.log

Restart=always
RestartSec=10
SyslogIdentifier=<INSTANCE>-celery-worker

[Install]
WantedBy=multi-user.target
UNIT
```

Two details worth understanding:

- **`%%h`** — in a systemd unit, `%` is an escape character, so a literal `%`
  must be written `%%`. Celery expands `%h` to the hostname. Write `%h` and
  systemd eats it, and your worker gets a confusing name.
- **`--concurrency=4`** — this is a hard cap on how many chart queries this
  instance sends to the analytics databases at once. Note that passing it on
  the command line **overrides** `worker_concurrency` in `superset_config.py`.
  Pick one place to set it and be aware which one is winning; if dashboards
  feel slow this is the knob, but it is also the knob that decides how much
  load this instance puts on databases other systems depend on.

## 7.4 Celery beat

Identical, with a different `ExecStart`:

```
ExecStart=<APP_DIR>/.venv/bin/celery \
    -A superset.tasks.celery_app:app beat \
    --loglevel=info \
    --schedule=<APP_DIR>/.superset/celerybeat-schedule \
    --pidfile=/run/<INSTANCE>/celery-beat.pid \
    --logfile=/var/log/<INSTANCE>/celery-beat.log
```

`--schedule` puts beat's state file inside the instance's own data directory.
The default drops a `celerybeat-schedule` file into the working directory,
which means an untracked file appearing in your git checkout.

> **Warning**
> Run exactly **one** beat process per instance. Two beats means every
> scheduled job is queued twice.

## 7.5 The background worker

Same again, with the queue restricted:

```
ExecStart=<APP_DIR>/.venv/bin/celery \
    -A superset.tasks.celery_app:app worker \
    --loglevel=info \
    -O fair \
    -Q background \
    --concurrency=2 \
    -n <INSTANCE>-background@%%h \
    --pidfile=/run/<INSTANCE>/celery-background.pid \
    --logfile=/var/log/<INSTANCE>/celery-background.log
```

`-Q background` is the whole point: this worker takes only the slow scheduled
jobs.

## 7.6 Substitute the placeholders and start

The heredocs above are quoted, so the placeholders are still literal text in
the files. Replace them:

```bash
cd /etc/systemd/system
sudo sed -i \
  -e 's|<APP_DIR>|/your/app/dir|g' \
  -e 's|<APP_USER>|youruser|g' \
  -e 's|<ENV_FILE>|/etc/yourinstance/superset.env|g' \
  -e 's|<INSTANCE>|yourinstance|g' \
  -e 's|<GUNICORN_PORT>|9097|g' \
  -e 's|<REDIS_PORT>|6383|g' \
  yourinstance*.service

# Nothing should print:
grep -l '<' yourinstance*.service && echo "PLACEHOLDERS REMAIN -- fix before starting"
```

Then:

```bash
sudo systemctl daemon-reload

sudo systemctl enable --now <INSTANCE>.service
sudo systemctl enable --now <INSTANCE>-celery-worker.service
sudo systemctl enable --now <INSTANCE>-celery-beat.service
sudo systemctl enable --now <INSTANCE>-celery-worker-background.service
```

Start the web unit first and confirm it is healthy before the others; if
something is wrong with the config, its logs say so most clearly.

## 7.7 Check they are actually working

`active` only means the process did not exit. Check the real thing:

```bash
for u in <INSTANCE> <INSTANCE>-celery-worker <INSTANCE>-celery-beat \
         <INSTANCE>-celery-worker-background; do
  printf '%-50s %s\n' "$u" "$(systemctl is-active $u)"
done

# gunicorn is listening on the port you chose
sudo ss -tlnp | grep <GUNICORN_PORT>

# and answering
curl -s -o /dev/null -w "health -> %{http_code}\n" http://127.0.0.1:<GUNICORN_PORT>/health
```

Expect `200`.

The workers must be connected to **your** Redis:

```bash
grep -E 'Connected to redis|ready' /var/log/<INSTANCE>/celery-worker.log | tail -3
```

You want `Connected to redis://127.0.0.1:<REDIS_PORT>/0`. Any other port means
this instance is sharing another one's queue — stop the service and fix the
environment file before going further.

[Verification](09-verification.md) has an end-to-end test that proves a job
actually runs, which is the check that matters.

---

[← Initialise](06-initialise-and-users.md) · [Index](README.md) · [Next: nginx →](08-nginx-and-tls.md)
