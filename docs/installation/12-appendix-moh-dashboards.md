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
| Cache key prefix | `superset_*` | `superset_train_*` | **`superset_mohd_*`** |
| Celery node name | *(default)* | `training@%h` | **`mohd@%h`** |
| Warm-up minute | `:45` | `:15` | **`:30`** |
| Sends email | yes | no | **no** |

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

## 12.3 Deviations from production, and why

These are deliberate. Each one is also commented at the point it appears in
`superset_config.py`, marked `[MOHD]`.

| Change | Reason |
|---|---|
| `EMAIL_NOTIFICATIONS = False` | This instance must never email Ministry staff. |
| `reports.scheduler` omitted from `beat_schedule` | Second interlock on the same risk — alerts can be created and inspected in the UI but never fire. |
| Cache warm-up at `:30` instead of `:45` | So the two instances never hit the shared ClickHouse/Postgres sources in the same minute. |
| Celery `--concurrency=4` (config says 12) | 12 is sized for production's traffic. This instance must not take twelve concurrent query slots on shared analytics databases. |
| gunicorn 4×4 rather than 8×8 | Three instances share 16 cores; this one is the smallest and must not out-compete the live portal. |
| CORS lists only `mohdsuper` + `mohdweb` | A production page must not be able to read this instance's data through a browser XHR, nor the reverse. |
| Own `SECRET_KEY` / `JWT_SECRET` | A session cookie or guest token from one instance must not authenticate against the other. |
| Redis on its own process, not extra DB numbers | Production runs `noeviction`; a second application filling a shared instance could OOM it. |

## 12.4 How this instance was built

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

## 12.5 The Flutter web client

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
