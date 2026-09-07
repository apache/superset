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

## 11.7 Cloning another instance's metadata database

Sometimes you want a non-production instance to hold a copy of production's
dashboards, charts and datasets. That is a database restore plus **four**
follow-up steps that are easy to miss — skip any of them and the instance comes
up looking fine but subtly broken.

### The four things a plain restore gets wrong

1. **Every datasource password becomes undecryptable.** They are encrypted with
   the *source* instance's `SECRET_KEY`. You must re-encrypt them.
2. **Your local user accounts disappear**, replaced by the source's. If the
   source also has an `admin`, it collides with yours.
3. **Custom roles disappear**, because they only ever existed locally.
4. **You inherit the source's alerts and scheduled reports**, addressed to real
   recipients.

### Step 1 — capture what must survive

```bash
sudo -u postgres psql -p 5432 -d '<PG_DB>' -Atc "
select json_build_object(
  'users', (
     select json_agg(row_to_json(x)) from (
       select username, password, email, first_name, last_name, active,
              (select json_agg(r.name) from ab_user_role ur
                 join ab_role r on r.id=ur.role_id where ur.user_id=u.id) as roles
       from ab_user u where username in ('admin','<RO_USERNAME>')
     ) x),
  'readonly_perms', (
     select json_agg(json_build_array(p.name, v.name))
       from ab_permission_view_role pvr
       join ab_role r  on r.id = pvr.role_id
       join ab_permission_view pv on pv.id = pvr.permission_view_id
       join ab_permission p on p.id = pv.permission_id
       join ab_view_menu v on v.id = pv.view_menu_id
      where r.name = 'ReadOnly')
)" > /root/preserve.json
chmod 0600 /root/preserve.json     # contains password hashes
```

Capturing the raw `password` column means you can put the accounts back
**byte-for-byte**, rather than resetting them to a password you hope is the
right one.

### Step 2 — back up both sides, then restore

```bash
# Your own database first -- this is the undo button
sudo -u postgres /usr/lib/postgresql/<PG_MAJOR>/bin/pg_dump -p 5432 \
  -d '<PG_DB>' -Fc -f /var/backups/<INSTANCE>-before-clone-$(date +%F).dump

# The source. pg_dump takes only an ACCESS SHARE lock, so production keeps serving.
sudo -u postgres /usr/lib/postgresql/<PG_MAJOR>/bin/pg_dump -p 5432 \
  -d '<SOURCE_DB>' -Fc -f /var/backups/<SOURCE_DB>-$(date +%F).dump
```

Stop the instance so nothing writes during the restore:

```bash
sudo systemctl stop <INSTANCE>-celery-beat <INSTANCE>-celery-worker-background \
                    <INSTANCE>-celery-worker <INSTANCE>
```

Then wipe and restore. Note the **versioned binary path** — see the warning
below:

```bash
sudo -u postgres psql -p 5432 -d '<PG_DB>' -c 'DROP SCHEMA IF EXISTS public CASCADE'
sudo -u postgres psql -p 5432 -d '<PG_DB>' -c 'CREATE SCHEMA public AUTHORIZATION <PG_USER>'
sudo -u postgres psql -p 5432 -d '<PG_DB>' -c 'GRANT ALL ON SCHEMA public TO <PG_USER>'

PGPASSWORD='<PG_PASSWORD>' /usr/lib/postgresql/<PG_MAJOR>/bin/pg_restore \
  -h 127.0.0.1 -p 5432 -U <PG_USER> -d '<PG_DB>' \
  --no-owner --no-privileges --exit-on-error \
  /var/backups/<SOURCE_DB>-<DATE>.dump
```

`--no-owner --no-privileges` stops the restore trying to hand every object to
the *source's* database role, which must not appear anywhere in your database.

> **Warning**
> Use `/usr/lib/postgresql/<PG_MAJOR>/bin/pg_restore`, not plain `pg_restore`.
> On Debian/Ubuntu `/usr/bin/pg_restore` is `pg_wrapper`, which picks a client
> version by inspecting the target — and over a **TCP** connection it cannot
> identify the cluster, so it falls back to the newest client installed. A
> newer client against an older server fails immediately with:
>
> ```
> pg_restore: error: could not execute query: ERROR: unrecognized configuration
> parameter "transaction_timeout"
> Command was: SET transaction_timeout = 0;
> ```
>
> With `--exit-on-error` that aborts the whole restore, leaving the database
> empty — which is exactly why you took the backup in step 2. Check with
> `psql --version` and `pg_restore --version`; if they disagree, or either
> disagrees with `SHOW server_version`, use the explicit path.

Confirm the data landed before continuing:

```bash
for t in dashboards slices tables dbs ab_user; do
  printf '%-12s src=%s dst=%s\n' "$t" \
    "$(sudo -u postgres psql -p 5432 -d '<SOURCE_DB>' -Atc "select count(*) from $t")" \
    "$(sudo -u postgres psql -p 5432 -d '<PG_DB>'     -Atc "select count(*) from $t")"
done
```

Counts should match. A busy source may differ slightly on `logs` — that is just
rows written after the snapshot.

### Step 3 — put your accounts and roles back

Do **not** delete the source's `admin`: it is the `created_by_fk` owner of the
dashboards you just restored. Keep the row and overwrite its credentials:

