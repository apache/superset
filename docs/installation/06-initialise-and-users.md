# 6. Initialise the database and create users

[← Configuration](05-configuration.md) · [Index](README.md) · [Next: systemd →](07-systemd.md)

Three steps, in this order. Each depends on the one before.

## 6.1 Check what you are about to migrate

`superset db upgrade` writes to whatever database the environment file names.
On a server with several instances, confirm which one that is **before** you
run it:

```bash
sudo -u <APP_USER> bash -c 'set -a; . <ENV_FILE>; set +a; \
  echo "$SUPERSET_DATABASE_URI" | sed "s/:[^:@]*@/:***@/"'
```

Read the database name at the end of that line. If it is not the one you
created in [§2](02-postgresql.md), stop and fix the environment file.

## 6.2 Create the schema

```bash
sudo -u <APP_USER> <INSTANCE>-cli db upgrade
```

This runs several hundred Alembic migrations and takes 2–5 minutes on an empty
database. It prints a lot, including many lines like `Upgraded 0 slices` — that
is normal on a fresh install, since there is nothing to upgrade yet.

It is safe to run in the background if your session might drop:

```bash
sudo -u <APP_USER> nohup <INSTANCE>-cli db upgrade > /tmp/db_upgrade.log 2>&1 &
tail -f /tmp/db_upgrade.log
```

### Confirm it finished properly

Do not judge this by the last line of output. Compare the schema version the
database is at with the newest version the code has:

```bash
sudo -u <APP_USER> <INSTANCE>-cli db current | tail -2
sudo -u <APP_USER> <INSTANCE>-cli db heads   | tail -2
```

Both must print the **same** revision id, and `current` must be marked
`(head)`. If they differ, a migration failed partway through; look in the log
for the first `ERROR` or `Traceback`, fix the cause, and re-run `db upgrade` —
it resumes from where it stopped.

```bash
grep -inE 'error|traceback|exception' /tmp/db_upgrade.log | head
```

Tables should now exist:

```bash
PGPASSWORD='<PG_PASSWORD>' psql -h 127.0.0.1 -p 5432 -U <PG_USER> -d '<PG_DB>' \
  -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
```

Expect a number in the dozens.

## 6.3 Create roles and permissions

```bash
sudo -u <APP_USER> <INSTANCE>-cli init
```

This builds Superset's permission model: it creates the `Admin`, `Alpha`,
`Gamma`, `sql_lab` and `Public` roles and attaches the several hundred
individual permissions to them. It takes under a minute and prints lines like
`Creating missing datasource permissions`.

Re-running it is safe and is in fact the fix for several permission problems
later.

Confirm the roles landed:

```bash
PGPASSWORD='<PG_PASSWORD>' psql -h 127.0.0.1 -p 5432 -U <PG_USER> -d '<PG_DB>' -Atc "
  SELECT r.name, count(p.id)
  FROM ab_role r
  LEFT JOIN ab_permission_view_role p ON p.role_id = r.id
  GROUP BY r.name ORDER BY 2 DESC"
```

Expect roughly: `Admin` ~231, `Alpha` ~122, `Gamma` ~95, `sql_lab` ~32,
`Public` 0.

## 6.4 Create the administrator

```bash
sudo -u <APP_USER> <INSTANCE>-cli fab create-admin \
  --username admin \
  --firstname <FIRST> \
  --lastname <LAST> \
  --email <ADMIN_EMAIL> \
  --password '<ADMIN_PASSWORD>'
```

Expect `Admin User admin created.` at the end.

> **Note**
> Quote the password in single quotes. Passwords containing `$`, `!` or `#`
> are otherwise mangled by the shell, and you end up with an account whose
> password is not what you think it is.

## 6.5 Create a read-only user

### Gamma is not read-only

This surprises people. Superset's `Gamma` role — the one every guide calls the
"viewer" role — includes `can_write on Chart` and `can_write on Dashboard`. A
Gamma user can create and edit dashboards. If somebody asked you for a
read-only account, Gamma is not it.

See for yourself:

```bash
PGPASSWORD='<PG_PASSWORD>' psql -h 127.0.0.1 -p 5432 -U <PG_USER> -d '<PG_DB>' -Atc "
  SELECT p.name || ' on ' || v.name
  FROM ab_permission_view_role pvr
  JOIN ab_role r  ON r.id = pvr.role_id
  JOIN ab_permission_view pv ON pv.id = pvr.permission_view_id
  JOIN ab_permission p ON p.id = pv.permission_id
  JOIN ab_view_menu v ON v.id = pv.view_menu_id
  WHERE r.name = 'Gamma' AND p.name ILIKE '%write%'
  ORDER BY 1"
```

