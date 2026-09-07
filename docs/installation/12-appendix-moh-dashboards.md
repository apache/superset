# 12. Appendix: the moh-dashboards deployment

[← Operations](11-operations.md) · [Index](README.md)

The rest of this guide is written with placeholders so it works on any server.
This page records the actual values used for the **moh-dashboards** instance on
`ecs-habtech`, so you can substitute them directly, and so a future engineer can
see how the three Superset instances on that host are kept apart.

**No passwords or secrets appear on this page.** They live in
`/etc/moh-dashboards-superset/superset.env` on the server, mode `0640`,
`root:sysadmin`.

## 12.1 Resource map

| | production | training | **moh-dashboards** |
|---|---|---|---|
| App directory | `/var/etls/moh-superset` | `/var/etls/moh-superset-training` | `/var/moh-dashboards/moh-superset` |
| gunicorn bind | `127.0.0.1:9099` | `127.0.0.1:9098` | **`127.0.0.1:9097`** |
| gunicorn sizing | 8 workers × 8 threads | 6 × 6 | **4 × 4** |
| Redis | `6379` | `6380` | **`6383`** (`redis-6383.service`) |
| Metadata DB | `moh_superset` | `moh_superset_training` | **`moh-ss-dev`** |
| DB role | `moh_ss_user` | `moh_train_user` | **`mohssu`** |
| Env file | `/etc/moh-superset/superset.env` | `/etc/moh-superset-training/…` | **`/etc/moh-dashboards-superset/superset.env`** |
| Domain | `mohss.habtechsolution.com`, `pmd.mohdigitalhealth.gov.et` | `train.habtechsolution.com` | **`mohdsuper.habtechsolution.com`** |
| Cache key prefix | `superset_*` | `superset_train_*` | `superset_*` (same as production) |
| Celery node name | *(default)* | `training@%h` | **`mohd@%h`** |
| Warm-up minute | `:45` | `:15` | `:45` (same as production) |
| Sends email | yes | no | yes (config matches production — see §12.4) |

### systemd units

| | production | **moh-dashboards** |
|---|---|---|
| Web | `moh-superset.service` | `moh-dashboards-superset.service` |
| Worker | `superset-celery-worker.service` | `moh-dashboards-superset-celery-worker.service` |
| Beat | `superset-celery-beat.service` | `moh-dashboards-superset-celery-beat.service` |
| Background | `superset-celery-worker-background.service` | `moh-dashboards-superset-celery-worker-background.service` |
| Redis | `redis-server.service` | `redis-6383.service` |

### Helper installed with this instance

`/usr/local/bin/mohd-superset` — runs the Superset CLI against this instance
with the environment file loaded, the working directory set and `PYTHONPATH`
correct. Always use it rather than calling the venv directly:

```bash
sudo -u sysadmin mohd-superset db upgrade
sudo -u sysadmin mohd-superset init
sudo -u sysadmin mohd-superset fab create-user --help
```

## 12.2 Accounts

| Username | Role | Purpose |
|---|---|---|
| `admin` | `Admin` | Full administrator |
| `mohr` | `ReadOnly` | Read-only viewer |