```python
# /root/reinstate.py -- run inside the instance's environment
import json
from superset.app import create_app

app = create_app()
with app.app_context():
    from superset import db, security_manager as sm

    saved = json.load(open("/root/preserve.json"))
    users = {u["username"]: u for u in saved["users"]}

    # ReadOnly role, rebuilt from the captured (permission, view_menu) pairs
    role = sm.find_role("ReadOnly") or sm.add_role("ReadOnly")
    role.permissions = [
        pv for perm, view in saved["readonly_perms"]
        if (pv := sm.find_permission_view_menu(perm, view))
    ]
    db.session.merge(role); db.session.commit()

    # admin: keep the restored row (it owns the dashboards), restore credentials
    a = users["admin"]; admin = sm.find_user(username="admin")
    admin.password = a["password"]      # verbatim hash -- same password as before
    admin.email, admin.first_name, admin.last_name = \
        a["email"], a["first_name"], a["last_name"]
    db.session.merge(admin); db.session.commit()

    # read-only user: recreate, then overwrite with the verbatim hash
    m = users["<RO_USERNAME>"]
    u = sm.find_user(username="<RO_USERNAME>") or sm.add_user(
        username="<RO_USERNAME>", first_name=m["first_name"],
        last_name=m["last_name"], email=m["email"], role=role,
        password="placeholder")
    u.password = m["password"]; u.roles = [role]
    db.session.merge(u); db.session.commit()
```

```bash
sudo -u <APP_USER> bash -c '
  set -a; . <ENV_FILE>; set +a
  cd <APP_DIR>; export PYTHONPATH=<APP_DIR>
  ./.venv/bin/python /root/reinstate.py'
```

> **Warning**
> A custom role built from `Gamma` **must be re-derived after the restore**, not
> just recreated from the captured list. On an empty install `Gamma` carries no
> `datasource_access` grants; the restored `Gamma` carries one per datasource.
> Reattaching only the old permissions produces a read-only user who logs in
> successfully and then sees **zero** dashboards, charts and datasets — with no
> error anywhere to explain it.
>
> Re-apply the rule instead: `ReadOnly = restored Gamma − mutating permissions`.
> See [§6.5](06-initialise-and-users.md#build-a-real-read-only-role).

### Step 4 — re-encrypt the datasource secrets

Until you do this, every data source in the restored instance fails to decrypt
and no chart can run.

```bash
sudo -u <APP_USER> bash -c '
  set -a; . <ENV_FILE>; set +a
  export SUPERSET_PREVIOUS_SECRET_KEY="$(sudo grep "^SUPERSET_SECRET_KEY=" \
      <SOURCE_ENV_FILE> | cut -d= -f2-)"
  cd <APP_DIR>; export PYTHONPATH=<APP_DIR>
  ./.venv/bin/superset re-encrypt-secrets'
```

Expect `Re-encryption complete: N re-encrypted, 0 failed.`

This needs `PREVIOUS_SECRET_KEY` to be present in the app config. Read it from
the environment so the source's key is never written into a file:

```python
# superset_config.py -- set only for this one command
if os.environ.get("SUPERSET_PREVIOUS_SECRET_KEY"):
    PREVIOUS_SECRET_KEY = os.environ["SUPERSET_PREVIOUS_SECRET_KEY"]
```

### Step 5 — restart and verify

```bash
sudo systemctl start <INSTANCE> <INSTANCE>-celery-worker \
     <INSTANCE>-celery-worker-background <INSTANCE>-celery-beat
```

The check that actually proves the re-encryption worked is connecting to each
restored data source:

```bash
sudo -u <APP_USER> bash -c '
  set -a; . <ENV_FILE>; set +a
  cd <APP_DIR>; export PYTHONPATH=<APP_DIR>
  ./.venv/bin/python - <<PY
from superset.app import create_app
from sqlalchemy import text
app = create_app()
with app.app_context():
    from superset import db
    from superset.models.core import Database
    for d in db.session.query(Database).order_by(Database.id):
        try:
            with d.get_sqla_engine() as e:
                e.connect().execute(text("SELECT 1"))
            print(f"  {d.database_name}: OK")
        except Exception as ex:
            print(f"  {d.database_name}: FAILED {type(ex).__name__}")
PY'
```

Then confirm both accounts still work, that the read-only user can now *see*
content, and that it still cannot write — the API probe in
[§6.5](06-initialise-and-users.md#prove-it-is-actually-read-only).

### Step 6 — check what you inherited

```bash
# Alerts and reports came with the dump
sudo -u postgres psql -p 5432 -d '<PG_DB>' -Atc \
  "select type, active, count(*) from report_schedule group by 1,2"
```

Any `active = t` row will fire once Celery beat runs, and will email real
people. Confirm both interlocks from
[§5.3](05-configuration.md#email-and-scheduled-reports--read-this-before-you-finish)
are in place: `EMAIL_NOTIFICATIONS = False` and no `reports.scheduler` entry in
`beat_schedule`.

> **Warning**
> You also inherited every **user account** from the source, including password
> hashes. On a production clone that can be many thousands of real staff
> accounts, and they can log into this instance with their production
> passwords. Decide deliberately whether that is acceptable. If it is not:
>
> ```bash
> # Deactivate everyone except the accounts you manage here
> sudo -u postgres psql -p 5432 -d '<PG_DB>' -c \
>   "update ab_user set active = false where username not in ('admin','<RO_USERNAME>')"
> ```
>
> Note that this makes the instance no longer a faithful replica — which is
> usually the right trade, but it is your call, not a default.

## 11.8 Removing the instance

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