### Build a real read-only role

Take Gamma and remove the permissions that genuinely change content — but keep
the handful of `can_write` permissions that ordinary *viewing* depends on.
Superset stores dashboard filter state, Explore form state and permalinks
server-side, so a user who cannot write those cannot apply a filter or open a
chart. Stripping every `can_write` produces an account that looks read-only and
is actually just broken.

Save this as `/tmp/make_readonly.py`:

```python
"""Create a genuinely read-only role and user. Idempotent."""
from superset.app import create_app

# Removed from the Gamma baseline: each is a real write to shared content.
DENY = {
    ("can_write", "Chart"),
    ("can_write", "Dashboard"),
    ("can_write", "Tag"),
    ("can_write", "Theme"),
    ("can_delete_embedded", "Dashboard"),
    ("can_export_as_example", "Dashboard"),
    ("can_put_chart_customizations", "Dashboard"),
    ("can_add", "UserRegistrationsRestAPI"),
    ("can_edit", "UserRegistrationsRestAPI"),
    ("can_delete", "UserRegistrationsRestAPI"),
}
# KEPT on purpose, despite being writes -- viewing breaks without them:
#   can_write DashboardFilterStateRestApi  -> applying a dashboard filter
#   can_write ExploreFormDataRestApi       -> opening a chart in Explore
#   can_write Dashboard/ExplorePermalinkRestApi -> "copy link"
#   can_write CurrentUserRestApi           -> own profile

app = create_app()
with app.app_context():
    from superset import db, security_manager as sm

    gamma = sm.find_role("Gamma")
    assert gamma is not None, "run `superset init` first"

    role = sm.find_role("ReadOnly") or sm.add_role("ReadOnly")
    role.permissions = [
        pv for pv in gamma.permissions
        if (pv.permission.name, pv.view_menu.name) not in DENY
    ]
    db.session.merge(role)
    db.session.commit()

    if sm.find_user(username="<RO_USERNAME>") is None:
        sm.add_user(
            username="<RO_USERNAME>",
            first_name="<FIRST>", last_name="<LAST>",
            email="<RO_EMAIL>",
            role=role,
            password="<RO_PASSWORD>",
        )
        print("created user")
    print(f"ReadOnly has {len(role.permissions)} perms; Gamma has {len(gamma.permissions)}")
```

Run it inside the instance's environment:

```bash
sudo -u <APP_USER> bash -c '
  set -a; . <ENV_FILE>; set +a
  cd <APP_DIR>
  export PYTHONPATH=<APP_DIR>
  ./.venv/bin/python /tmp/make_readonly.py'
```

Expect something like `ReadOnly has 85 perms; Gamma has 95`.

> **Note**
> Older guides use `sm.get_session`. That attribute no longer exists in this
> version of Flask-AppBuilder and raises
> `AttributeError: 'MoHSecurityManager' object has no attribute 'get_session'`.
> Use `from superset import db` and `db.session` instead, as above.

### Prove it is actually read-only

Do not trust the permission count — test the behaviour. This is worth doing
because "read-only" is usually a promise somebody made to a data owner:

```bash
B=https://<DOMAIN>

TOK=$(curl -s -X POST "$B/api/v1/security/login" -H 'Content-Type: application/json' \
      -d '{"username":"<RO_USERNAME>","password":"<RO_PASSWORD>","provider":"db","refresh":false}' \
      | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

# Reading must work
curl -s -o /dev/null -w "GET  dashboards -> %{http_code}\n" \
  -H "Authorization: Bearer $TOK" "$B/api/v1/dashboard/"

# Writing must be refused
curl -s -o /dev/null -w "POST dashboard  -> %{http_code}\n" \
  -X POST -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d '{"dashboard_title":"probe"}' "$B/api/v1/dashboard/"
```

You want `200` then `403`. If the POST returns `201`, the role still has write
permission — re-check `DENY` and re-run the script.

Run the same two commands as `admin`: you should get `200` then `201`, which
proves the 403 was the role and not a broken request. Delete anything the admin
probe created.

---

[← Configuration](05-configuration.md) · [Index](README.md) · [Next: systemd →](07-systemd.md)