`ReadOnly` is a custom role created for this instance, because Superset's stock
`Gamma` role permits creating and editing dashboards. It is `Gamma` minus ten
mutating permissions, keeping the five `can_write` permissions that viewing
depends on. See [§6.5](06-initialise-and-users.md#65-create-a-read-only-user).

Verified behaviour: `mohr` gets `200` on `GET /api/v1/dashboard/` and `403` on
`POST /api/v1/dashboard/`; `admin` gets `200` and `201`.

The role must be **re-derived** whenever the metadata database is restored from
another instance, or it keeps an empty set of `datasource_access` grants and the
user sees nothing — see [§12.3](#123-the-metadata-database-is-a-clone-of-production).

## 12.3 The metadata database is a clone of production

`moh-ss-dev` was seeded from a `pg_dump` of `moh_superset`, so this instance
carries production's 4 dashboards, 215 charts, 66 datasets and 3 datasource
connections. The procedure is written up in
[§11.7](11-operations.md#117-cloning-another-instances-metadata-database); what
follows is what was specific to this clone.

**The two local accounts were preserved byte-for-byte.** Their `ab_user.password`
hashes were captured before the restore and written back afterwards, so `admin`
and `mohr` still authenticate with exactly the passwords they were created with.

**Production's `admin` row was kept, not replaced.** It is `id=1` and the
`created_by_fk` owner of all four dashboards, so deleting it would have orphaned
them. Instead its credentials, email and name were overwritten with the
moh-ss-dev admin's. One visible consequence: the admin email here is
`admin@habtechsolution.com`, whereas production's is `mohssadmin@…`.

**`ReadOnly` was re-derived, not restored.** The role is defined as "Gamma minus
the mutating permissions". The pre-restore Gamma had no `datasource_access`
grants because the database was empty; the restored Gamma has 18. Reattaching
the old 85-permission set would have left `mohr` able to log in and see nothing
at all. Re-applying the rule against the restored Gamma gives 104 permissions,
of which 17 are `datasource_access` and 1 `database_access`.

Result: `mohr` sees 2 dashboards, 204 charts and 63 datasets — the subset Gamma
is granted — and still gets `403` on `POST /api/v1/dashboard/`.

**Datasource secrets were re-encrypted.** The dump's `dbs` passwords were
encrypted with production's `SECRET_KEY`; `superset re-encrypt-secrets` was run
once with `SUPERSET_PREVIOUS_SECRET_KEY` set to it (read straight from
production's env file, never written to disk here). Result: `6 re-encrypted,
0 failed`, and all three datasource connections verified with a live
`SELECT 1`.

> **Warning**
> This instance now holds **11,544 user accounts cloned from production**,
> including their password hashes. Those people can sign in here with their
> production passwords. That is inherent to a faithful replica; if it is not
> wanted, deactivate them — the command is in
> [§11.7 step 6](11-operations.md#step-6--check-what-you-inherited).

Backups taken at clone time, kept in `/var/backups/moh-dashboards/`:

| File | What it is |
|---|---|
| `moh-ss-dev-before-replica-*.dump` | This instance immediately before the restore — the undo button |
| `moh_superset-*.dump` | The production snapshot that was restored |

## 12.4 Differences from production, and why

The config is a copy of production's, kept deliberately identical except for
the infrastructure the two instances must not share. `diff` them and you should
see only these:

| # | Difference | Category |
|---|---|---|
| 1 | Path in the `_require()` error message | config path |
| 2 | `PREVIOUS_SECRET_KEY`, read from the environment | metadata restores |
| 3 | `REDIS_HOST` / `REDIS_PORT` default to `127.0.0.1:6383` | redis |
| 4 | The four `CACHE_REDIS_URL`s derive from those variables | redis |
| 5 | `DATA_DIR` points at this instance's directory | config path |
| 6 | `WEBDRIVER_BASEURL` defaults to this instance's port | own gunicorn |
| 7 | Two extra `CORS_OPTIONS["origins"]` entries | own domains |

Check it stays that way:

```bash
diff <(grep -vE '^\s*#|^\s*$' /var/etls/moh-superset/superset_config.py) \
     <(grep -vE '^\s*#|^\s*$' /var/moh-dashboards/moh-superset/superset_config.py)
```

Notes on the two least obvious entries:

**`WEBDRIVER_BASEURL` (6).** Production hardcodes its own port. Copied verbatim,
this instance's cache warm-up and alert screenshots would render **production**
instead — silently warming production's cache and adding load to it, while this
instance stayed cold. It has to differ.

**CORS origins (7).** Production's three entries are kept verbatim and two are
added. `mohdweb.habtechsolution.com` is the Flutter web client, which calls this
API cross-origin with credentials; without it every request from that client
fails CORS and the web app shows nothing.

**Cache key prefixes are identical to production** (`superset_meta_`,
`superset_data_`, …). The separate Redis *process* on 6383 is what provides the
isolation, so distinct prefixes would be redundant — and this file is meant to
be a copy.

> **Warning**
> Because the config is a faithful copy, `EMAIL_NOTIFICATIONS = True` and the
> `reports.scheduler` beat entry are both present, exactly as in production.
> This instance therefore **can** send email, and it inherited production's
> alerts and reports in the metadata dump.
>
> At the time of writing both inherited schedules are inactive, so nothing
> fires:
>
> ```bash
> sudo -u postgres psql -p 5432 -d 'moh-ss-dev' -Atc \
>   "select type, name, active from report_schedule"
> # Report | test | f
> # Alert  | CAR  | f
> ```
>
> Activating either one here would deliver mail to real recipients from a
> second Superset they are not expecting mail from. Check `active` before you
> enable anything. If you would rather remove the capability entirely, the two
> interlocks are in
> [§5.3](05-configuration.md#email-and-scheduled-reports--read-this-before-you-finish)
> — but applying them makes this instance no longer a faithful config replica,
> which was a deliberate choice here.

## 12.5 Where the dashboard data comes from

The datasource connections are production's, restored with the metadata dump and
re-encrypted under this instance's key. Verified working:

| id | Database | Connects |
|---|---|---|
| 1 | `MOH_Click_Hhouse` | ClickHouse — where the health data actually lives |
| 2 | `superset_usage_dashboard` | PostgreSQL |
| 3 | `Superset_Usage_DB` | PostgreSQL |

So both instances query **the same** ClickHouse and PostgreSQL sources. Nothing
about the analytics data is copied — only the definitions of how to reach it.

### Charts depend on the cache being warm

`GLOBAL_ASYNC_QUERIES` is enabled, so an uncached chart does not return data on
the first request. The browser gets `202 Accepted` with a job id, Celery runs
the query, and the browser polls until the result lands in the cache. A chart
that has never been queried therefore looks empty for the first few seconds.

Production hides this completely, because its warm-up has been running hourly
for months and `DATA_CACHE_CONFIG` holds results for 7200s. A freshly restored
instance has an empty cache and looks like it has no data at all — which is
exactly what it looks like when something is genuinely broken.

After a restore, or any `flushdb` on this instance's Redis, prime it the same
way production does rather than waiting for the next scheduled run:

```bash
sudo -u sysadmin bash -c '
  set -a; . /etc/moh-dashboards-superset/superset.env; set +a
  cd /var/moh-dashboards/moh-superset
  export PYTHONPATH=/var/moh-dashboards/moh-superset
  ./.venv/bin/python - <<PY
from superset.app import create_app
app = create_app()
with app.app_context():
    from superset.tasks.celery_app import app as ca
    r = ca.send_task("cache-warmup", kwargs={
        "strategy_name": "top_n_dashboards", "top_n": 3, "since": "7 days ago"})
    print("submitted", r.id)
PY'
```

It fans out into roughly 2000 `fetch_url` tasks on the `background` queue and
takes a few minutes. Watch it:

```bash
watch -n5 'redis-cli -p 6383 -n 2 dbsize'
grep -c fetch_url /var/log/moh-dashboards-superset/celery-background.log
grep -cE "fetch_url.*(raised|failed)" /var/log/moh-dashboards-superset/celery-background.log
```

> **Note**
> `redis-cli -p 6383 dbsize` reports database **0**, the Celery broker — which
> is near-empty when the queue is drained. The chart data cache is database
> **2**: `redis-cli -p 6383 -n 2 dbsize`. Reading db 0 makes a perfectly warm
> cache look empty.

### Dashboard 8 is access-gated, and a denial looks exactly like "no data"

`superset_config.py` sets `MOH_LEVEL_ONE_DASHBOARD_IDS = {8}`, and the custom
`MoHSecurityManager.raise_for_access()` refuses that dashboard unless the user
is an admin, or their org unit sits at `MOH_LEVEL_ONE_ORG_UNIT_LEVEL` (1, i.e.
national). The org unit is resolved live from ClickHouse `moh.dim_user_orgunit`
— it is not a Superset role or permission, so nothing in the roles screen hints
at it.

A denied user does not get an error page. Every chart request returns `403`
and the dashboard renders empty, which is indistinguishable from a cold cache
or a broken datasource until you look at the access log:

```bash
grep '"status":403' /var/log/nginx/mohdsuper.access.log | tail -3
# {"uri":"/api/v1/chart/data","args":"dashboard_id=8&form_data=...","status":403,...}
```

`dashboard_id=8` on a 403 is the signature. Check the user directly rather than
guessing:

```bash
sudo -u sysadmin bash -c '
  set -a; . /etc/moh-dashboards-superset/superset.env; set +a
  cd /var/moh-dashboards/moh-superset
  export PYTHONPATH=/var/moh-dashboards/moh-superset
  ./.venv/bin/python - <<PY
from superset.app import create_app
app = create_app()
with app.app_context():
    from superset import security_manager as sm
    from superset.utils.core import override_user
    for name in ("admin", "<USERNAME>"):
        u = sm.find_user(username=name)
        with override_user(u, force=True):
            print(name, "->", sm.user_can_access_level_one_dashboard())
PY'
```

Measured on this instance, and identical to production:

| User | Role | Dashboard 8 |
|---|---|---|
| `admin` | Admin | allowed |
| `moh_1`, `moh` | OrgUnitViewer, national org unit | allowed |
| `Eferata_medium_clinc` | OrgUnitViewer, facility org unit | **denied** |
| `mohr` | ReadOnly | **denied** |

Note that role grants are a red herring here. `OrgUnitViewer` and `Gamma` hold
`datasource_access` for only 3 of dashboard 8's 29 datasources in **both**
instances, yet national users load it fine — the gate is the org-unit level,
not the grant table.

`mohr` was initially denied because it is an account created locally, so it had
no row in `moh.dim_user_orgunit` at all. It has since been mapped to
`b3aCK1PTn5S` (Federal Ministry Of Health, level 1) — the same org unit as
`admin`, `moh` and `moh_1` — which both satisfies this gate and gives its
charts data (see the next section). It remains read-only: `POST
/api/v1/dashboard/` still returns 403.

Do not "fix" this by removing 8 from `MOH_LEVEL_ONE_DASHBOARD_IDS`. That
disables a deliberate access control for everyone, on an instance holding a
copy of production's data.

### A user with no org-unit mapping sees empty charts, with no error at all

This is the second, quieter failure mode, and it is easy to confuse with the
403 above. Every MoH chart's SQL carries a row-level-security block that
resolves the logged-in user's org unit from ClickHouse:

```sql
-- RLS: resolve the logged-in user's org unit via dim_user_orgunit
user_org_unit AS (SELECT org_unit_id FROM moh.dim_user_orgunit WHERE username = ...)
```

If the user has **no row** in `moh.dim_user_orgunit`, that subquery returns
nothing, the filter matches nothing, and every chart returns **zero rows**.
Not a 403, not a 500 — an empty chart with `rowcount: 0` and HTTP 200.

The give-away is that the same chart returns different results for different
users:

```
chart 1:  admin  rows=2   first={'monnth_No':'01-Hamle','Baseline':97.1,...}
chart 1:  mohr   rows=0   first=None
```

Any account you create yourself hits this, because `dim_user_orgunit` is
populated for real MoH users only — creating a Superset user does not add a row
to it.

Check whether a user is mapped:

```bash
sudo -u sysadmin bash -c '
  set -a; . /etc/moh-dashboards-superset/superset.env; set +a
  cd /var/moh-dashboards/moh-superset
  export PYTHONPATH=/var/moh-dashboards/moh-superset
  ./.venv/bin/python - <<PY
from superset.app import create_app
from sqlalchemy import text
app = create_app()
with app.app_context():
    from superset import db
    from superset.models.core import Database
    ch = db.session.query(Database).filter_by(database_name="MOH_Click_Hhouse").one()
    with ch.get_sqla_engine() as e:
        rows = e.connect().execute(text("""
            SELECT d.username, d.org_unit_id, ou.level, ou.name
              FROM moh.dim_user_orgunit d
              JOIN moh.org_units ou ON ou.id = d.org_unit_id
             WHERE d.username IN ('admin','<USERNAME>')
        """)).fetchall()
        for r in rows: print(r)
PY'
```

To map an account at national level — which is also what satisfies the
level-one gate on dashboard 8:

```sql
INSERT INTO moh.dim_user_orgunit (username, org_unit_id, created_at)
VALUES ('<USERNAME>', 'b3aCK1PTn5S', now());   -- Federal Ministry Of Health, level 1
```

The table is `ReplacingMergeTree(created_at) ORDER BY (username)`, so there is
exactly one row per user and re-inserting replaces rather than duplicates.

> **Warning**
> `moh.dim_user_orgunit` lives in the ClickHouse warehouse that **production
> also reads**. It is not part of this instance's metadata database, and
> nothing here is isolated from production. Only add usernames that do not
> exist in production's Superset, and get the change agreed before you run it.
> To undo:
>
> ```sql
> ALTER TABLE moh.dim_user_orgunit DELETE WHERE username = '<USERNAME>';
> ```

After changing a mapping, the verdict is cached in Redis for a short TTL under
`superset_meta_moh_level_one:<username>:<level>`, and memoised per request.
Clear it, or you will keep seeing the old answer:

```bash
for k in $(redis-cli -p 6383 -n 1 --scan --pattern '*moh_level_one*<USERNAME>*'); do
  redis-cli -p 6383 -n 1 del "$k"
done
sudo systemctl restart moh-dashboards-superset
```

> **Warning**
> Fixing the mapping is not enough on its own. Chart results are cached **per
> user's RLS context**, so every dashboard the affected user opened while
> unmapped left behind a cached `rowcount: 0` result. Those entries are served
> back as `HTTP 200, is_cached: true, rows=0` for the full
> `DATA_CACHE_CONFIG` timeout (7200s), so the account still shows nothing and
> it looks like the fix failed.
>
> The entries are keyed by hash, so they cannot be picked out individually.
> Flush this instance's result caches and let them repopulate:
>
> ```bash
> redis-cli -p 6383 -n 2 flushdb   # DATA_CACHE -- chart query results
> redis-cli -p 6383 -n 3 flushdb   # filter state / thumbnails
> redis-cli -p 6383 -n 4 flushdb   # explore form data
> redis-cli -p 6383 -n 5 flushdb   # SQL Lab results
> ```
>
> Check the port. `6383` is this instance's own Redis; `6379` is production's
> and flushing it would drop the live portal's entire cache. Then re-run the
> warm-up from the previous section so the next visitor does not pay for every
> cold query.

### A quirk worth knowing when you test with curl

`GET /api/v1/chart/<id>/data/` fails for uncached charts with a marshmallow
`ValidationError` — `{'metrics': ['Unknown field.'], 'columns': [...], ...}` in
the Celery worker log. The async task receives a payload shaped like a query
*object* where it expects a query *context*.

This is not specific to this instance — it is the same code production runs.
Production never logs it because nothing calls that endpoint there: the
dashboard uses `POST /api/v1/chart/data` with a full query context, which works
correctly from a cold cache.

So do not use `GET /api/v1/chart/<id>/data/` to decide whether an instance is
healthy. Post the chart's own stored `query_context` instead:

```bash
sudo -u postgres psql -p 5432 -d 'moh-ss-dev' -Atc \
  "select query_context from slices where id=<CHART_ID>" > /tmp/qc.json
# then POST /tmp/qc.json to /api/v1/chart/data with the session cookie + X-CSRFToken
```

## 12.6 How this instance was built

Two shortcuts were used that the main guide describes as options. Both were
valid **only** because the two checkouts were on the identical commit
(`41aed5d5b58a1f8cf01c2e97c9c71f31844348fa`):

1. **The Python environment was replicated from production's `pip freeze`**
   rather than resolved from `requirements/`. The resulting package sets differ
   by exactly one line (`wheel`). See
   [§4.2](04-application-code.md#install-the-dependencies).
2. **The 99 MB of compiled frontend assets were copied** from production with
   `rsync` instead of rebuilt with npm, saving 20–40 minutes. See
   [§4.3](04-application-code.md#43-frontend-assets).

`superset_config.py` was generated from production's by a patch script that
asserts each substitution applied, then checks that no production path, port,
role, database name or domain survives in any **executable** line — comments
and the header comparison table are exempt, since those are documentation.

## 12.7 The Flutter web client

A separate repository, `moh-apache-superset-flutter-client`, provides the web
front end at `mohdweb.habtechsolution.com`.

| | value |
|---|---|
| Source | `/var/moh-dashboards/moh-apache-superset-flutter-client` |
| Flutter SDK | 3.41.5 / Dart 3.11.3, installed at `/opt/flutter` |
| Build command | `flutter build web --release` |
| Build output | `build/web` (~37 MB) |
| Served from | `/var/www/mohdweb` |

The SDK version is not arbitrary: `pubspec.yaml` requires `sdk: ^3.11.3`, and
Flutter 3.41.5 is the lowest stable release that satisfies it. Its revision also
matches the `create_revision` recorded in the project's `.metadata`.

### The `.env` gotcha

The app reads its backend URL from a `.env` file that `pubspec.yaml` lists as a
Flutter **asset**. It is therefore compiled into the bundle at *build* time, not
read from the server at run time:

```yaml
flutter:
  assets:
    - .env
```

```dart
// lib/main.dart
await dotenv.load(fileName: ".env");
// lib/core/constants/url_constant.dart
String get baseUrl => dotenv.env['BASE_URL'] ?? 'https://mohss.habtechsolution.com';
```

Two consequences:

- Changing the backend URL requires a **rebuild and redeploy**, not an nginx
  reload.
- Note the fallback: if `.env` is missing from a build, the app silently talks
  to **production**. Always confirm the deployed bundle contains the right
  value:

  ```bash
  grep BASE_URL /var/www/mohdweb/assets/.env
  ```

> **Warning**
> `.env` is **tracked in git** in that repository, and its committed value
> points at production (`https://mohss.habtechsolution.com`). Building this
> deployment requires changing it, which leaves a modified tracked file in the
> working tree. Do not commit that change unless you intend to change the
> default for everyone who builds the repo. Check before you commit:
>
> ```bash
> cd /var/moh-dashboards/moh-apache-superset-flutter-client && git status
> ```

### Rebuilding and redeploying

```bash
cd /var/moh-dashboards/moh-apache-superset-flutter-client
grep BASE_URL .env            # confirm it targets mohdsuper, not mohss

export PATH=/opt/flutter/bin:$PATH
sudo -u sysadmin flutter pub get
sudo -u sysadmin flutter build web --release

sudo rsync -a --delete build/web/ /var/www/mohdweb/
sudo chown -R sysadmin:sysadmin /var/www/mohdweb
sudo find /var/www/mohdweb -type d -exec chmod 755 {} \;
sudo find /var/www/mohdweb -type f -exec chmod 644 {} \;

grep BASE_URL /var/www/mohdweb/assets/.env    # confirm again, post-deploy
```

The nginx block for this site is a static-file server with a single-page-app
fallback, not a proxy — see
[§8.4](08-nginx-and-tls.md#84-serving-a-separate-single-page-web-client).

---

[← Operations](11-operations.md) · [Index](README.md)
