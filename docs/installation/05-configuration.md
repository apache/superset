# 5. Configuration

[← Application code](04-application-code.md) · [Index](README.md) · [Next: Initialise →](06-initialise-and-users.md)

Superset reads its settings from two files:

| File | Contains | In git? |
|---|---|---|
| `<ENV_FILE>` (`/etc/<INSTANCE>/superset.env`) | Everything that names an external resource: database URI, Redis, secrets, public URLs | **No** |
| `<APP_DIR>/superset_config.py` | Everything else: caches, Celery, feature flags, branding, security | **No** — it is gitignored |

The split matters. The environment file is the *only* place this instance's
external resources are named, and all four systemd units read the same one.
That is what stops the web process and the Celery workers drifting onto
different databases — a failure that looks like "charts randomly do not load".

## 5.1 Create the environment file

```bash
sudo mkdir -p /etc/<INSTANCE>
sudo tee <ENV_FILE> > /dev/null <<'EOF2'
# --- Flask / Superset ---
FLASK_APP=superset
SUPERSET_CONFIG_PATH=<APP_DIR>/superset_config.py
SUPERSET_HOME=<APP_DIR>/.superset
SUPERSET_DATA_DIR=<APP_DIR>/.superset

# --- Metadata database ---
SUPERSET_DATABASE_URI=postgresql+psycopg2://<PG_USER>:<PG_PASSWORD>@127.0.0.1:5432/<PG_DB>

# --- Secrets (generate your own -- see below) ---
SUPERSET_SECRET_KEY=<GENERATE_ME>
SUPERSET_JWT_SECRET=<GENERATE_ME>

# --- Redis (this instance's own) ---
SUPERSET_REDIS_HOST=127.0.0.1
SUPERSET_REDIS_PORT=<REDIS_PORT>

# --- Public URLs ---
MOH_PUBLIC_URL=https://<DOMAIN>/
MOH_WEBDRIVER_BASEURL=http://127.0.0.1:<GUNICORN_PORT>/
MCP_SERVICE_URL=http://127.0.0.1:<GUNICORN_PORT>

# --- TLS ---
# nginx terminates TLS and proxies plain HTTP to gunicorn.
MOH_FORCE_HTTPS=true

# --- Native thread-pool caps ---
# numpy/OpenBLAS/pyarrow otherwise size their internal thread pools to the
# machine's core count. With several gunicorn workers that massively
# oversubscribes the CPU. Concurrency belongs to gunicorn and celery, not BLAS.
OMP_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
MKL_NUM_THREADS=1
NUMEXPR_NUM_THREADS=1
EOF2
```

Now replace every `<…>` placeholder in the file you just wrote.

### Generate the secrets

Never reuse another instance's `SECRET_KEY`. Sharing it means a login session
for one instance is a valid login session for the other.

```bash
python3 -c "import secrets; print('SUPERSET_SECRET_KEY=' + secrets.token_urlsafe(42))"
python3 -c "import secrets; print('SUPERSET_JWT_SECRET=' + secrets.token_urlsafe(48))"
```

Paste the output over the `<GENERATE_ME>` lines.

> **Warning**
> `SECRET_KEY` does two jobs: it signs session cookies **and** it encrypts the
> passwords of every data source you connect, stored in the `dbs` table.
> Changing it later without running
> `superset re-encrypt-secrets` (with `PREVIOUS_SECRET_KEY` set to the old
> value) makes every database connection fail to decrypt. Decide it now, write
> it down somewhere safe, and leave it alone.

### Lock the file down

It contains a database password, so it must not be world-readable:

```bash
sudo chown root:<APP_USER> <ENV_FILE>
sudo chmod 0640 <ENV_FILE>
ls -la <ENV_FILE>        # expect: -rw-r----- root <APP_USER>
```

Root owns it; the application group can read it. `0640` is not paranoia — a
`0644` config file with a production password in it is a real finding in a real
audit.

### Check it parses

```bash
sudo -u <APP_USER> bash -c 'set -a; . <ENV_FILE>; set +a; \
  echo "FLASK_APP=$FLASK_APP"; \
  echo "REDIS_PORT=$SUPERSET_REDIS_PORT"; \
  echo "DB=$(echo "$SUPERSET_DATABASE_URI" | sed "s/:[^:@]*@/:***@/")"'
```

The `sed` masks the password so you can paste the output into a ticket safely.

## 5.2 Create `superset_config.py`

This file is not in git — each instance has its own. The fastest correct route
is to copy a working instance's and change only what must differ:

```bash
sudo cp <EXISTING_APP_DIR>/superset_config.py <APP_DIR>/superset_config.py
sudo chown <APP_USER>:<APP_USER> <APP_DIR>/superset_config.py
sudo chmod 0640 <APP_DIR>/superset_config.py
```

Then work through §5.3. If you have no instance to copy from, start from
`<APP_DIR>/superset_config.example.py`.

## 5.3 What must change in a copied config

Anything naming a resource. Go through this list item by item — a copied config
that still points at another instance's Redis is the single most common way a
new install corrupts an old one.

### Redis host and port

```python
REDIS_HOST = os.environ.get("SUPERSET_REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.environ.get("SUPERSET_REDIS_PORT", <REDIS_PORT>))
```

### Cache URLs — derive them, do not hardcode them

A copied config often has the port written out literally:

```python
"CACHE_REDIS_URL": "redis://localhost:6379/1",     # WRONG in a copy
```

Change every one of them to be built from the variables above, so there is a
single place to change the port:

```python
"CACHE_REDIS_URL": f"redis://{REDIS_HOST}:{REDIS_PORT}/1",
```

