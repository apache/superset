# 10. Troubleshooting

[← Verification](09-verification.md) · [Index](README.md) · [Next: Operations →](11-operations.md)

Every problem in this page was hit during a real installation.

## 10.1 Where to look first

```bash
# Why did the service not start?
sudo journalctl -u <INSTANCE> -n 50 --no-pager

# Application errors
tail -100 /var/log/<INSTANCE>/gunicorn-error.log

# Celery
tail -100 /var/log/<INSTANCE>/celery-worker.log
tail -100 /var/log/<INSTANCE>/celery-beat.log

# nginx, per site
tail -100 /var/log/nginx/<INSTANCE>.error.log
```

Follow the logs while reproducing the problem:

```bash
sudo journalctl -u <INSTANCE> -f
```

## 10.2 Installing the Python dependencies

### `ERROR: ResolutionImpossible` mentioning `sqlglot`

```
apache-superset      depends on sqlglot<31 and >=30.8.0
apache-superset-core depends on sqlglot<29  and >=28.10.0
```

Expected. The two halves of the project disagree and pip cannot satisfy both.
Do not try to force a `sqlglot` version. Install `apache-superset-core` with
`--no-deps`, as in [§4.2](04-application-code.md#install-the-dependencies).

### Compiler errors during `pip install`

Missing development headers. Install the build prerequisites from
[§1.2](01-prerequisites.md#12-system-packages) and re-run. `python-ldap` needs
`libsasl2-dev` and `libldap2-dev`; `psycopg2` needs `libpq-dev`.

### `pip` is killed with no message

Out of memory. Check `dmesg | tail` for `Out of memory: Killed process`. Add
swap or install on a bigger machine.

## 10.3 Running the Superset CLI

### `superset: command not found`

Expected — Superset is not pip-installed, so pip never created the script.
Create the shim in [§4.4](04-application-code.md#44-restore-the-superset-command).

### `ModuleNotFoundError: No module named 'superset'`

You are in the right directory but the console script does not put it on
`sys.path`. Set `PYTHONPATH`:

```bash
cd <APP_DIR>
export PYTHONPATH=<APP_DIR>
./.venv/bin/superset db upgrade
```

The `<INSTANCE>-cli` wrapper does this for you. The systemd units do **not**
need it, because gunicorn and celery add the working directory themselves.

### `RuntimeError: SUPERSET_SECRET_KEY is not set`

The environment file was not loaded, or a variable is missing from it. Check:

```bash
sudo -u <APP_USER> bash -c 'set -a; . <ENV_FILE>; set +a; env | grep SUPERSET_'
```

If that is empty, check the file is readable by `<APP_USER>`:

```bash
ls -la <ENV_FILE>            # want -rw-r----- root <APP_USER>
```

### `AttributeError: … has no attribute 'get_session'`

An older Flask-AppBuilder API. Use `from superset import db` and `db.session`
instead of `sm.get_session`.

## 10.4 The service will not stay up

### Restart loop

```bash
sudo systemctl status <INSTANCE>
sudo journalctl -u <INSTANCE> -n 100 --no-pager | grep -iE 'error|traceback'
```

Common causes:

| Symptom in the log | Cause |
|---|---|
| `Address already in use` | Another process has `<GUNICORN_PORT>`. `sudo ss -tlnp \| grep <GUNICORN_PORT>` |
| `No module named 'superset'` | `WorkingDirectory=` is wrong in the unit |
| `could not connect to server` | PostgreSQL is down or the URI is wrong |
| `FATAL: password authentication failed` | Wrong password in the environment file |
| `Permission denied` on a log path | `LogsDirectory=` missing from the unit |

Reproduce it in the foreground, where the error is much clearer:

```bash
sudo -u <APP_USER> bash -c '
  set -a; . <ENV_FILE>; set +a
  cd <APP_DIR>
  ./.venv/bin/gunicorn --workers 1 --bind 127.0.0.1:<SOME_FREE_PORT> \
      superset.app:create_app()'
```

### `too many connections for role`

Pool sizing. See [§5.4](05-configuration.md#54-connection-pool-sizing). Look at
what is actually open:

```bash
sudo -u postgres psql -Atc "
  SELECT usename, count(*) FROM pg_stat_activity GROUP BY 1 ORDER BY 2 DESC"
```

Lower `pool_size`/`max_overflow`, or reduce worker counts, and restart.

## 10.5 The site loads but is wrong

### Blank page, 404s on `/static/assets/…`

Frontend assets missing or the nginx `alias` is wrong.

```bash
ls <APP_DIR>/superset/static/assets/ | head
du -sh <APP_DIR>/superset/static/assets     # expect ~99M
```

If the directory has files, check the trailing slashes in the nginx `alias` —
see [§8.2](08-nginx-and-tls.md#82-add-the-server-block).

### 502 Bad Gateway

nginx cannot reach gunicorn.

```bash
systemctl is-active <INSTANCE>
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:<GUNICORN_PORT>/health
```

If the direct curl works but the site does not, the port in the nginx
`upstream` block does not match the port in the systemd unit.

### 504 Gateway Timeout on heavy dashboards

A query is slower than a timeout. The three must be ordered:
`nginx proxy_read_timeout` **>** `gunicorn --timeout` **>** the database's
statement timeout. Raising nginx alone does nothing if gunicorn kills the
worker first.

### Login succeeds, then every page bounces back to the login screen

Session cookie is not surviving. Usually one of:

- `SECRET_KEY` changed between the login and the next request — for example the
  environment file was edited and only some services restarted. Restart all
  four.
- `MOH_FORCE_HTTPS=true` while browsing over plain HTTP: the cookie is marked
  `Secure` and the browser refuses to send it back. Use HTTPS.

### CORS errors in the browser console

The calling hostname is not in `CORS_OPTIONS["origins"]`. See
[§5.3](05-configuration.md#cors-origins). Test the preflight directly —
[§8.4](08-nginx-and-tls.md#84-serving-a-separate-single-page-web-client).

## 10.6 Celery

### Jobs are queued but nothing runs

Almost always the worker and the app are on different Redis instances.

```bash
grep 'Connected to redis' /var/log/<INSTANCE>/celery-worker.log | tail -1
sudo -u <APP_USER> bash -c '. <ENV_FILE>; echo "app -> $SUPERSET_REDIS_PORT"'
```

Also check the job is not sitting on a queue nobody consumes:

```bash
redis-cli -p <REDIS_PORT> llen celery
redis-cli -p <REDIS_PORT> llen background
```

A number that only grows means no worker is consuming that queue. If
`background` is growing, the background worker is down.

### Worker starts then immediately exits

```bash
tail -50 /var/log/<INSTANCE>/celery-worker.log
```

An import error in `superset_config.py` shows up here first, because the worker
loads the same config as the web tier.

### Cache warm-up runs but nothing gets faster

`WEBDRIVER_BASEURL` points at the wrong port — possibly another instance's, in
which case you are warming *their* cache. See
[§5.3](05-configuration.md#webdriver_baseurl--the-one-everybody-forgets).

```bash
grep -n WEBDRIVER_BASEURL <APP_DIR>/superset_config.py
```

### Warm-up requests all return 401

A renamed session cookie. Superset's internal `fetch_url` looks for a cookie
literally named `session`; if `SESSION_COOKIE_NAME` was customised, it finds
nothing and every warm-up, thumbnail and alert screenshot fails. Remove the
customisation.

## 10.7 PostgreSQL

### `psql: FATAL: database "moh-ss-dev" does not exist` — but it does

Hyphens. `psql -d moh-ss-dev` is parsed as arithmetic. Quote it:

```bash
psql -d 'moh-ss-dev'
\c "moh-ss-dev"
```

Connection *URIs* need no quoting — a hyphen is legal in a URI path.

### `pg_restore` fails with `unrecognized configuration parameter "transaction_timeout"`

```
pg_restore: error: could not execute query: ERROR:  unrecognized configuration
parameter "transaction_timeout"
Command was: SET transaction_timeout = 0;
```

A client/server version mismatch, not a corrupt dump. `/usr/bin/pg_restore` on
Debian and Ubuntu is `pg_wrapper`, which chooses a client version from the
target — and over a TCP connection (`-h 127.0.0.1`) it cannot work out which
cluster you mean, so it falls back to the newest client installed. A 17 or 18
client emits `SET transaction_timeout`, which a 16 server rejects.

Confusingly, `pg_restore --version` may print the *right* version, because the
wrapper resolves differently when there is no connection to inspect.

Use the versioned binary:

```bash
ls -d /usr/lib/postgresql/*/bin              # what is installed
sudo -u postgres psql -p 5432 -Atc 'show server_version'

/usr/lib/postgresql/16/bin/pg_restore ...    # match the server
```

With `--exit-on-error` the restore aborts on this immediately, and if you had
already dropped the schema the database is left empty. Always take the backup
in [§11.7](11-operations.md#117-cloning-another-instances-metadata-database)
first.

### A restored read-only user can log in but sees nothing

Zero dashboards, zero charts, zero datasets, and no error. The role has no
`datasource_access` grants.

A custom role derived from `Gamma` on an empty install inherits a `Gamma` that
grants access to no datasources, because none existed yet. After restoring a
dump, `Gamma` has one grant per datasource — but your custom role still has the
old, empty set.

```bash
sudo -u postgres psql -p 5432 -d '<PG_DB>' -Atc "
  select r.name, count(*) from ab_permission_view_role pvr
    join ab_role r on r.id=pvr.role_id
    join ab_permission_view pv on pv.id=pvr.permission_view_id
    join ab_permission p on p.id=pv.permission_id
   where p.name in ('datasource_access','database_access')
   group by r.name order by 2 desc"
```

A role missing from that list can see no data. Re-derive it from the restored
`Gamma` rather than reattaching the captured list —
[§11.7 step 3](11-operations.md#step-3--put-your-accounts-and-roles-back).

### `db upgrade` stops partway

Find the first real error, fix the cause, and re-run — Alembic resumes from
where it stopped:

```bash
grep -inE 'error|traceback' /tmp/db_upgrade.log | head
sudo -u <APP_USER> <INSTANCE>-cli db current
```

## 10.8 nginx

### `nginx -t` fails after your edit

Read the line number it prints; it is accurate. If you cannot see the problem,
restore your backup and re-apply the change in smaller pieces:

```bash
ls -la /etc/nginx/sites-available/default.bak-*
sudo cp /etc/nginx/sites-available/default.bak-<TIMESTAMP> \
        /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx
```

### certbot cannot validate the domain

DNS must resolve to this server and port 80 must be reachable from the
internet:

```bash
getent hosts <DOMAIN>
curl -s ifconfig.me; echo
sudo ufw status
```

Watch the challenge arrive while certbot runs:

```bash
sudo tail -f /var/log/nginx/access.log | grep acme-challenge
```

---

[← Verification](09-verification.md) · [Index](README.md) · [Next: Operations →](11-operations.md)
