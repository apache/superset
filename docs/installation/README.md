# Installing MoH Superset from scratch

This folder is a complete, step-by-step guide to installing a MoH Superset
instance on a single Ubuntu server, together with the Redis and Celery pieces
it depends on.

It is written for someone who has **not** done this before. Every step says
what to type, what you should see back, and why the step exists. If a step can
go wrong in a way that is hard to diagnose, that is called out at the point
where it happens rather than left to the troubleshooting page.

These instructions are not theoretical. They were written by installing a
second, independent instance of MoH Superset next to the existing production
one on the same server, and writing down exactly what worked — including the
three or four places where the obvious command fails and you need to do
something slightly different.

## What you are going to build

Superset is not one program. It is four long-running processes that share a
database and a message queue:

| Piece | What it does | If it is down |
|---|---|---|
| **Gunicorn (web)** | Serves the web UI and the REST API | Nobody can open the site |
| **Celery worker** | Runs dashboard/chart queries in the background | Charts hang or time out |
| **Celery beat** | A clock. Puts scheduled jobs on the queue | Cache warm-up stops; site still works but feels slow |
| **Celery worker (background queue)** | Runs only the slow scheduled jobs | Warm-up and thumbnails stop |

They talk to two shared services:

| Service | What Superset stores there |
|---|---|
| **PostgreSQL** | The *metadata* database: users, roles, dashboards, charts, saved queries. **Not** the health data you build dashboards from — that lives in ClickHouse and other sources you connect later. |
| **Redis** | The Celery job queue, plus every cache (chart results, dashboard filter state, thumbnails). |

```
                    ┌──────────────────────────────┐
   browser ──443──▶ │ nginx  (TLS, static files)   │
                    └───────────────┬──────────────┘
                                    │ 127.0.0.1:<PORT>
                    ┌───────────────▼──────────────┐
                    │ gunicorn  →  Superset (Flask)│
                    └───────┬──────────────┬───────┘
                            │              │
                  enqueue   │              │  read/write
                            ▼              ▼
                    ┌──────────────┐  ┌──────────────┐
                    │    Redis     │  │  PostgreSQL  │
                    │ queue+caches │  │  (metadata)  │
                    └──────▲───────┘  └──────▲───────┘
                           │                 │
              ┌────────────┴───────┐         │
              │ celery worker      ├─────────┘
              │ celery beat        │
              │ celery background  │
              └────────────────────┘
```

## Read these in order

| # | Page | Roughly how long |
|---|---|---|
| 1 | [Prerequisites and planning](01-prerequisites.md) | 20 min |
| 2 | [PostgreSQL: the metadata database](02-postgresql.md) | 15 min |
| 3 | [Redis: queue and cache](03-redis.md) | 15 min |
| 4 | [Application code and the Python environment](04-application-code.md) | 30–60 min |
| 5 | [Configuration](05-configuration.md) | 30 min |
| 6 | [Initialise the database and create users](06-initialise-and-users.md) | 20 min |
| 7 | [systemd services](07-systemd.md) | 30 min |
| 8 | [nginx and HTTPS](08-nginx-and-tls.md) | 20 min |
| 9 | [Verify the installation](09-verification.md) | 20 min |
| 10 | [Troubleshooting](10-troubleshooting.md) | as needed |
| 11 | [Day-to-day operations](11-operations.md) | reference |
| 12 | [Appendix: the moh-dashboards deployment](12-appendix-moh-dashboards.md) | reference |

Allow half a day the first time. Most of the elapsed time is the Python
package install and the frontend asset build, both of which run unattended.

## Conventions used in this guide

Anything in `<ANGLE_BRACKETS>` is a value you choose or look up. The guide
never contains a real password. Before you start, fill in the table in
[Prerequisites](01-prerequisites.md) and keep it next to you.

Commands are shown with the user they must run as:

```bash
# as root (or via sudo)
sudo systemctl restart <SERVICE>

# as the application user
sudo -u <APP_USER> <SOME_COMMAND>
```

> **Note**
> Boxes like this one add context you do not strictly need to finish the step.

> **Warning**
> Boxes like this one describe something that will break your instance, or
> somebody else's, if you get it wrong. Do not skip them.

## The one rule that matters most

**A new instance must share nothing mutable with an existing one.**

If you are installing alongside an instance that is already running — which is
the normal case at MoH — then every one of these must be different:

- the directory the code lives in
- the TCP port gunicorn listens on
- the PostgreSQL database *and* the role that connects to it
- the Redis instance (a different port, not just a different DB number)
- the systemd unit names
- the `SECRET_KEY`
- the nginx `server_name`

[Prerequisites](01-prerequisites.md) walks you through choosing all of them,
and [Verification](09-verification.md) has a checklist that proves you did.

If you share any of them by accident, the failure is rarely obvious. Two
instances on one Redis will silently steal each other's Celery jobs. Two
instances on one metadata database will fight over schema migrations. Sharing a
`SECRET_KEY` means a login session for one is a valid login session for the
other.