There are four: `CACHE_CONFIG`, `DATA_CACHE_CONFIG`,
`FILTER_STATE_CACHE_CONFIG` and `EXPLORE_FORM_DATA_CACHE_CONFIG`.

### Cache key prefixes

Give each cache a prefix unique to this instance:

```python
"CACHE_KEY_PREFIX": "superset_<INSTANCE>_meta_",
```

With a separate Redis process this is technically redundant. Do it anyway: it
means that if somebody later misconfigures this instance onto the shared Redis,
it still cannot collide with another instance's keys.

Do the same for the SQL Lab results backend:

```python
RESULTS_BACKEND = RedisCache(
    host=REDIS_HOST, port=REDIS_PORT, db=5,
    default_timeout=86400,
    key_prefix="superset_<INSTANCE>_results_",
)
```

### `WEBDRIVER_BASEURL` — the one everybody forgets

```python
WEBDRIVER_BASEURL = os.environ.get(
    "MOH_WEBDRIVER_BASEURL", "http://127.0.0.1:<GUNICORN_PORT>/"
)
```

This is the address Superset uses to talk to *itself* for cache warm-up,
thumbnails and alert screenshots. If it still points at another instance's
port, this instance's scheduled jobs will quietly warm **that** instance's
cache. Nothing errors. You just never get the benefit, and the other instance
gets mysterious extra load.

In the MoH config this is deliberately set at the very end of the file, because
earlier sections contain duplicated blocks and the last assignment wins. Keep
it there.

### Data directory

```python
DATA_DIR = os.environ.get("SUPERSET_DATA_DIR", "<APP_DIR>/.superset")
UPLOAD_FOLDER = os.path.join(DATA_DIR, "uploads") + "/"
IMG_UPLOAD_FOLDER = os.path.join(DATA_DIR, "uploads") + "/"
SHARED_DIR = os.path.join(DATA_DIR, "shared")
```

### CORS origins

List only the hostnames that should be able to call this instance's API from a
browser. Remove any other instance's domain:

```python
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": "*",
    "expose_headers": "*",
    "resources": "*",
    "origins": ["localhost", "https://<DOMAIN>"],
}
```

If a separate web client (for example the Flutter web app) calls this API from
its own hostname, add that hostname here too, or every request from it fails
with an opaque CORS error in the browser console.

### Public URLs

```python
WEBDRIVER_BASEURL_USER_FRIENDLY = os.environ.get("MOH_PUBLIC_URL", "https://<DOMAIN>/")
MCP_SERVICE_URL = os.environ.get("MCP_SERVICE_URL", "http://127.0.0.1:<GUNICORN_PORT>")
MOH_HEALTH_INTELLIGENCE_URL = "https://<DOMAIN>/superset/dashboard/8/"
```

Any in-app link left pointing at another host bounces your users out of this
instance mid-session.

### Email and scheduled reports — read this before you finish

> **Warning**
> If you copied the config from production, it contains production's SMTP
> credentials and its `reports.scheduler` beat entry. If you also restore a
> production database dump, you inherit production's live alerts, all enabled
> and addressed to real Ministry staff — and this instance will start emailing
> them **duplicates**.

For any instance that is not itself production:

```python
EMAIL_NOTIFICATIONS = False
```

and remove the `reports.scheduler` entry from `CeleryConfig.beat_schedule`:

```python
beat_schedule = {
    # "reports.scheduler" deliberately OMITTED: this instance must not
    # deliver alerts. The ALERT_REPORTS feature flag stays on, so the UI is
    # unchanged and users can create and inspect alerts -- they simply never
    # fire. EMAIL_NOTIFICATIONS = False is the second interlock.
    "reports.prune_log": {
        "task": "reports.prune_log",
        "schedule": crontab(minute=0, hour=0),
    },
    "cache-warmup": {
        "task": "cache-warmup",
        "schedule": crontab(minute=30, hour="7-17"),
        "kwargs": {"strategy_name": "top_n_dashboards", "top_n": 3,
                   "since": "7 days ago"},
    },
}
```

Two interlocks rather than one is deliberate: either alone is a single line
somebody can undo without realising what it was protecting.

Note the warm-up runs at **:30** here. If another instance on the same server
warms at :45, give yours a different minute so the two never hit the shared
analytics databases in the same moment.

## 5.4 Connection pool sizing

Each gunicorn worker and each Celery worker keeps its own PostgreSQL pool. The
arithmetic that matters:

```
(gunicorn workers + celery workers + beat) × (pool_size + max_overflow)
    must stay under the role's CONNECTION LIMIT from §2.3
```

With ~25 processes and `pool_size=5, max_overflow=5`, that is 250 connections —
which is how you get `FATAL: too many connections for role …`, and dashboards
showing no data. Keep the pool small:

```python
SQLALCHEMY_ENGINE_OPTIONS = {
    "pool_size": 2,
    "max_overflow": 3,
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
```

`pool_pre_ping` tests a connection before handing it out, so a connection the
database closed overnight produces a reconnect instead of an error.

## 5.5 Check the config is valid Python

```bash
cd <APP_DIR>
sudo -u <APP_USER> ./.venv/bin/python -m py_compile superset_config.py && echo "syntax OK"
```

### Prove no other instance's resources remain

Worth doing explicitly, because a stale port in a copied config causes damage
that is silent:

```bash
grep -nE '<OTHER_PORT>|<OTHER_REDIS_PORT>|<OTHER_DB_NAME>|<OTHER_APP_DIR>' \
  <APP_DIR>/superset_config.py
```

Anything this prints that is not inside a comment must be fixed before you
start the services.

---

[← Application code](04-application-code.md) · [Index](README.md) · [Next: Initialise →](06-initialise-and-users.md)
