# 1. Prerequisites and planning

[← Index](README.md) · [Next: PostgreSQL →](02-postgresql.md)

Do not skip the planning table. Ten minutes here saves you from the class of
bug where two Superset instances quietly corrupt each other's state.

## 1.1 The server

You need an Ubuntu 22.04 or 24.04 server with:

- **4 CPU cores minimum**, 8+ if this instance will carry real traffic
- **8 GB RAM minimum**, 16 GB+ recommended
- **20 GB free disk** for the code, the Python environment and the frontend
  build. Check with `df -h /var`.
- `sudo` access
- Outbound internet access (to download Python packages and, later, a TLS
  certificate)

Check what you have:

```bash
nproc                # CPU cores
free -g              # memory, in GB
df -h /var           # free disk on the partition you will install into
lsb_release -a       # Ubuntu version
```

## 1.2 System packages

```bash
sudo apt update
sudo apt install -y \
    python3.12 python3.12-venv python3.12-dev \
    build-essential pkg-config \
    libpq-dev libssl-dev libffi-dev libsasl2-dev libldap2-dev \
    postgresql-client redis-server nginx git curl
```

What the less obvious ones are for:

- `python3.12-dev`, `build-essential`, `pkg-config` — several Python
  dependencies compile C extensions during install. Without these, `pip` fails
  partway through with a wall of compiler errors.
- `libpq-dev` — needed to build the PostgreSQL driver.
- `libsasl2-dev`, `libldap2-dev` — needed by `python-ldap`, which Superset's
  authentication stack pulls in even if you never use LDAP.

Confirm the Python version. Superset is sensitive to this; use the same minor
version as any existing instance on the host:

```bash
python3.12 --version     # expect: Python 3.12.x
```

## 1.3 Node.js — only if you must build the frontend yourself

Superset's web interface is a large JavaScript application that has to be
compiled into static files before it can be served. You have two options, and
**option A is much faster** — see
[Application code](04-application-code.md#43-frontend-assets) for the full
explanation.

- **Option A — copy prebuilt assets** from an existing instance that is on the
  *exact same git commit*. Takes about a minute. No Node.js needed.
- **Option B — build from source.** Takes 20–40 minutes and needs 8+ GB of free
  RAM. Only this option needs Node.js:

```bash
node --version    # need v20 or newer
npm --version
```

## 1.4 The application user

Superset must not run as `root`. Use an existing unprivileged account or make
one. Throughout this guide it is called `<APP_USER>`.

```bash
id <APP_USER>     # if this errors, create the account:
# sudo adduser --system --group --home /home/<APP_USER> --shell /bin/bash <APP_USER>
```

## 1.5 Plan your resources — fill this in before you continue

Copy this table somewhere you can edit it. Every later page refers back to it.

| Placeholder | What it is | Your value |
|---|---|---|
| `<APP_DIR>` | Where the code lives | `/var/…/moh-superset` |
| `<APP_USER>` | Linux user the services run as | |
| `<INSTANCE>` | Short name used in unit/file names, e.g. `moh-dashboards-superset` | |
| `<GUNICORN_PORT>` | Port gunicorn binds on `127.0.0.1` | |
| `<REDIS_PORT>` | Port for this instance's **own** Redis | |
| `<PG_DB>` | Metadata database name | |
| `<PG_USER>` | Metadata database role | |
| `<PG_PASSWORD>` | That role's password | *(keep out of git)* |
| `<DOMAIN>` | Public hostname | |
| `<ENV_FILE>` | `/etc/<INSTANCE>/superset.env` | |

### Choosing the ports

**Never guess.** List what is already listening and pick something outside it:

```bash
sudo ss -tlnp | sort -u
```

Read the `Local Address:Port` column. Pick a `<GUNICORN_PORT>` and a
`<REDIS_PORT>` that do not appear. Then prove they are free:

```bash
sudo ss -tlnp | grep -E ':(<GUNICORN_PORT>|<REDIS_PORT>)\b' || echo "both ports are free"
```

> **Warning**
> Two services configured on the same port do not produce a clear error. The
> first one to start wins the port and the second dies in a restart loop, or —
> worse, with Redis — the second silently connects to the first one's data.

### Choosing the Redis port

Give this instance its **own Redis process on its own port**. Do not reuse
another instance's Redis with different database numbers (`/0`, `/1`, …).

The reason is memory, not tidiness. A production Redis is typically configured
with `maxmemory 0` and `noeviction`, meaning it never throws anything away. If
a second application fills that shared instance with its own cache, the Redis
process grows until the kernel kills it — and it takes production down with it.
A separate process has its own memory ceiling and its own dump file, and can be
deleted later without touching a single key belonging to anyone else.

## 1.6 If you are installing next to an existing instance

Look at the one that already works before you change anything. It is the most
accurate documentation available, because it is the thing that is actually
running:

```bash
# Which Superset-ish services exist, and are they up?
systemctl list-units --type=service --all | grep -iE 'superset|celery|redis'

# What does the existing web service actually run?
sudo systemctl cat <EXISTING_UNIT>.service

# What ports and Redis instances are in use?
sudo ss -tlnp | grep -E 'redis|gunicorn'
```

Write down its port, its Redis port, its database name and its unit names.
Those are the values your new instance must **not** use.

---

[← Index](README.md) · [Next: PostgreSQL →](02-postgresql.md)
