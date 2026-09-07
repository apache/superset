# 2. PostgreSQL: the metadata database

[← Prerequisites](01-prerequisites.md) · [Index](README.md) · [Next: Redis →](03-redis.md)

## 2.1 What goes in here

This database stores Superset's own bookkeeping: user accounts, roles and
permissions, dashboard and chart definitions, saved SQL Lab queries, and the
log of scheduled report runs.

It does **not** store the health data your dashboards display. That stays in
ClickHouse and the other analytics sources, which you connect through the
Superset UI after the install is finished.

It is small — tens of megabytes — but losing it means losing every dashboard.
Back it up.

## 2.2 Check whether it already exists

Somebody may have created the database and role for you.

```bash
sudo -u postgres psql -p 5432 -Atc "SELECT datname FROM pg_database ORDER BY 1"
sudo -u postgres psql -p 5432 -Atc "SELECT rolname FROM pg_roles ORDER BY 1"
```

> **Note**
> If the server runs more than one PostgreSQL version, `-p 5432` matters.
> `pg_lsclusters` lists every cluster with its port. Use the same cluster any
> existing Superset instance uses, unless you have a reason not to.

If `<PG_DB>` and `<PG_USER>` are both already there, skip to
[2.4 Prove you can connect](#24-prove-you-can-connect).

## 2.3 Create the role and the database

```bash
sudo -u postgres psql -p 5432
```

At the `postgres=#` prompt:

```sql
CREATE ROLE "<PG_USER>" WITH LOGIN PASSWORD '<PG_PASSWORD>';
CREATE DATABASE "<PG_DB>" OWNER "<PG_USER>";
\q
```

> **Warning**
> Note the **double quotes** around the names. If your database name contains a
> hyphen — `moh-ss-dev` does — PostgreSQL reads it as a subtraction unless you
> quote it. `\c moh-ss-dev` fails; `\c "moh-ss-dev"` works. This bites people
> repeatedly. In a connection URI no quoting is needed, because a hyphen is
> legal in a URI path.

### Limit how many connections the role can open

Superset opens a *lot* of database connections: every gunicorn worker and every
Celery worker keeps its own pool. On a shared PostgreSQL server this is the
single most common way one application takes down another.

```sql
ALTER ROLE "<PG_USER>" CONNECTION LIMIT 60;
```

Pick a number that fits the server's global `max_connections` alongside
everything else using it:

```bash
sudo -u postgres psql -p 5432 -Atc "SHOW max_connections"
sudo -u postgres psql -p 5432 -Atc \
  "SELECT rolname, rolconnlimit FROM pg_roles WHERE rolconnlimit > 0"
```

The pool sizing in `superset_config.py` must stay consistent with this limit —
see [Configuration §5.4](05-configuration.md#54-connection-pool-sizing).

## 2.4 Prove you can connect

Do this now. It is a five-second check that saves you from a confusing failure
three pages later, when Superset reports a migration error that is really a
password problem.

```bash
PGPASSWORD='<PG_PASSWORD>' psql -h 127.0.0.1 -p 5432 -U <PG_USER> -d '<PG_DB>' \
  -Atc "SELECT current_user, current_database()"
```

Expected output:

```
<PG_USER>|<PG_DB>
```

If it fails:

| Error | Cause | Fix |
|---|---|---|
| `password authentication failed` | Wrong password, or `pg_hba.conf` demands a different method | Re-check the password; see `sudo -u postgres psql -Atc "SHOW hba_file"` |
| `database "…" does not exist` | Typo, or you created it in a different cluster | `pg_lsclusters`, then re-check `-p` |
| `could not connect to server` | PostgreSQL is not running, or not on that port | `sudo systemctl status postgresql` |

## 2.5 Confirm the database is empty

If this is a fresh install the database must have no tables. A database with
tables in it already belongs to something — find out what before you continue,
because `superset db upgrade` will try to migrate whatever it finds.

```bash
PGPASSWORD='<PG_PASSWORD>' psql -h 127.0.0.1 -p 5432 -U <PG_USER> -d '<PG_DB>' \
  -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
```

Expected: `0`.

---

[← Prerequisites](01-prerequisites.md) · [Index](README.md) · [Next: Redis →](03-redis.md)
