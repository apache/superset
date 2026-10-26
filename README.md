<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Asset approval — QA build

Apache Superset with **maker-checker review** turned on: an edit to a
dashboard, chart or dataset does not reach viewers until a second eligible
editor approves it.

This branch exists for testing that feature and nothing else. It is not
proposed for merge, and the parts of it that belong in Superset go upstream
as their own pull requests. Superset's own README follows this guide.

---

## Setting it up

You need Docker with roughly 8 GB available to it. Everything below runs
from the root of this checkout. The first run takes 15–25 minutes, nearly
all of it image building and example loading.

### One command

```bash
make asset-demo
```

It runs the three steps below in order. It builds the extension, starts the
`docker-compose-light` stack on port 9002 and waits until Superset reports
healthy, then seeds the accounts and the waiting change. It finishes by
printing the URL. Re-running it is safe; on a stack that is already up it
only rebuilds the extension and re-seeds.

| command | what it does |
|---|---|
| `make asset-demo` | build, start, wait, seed: everything |
| `make asset-demo-help` | print the commands, the logins and the happy flow in the terminal |
| `make asset-demo-seed` | back to one change waiting for review |
| `make asset-demo-examples` | load the example dashboards, if your environment skipped them |
| `make asset-demo-logs` | follow the init and Superset logs |
| `make asset-demo-down` | stop the stack, keeping its data |
| `make asset-demo-nuke` | stop the stack and delete its database |

A different port or project name: `make asset-demo ASSET_DEMO_PORT=9003 ASSET_DEMO_PROJECT=my-qa`.

The steps it runs are spelled out below, if you would rather run them one at
a time or need to see where something failed.

### 1. Build the extension

The review feature ships as a Superset extension. Its source is in the
repository; its build output is not, so you build it once:

```bash
docker run --rm -v "$PWD:/app" -w /app/local_extensions/asset-approval/frontend node:20 bash -lc "npm install --legacy-peer-deps && npm run build"
```

`--legacy-peer-deps` is required, not optional: the published
`@apache-superset/core` still declares a peer dependency on React 17 while
Superset itself is on React 18, so a plain `npm install` refuses to resolve.

Then assemble the loadable bundle:

```bash
docker run --rm -v "$PWD:/app" -w /app/local_extensions/asset-approval node:20 bash -lc "bash build.sh"
```

That writes `local_extensions/asset-approval/dist/`. It worked if it prints
`built: 19 files` and the manifest lists two contributed pages.

### 2. Start Superset

```bash
NODE_PORT=9002 docker compose -p asset-approval-qa -f docker-compose-light.yml up -d
```

The first run builds images and loads the example dashboards, which is the
slow part. Follow it with:

```bash
docker compose -p asset-approval-qa logs -f superset-init-light
```

When that container exits, open **http://localhost:9002** and sign in as
`admin` / `admin`.

The example dashboards load on the first run, which is what the seed in the
next step edits. If `docker/.env-local` exists on your machine and sets
`SUPERSET_LOAD_EXAMPLES=no`, it wins over the default and they are skipped —
the init log then shows three steps instead of four. Load them by hand with:

```bash
docker compose -p asset-approval-qa exec superset-light /app/.venv/bin/superset load-examples
```

### 3. Seed the review flow

```bash
docker compose -p asset-approval-qa exec superset-light /app/.venv/bin/python /app/local_extensions/asset-approval/qa/seed.py
```

This creates the cast (Alex, Priya, Sam and Morgan), makes Alex and Priya
editors of an example dashboard, chart and dataset, and leaves exactly one change waiting for a
reviewer. It prints what it set up, and it is safe to re-run at any time.

---

## Logins

Every account below is a local QA fixture created by `qa/seed.py` (or by
Superset's own init, for `admin`). It is the same cast as the demo
recording. None of these passwords are used anywhere real.

| user | name | password | role | editor of | use it for |
|---|---|---|---|---|---|
| `alex` | Alex Rivera | `general` | Alpha | USA Births Names, the first chart, the first dataset, Sales Dashboard (sole editor) | the author: making changes |
| `priya` | Priya Shah | `general` | Alpha | USA Births Names, the first chart, the first dataset | the approver: reviewing them |
| `sam` | Sam Carter | `general` | Gamma + "Viewer (data access)" | nothing | the viewer: seeing what everyone else sees |
| `morgan` | Morgan Lee | `general` | Admin | nothing | an admin who is not an editor: proving there is no admin bypass |
| `admin` | Superset Admin | `admin` | Admin | nothing | setup only |

The seeded assets, all from `superset load-examples`:

| asset | editors | what it is for |
|---|---|---|
| **USA Births Names** (dashboard) | alex, priya | the main walkthrough: a change here can be approved |
| **Sales Dashboard** (dashboard) | alex only | the state where nobody else can approve |
| first chart by id (**Funnel**, id 1, on a fresh load) | alex, priya | the chart walkthrough |
| first dataset by id (**bart_lines** on a fresh load) | alex, priya | the dataset walkthrough |

**Test as `alex`, `priya`, `sam` and `morgan`, never as `admin`.**
Admin's blanket access deliberately does not count as editorship for approval, so admin sees
a more permissive picture than a real user does. Permission and UI bugs only
show up on the non-admin accounts.

Alex and Priya are two editors because an author may never approve their own
work: the gate looks for a *second* editor of the asset, so one account
cannot demonstrate the flow at all. Sam is deliberately an editor of
nothing: while a change sits in review their bell has no count, they have
nothing in Approvals, and they see the asset exactly as it was. Morgan is an
admin who edits nothing, so nothing waits for them and they get no Approve
button.

Use one browser profile (or a private window) per account, so you can switch
between them without signing out each time.

---

## The happy flow, step by step

Run `qa/seed.py` first (see [Starting over](#starting-over)). It leaves one
change already waiting: `alex` renamed **USA Births Names** to
"USA Births Names (Q4)" and asked for review. Steps 1–3 look at that change
from each side; step 4 onwards walks a full round yourself. Each step says
what you should see; anything else is a finding.

### A. A change waits for review

1. **As `sam`** — open **USA Births Names**.
   - The title is still "USA Births Names". No banner, no badge, and the bell has no count.
   - Settings has no Approvals entry for you. Opening `/approvals/` directly says "Nothing needs you right now".
2. **As `morgan`** — open **USA Births Names**.
   - No review banner and no Approve button. Morgan is an admin but not an editor, and there is no admin bypass.
3. **As `priya`** — find the change.
   - The bell shows **1**; its popover lists USA Births Names under "Needs your review".
   - Home → **Pending reviews** lists it.
   - **Settings → Manage → Approvals** (or the bell's "View all approvals") lists it as "Needs your review", with a **Review** button.

### B. Review it on the dashboard

4. **As `priya`** — click **Review**. It opens the dashboard itself.
   - A banner reads "Reviewing changes from Alex Rivera · N changes", with **Show changes**, **What changed** and **Open live version**.
   - The **Review changes** panel opens on its own, beside the charts. It shows the field diff (`dashboard_title`: old struck through, new in green), an "Add to the note" box, and **Request changes** / **Approve** pinned to its footer.
   - **Show changes** previews the dashboard as it would look approved.
5. **As `priya`** — press **Edit dashboard**.
   - A dialog says "Alex Rivera is changing this dashboard", with when it was saved and **View changes**. Only one change per asset can be open. Cancel.
6. **As `priya`** — **Request changes**, type a note, send.
7. **As `alex`** — open **USA Births Names**.
   - The banner says Priya requested changes and shows the note.
   - The bell lists it under "Returned to you".

### C. Make and send a change yourself

8. **As `alex`** — **Edit dashboard**, change the title, **Save**.
   - The toast says "Changes saved. Viewers still see the live version."
   - The banner reads "Viewing your changes … viewers still see the live version", with **Show changes**, **What changed** and **Request review**.
   - Check as `sam` in the other window: still the old title.
9. **As `alex`** — **Request review**.
   - The dialog shows "Who can approve: Priya Shah", an optional "Ask someone specific" picker, and "Your changes lock while they wait. Editing withdraws the request."
   - Add a note and send. The banner turns to "Awaiting review … Priya Shah can approve", and you are never offered an Approve button.

### D. Approve it

10. **As `priya`** — open the dashboard again (bell or Approvals) and press **Approve** in the panel.
    - It asks first: "Approve and publish? Viewers see these changes right away. The current version moves to version history."
    - Confirm. The banner disappears and the new title is live.
11. **As `sam`** — reload. The new title is there now.
12. **As `priya`** — **⋯ → View version history**. The approval is the newest entry.

### E. Charts

13. **As `alex`** — open the seeded chart in Explore, change its name, **Save**.
    - The chart shows the "viewers still see the live version" banner. **Charts** lists it with a **Changes pending** tag. As `sam`, the chart keeps its old name.
14. **As `alex`** — **Request review** from the chart's banner.
15. **As `priya`** — **Settings → Manage → Approvals → Review**, then Approve. The new name goes live.

### F. Datasets

16. **As `alex`** — **Datasets → edit** the seeded dataset, change something (for example a metric label on the Metrics tab), **Save**, **Confirm**.
    - The toast says the changes are saved and viewers still see the live version, with a **Review changes →** link.
17. **As `alex`** — follow **Review changes →**. It opens Approvals filtered to "Submitted by me".
    - The dataset row is a Draft with **Request review**. Send it. The row flips to "Awaiting review".
18. **As `priya`** — **Approvals → Review** on the dataset row.
    - The "Review dataset changes" dialog opens on the tab that changed (Source / Metrics / Columns).
    - It shows live struck through beside proposed in green, and how many charts and dashboards use the dataset.
    - **Approve**. The change goes live.

### G. Deletes wait too

19. **As `alex`** — delete the seeded chart from the **Charts** list and confirm.
    - The toast says the delete was submitted for review and nothing has been removed. The chart is still listed.
    - Approving it as `priya` removes it; request changes to keep it.

### H. When nobody else can approve

20. **As `alex`** — on **Sales Dashboard** (Alex is its only editor), change the title, **Save**, **Request review**.
    - The dialog says "No one else can approve this dashboard. Add another editor to submit.", with an **Editors** picker and "Changing editors doesn't need approval."
21. **As `alex`** — add **Priya Shah** in that picker.
    - The warning clears in place and the dialog switches to "Who can approve: Priya Shah". Send.
    - Run the seed again afterwards to make Alex the only editor again.

### I. The rules, from the outside

22. **As `morgan`** — **Settings → Manage → Change review** opens a read-only page.
    - "Require review before changes go live" — "Set in the instance configuration. Changing it needs a restart."
    - The four facts below it, including **Admin bypass: Not available**.
23. **Any editor, through the API** — a direct save returns **202** with "Changes saved. Viewers still see the live version.", and the live object does not change:

        PUT /api/v1/dashboard/<id>   →   202 { "message": "Changes saved. Viewers still see the live version.", ... }

### J. Turning it off

With `CHANGE_MANAGEMENT` off (the default outside this branch), Superset behaves exactly as it does upstream: saves apply immediately, and there is no bell, banner or Approvals entry.

---

## Known gaps

Understood already — no need to file these:

- **No count on the Settings → Manage entry.** The design asks for the
  number to appear there as well as on the bell. Superset's menu entries
  carry no badge, so that needs a new capability rather than a placement
  change. The bell itself counts correctly.
- **No page per change request.** Review happens on the asset, or from the
  list for a dataset. Links that used to point at a change request's own
  page open the list instead.
- **Deleting a chart customization under review** clears the filter from
  your own view even though nothing was applied for anyone else. Superset
  clears those locally before the request goes out, and this branch does not
  reorder that.

## Reporting what you find

Say which account you were using, which numbered step you were on, and
whether the change was new or one the seed created. Where the UI and the
data disagree, the API is the tie-breaker:

    /api/v1/change_request/count          what the bell should show
    /api/v1/change_request/?show=for_me   what is waiting on you

## Starting over

Back to one change waiting for review, keeping everything else:

```bash
make asset-demo-seed
```

Back to nothing at all, database included (then `make asset-demo` to start again):

```bash
make asset-demo-nuke
```

The equivalent raw commands, if `make` is not available:

```bash
docker compose -p asset-approval-qa exec superset-light /app/.venv/bin/python /app/local_extensions/asset-approval/qa/seed.py
docker compose -p asset-approval-qa -f docker-compose-light.yml down -v
```

---
---

*Everything below is Apache Superset's own README, unchanged.*

# Superset

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/license/apache-2-0)
[![Latest Release on Github](https://img.shields.io/github/v/release/apache/superset?sort=semver)](https://github.com/apache/superset/releases/latest)
[![Build Status](https://github.com/apache/superset/actions/workflows/superset-python-unittest.yml/badge.svg)](https://github.com/apache/superset/actions)
[![PyPI version](https://badge.fury.io/py/apache_superset.svg)](https://badge.fury.io/py/apache_superset)
[![PyPI](https://img.shields.io/pypi/pyversions/apache_superset.svg?maxAge=2592000)](https://pypi.python.org/pypi/apache_superset)
[![GitHub Stars](https://img.shields.io/github/stars/apache/superset?style=social)](https://github.com/apache/superset/stargazers)
[![Contributors](https://img.shields.io/github/contributors/apache/superset)](https://github.com/apache/superset/graphs/contributors)
[![Last Commit](https://img.shields.io/github/last-commit/apache/superset)](https://github.com/apache/superset/commits/master)
[![Open Issues](https://img.shields.io/github/issues/apache/superset)](https://github.com/apache/superset/issues)
[![Open PRs](https://img.shields.io/github/issues-pr/apache/superset)](https://github.com/apache/superset/pulls)
[![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](https://bit.ly/join-superset-slack)
[![Documentation](https://img.shields.io/badge/docs-apache.org-blue.svg)](https://superset.apache.org)
[![Storybook](https://img.shields.io/badge/storybook-live-ff4785.svg)](https://superset-storybook.netlify.app)
[![Bundle Analyzer](https://img.shields.io/badge/bundle%20analyzer-nightly-8dd6f9.svg)](https://superset-bundle-analyzer.netlify.app)

<picture width="500">
  <source
    width="600"
    media="(prefers-color-scheme: dark)"
    src="https://superset.apache.org/img/superset-logo-horiz-dark.svg"
    alt="Superset logo (dark)"
  />
  <img
    width="600"
    src="https://superset.apache.org/img/superset-logo-horiz-apache.svg"
    alt="Superset logo (light)"
  />
</picture>

A modern, enterprise-ready business intelligence web application.

### Documentation

- **[User Guide](https://superset.apache.org/user-docs/)** — For analysts and business users. Explore data, build charts, create dashboards, and connect databases.
- **[Administrator Guide](https://superset.apache.org/admin-docs/)** — Install, configure, and operate Superset. Covers security, scaling, and database drivers.
- **[Developer Guide](https://superset.apache.org/developer-docs/)** — Contribute to Superset or build on its REST API and extension framework.

[**Why Superset?**](#why-superset) |
[**Supported Databases**](#supported-databases) |
[**Release Notes**](https://github.com/apache/superset/releases) |
[**Get Involved**](#get-involved) |
[**Resources**](#resources) |
[**Organizations Using Superset**](https://superset.apache.org/inTheWild)

## Why Superset?

Superset is a modern data exploration and data visualization platform. Superset can replace or augment proprietary business intelligence tools for many teams. Superset integrates well with a variety of data sources.

Superset provides:

- A **no-code interface** for building charts quickly
- A powerful, web-based **SQL Editor** for advanced querying
- A **lightweight semantic layer** for quickly defining custom dimensions and metrics
- Out of the box support for **nearly any SQL** database or data engine
- A wide array of **beautiful visualizations** to showcase your data, ranging from simple bar charts to geospatial visualizations
- Lightweight, configurable **caching layer** to help ease database load
- Highly extensible **security roles and authentication** options
- An **API** for programmatic customization
- A **cloud-native architecture** designed from the ground up for scale

## Screenshots & Gifs

**Video Overview**

<!-- File hosted here https://github.com/apache/superset-site/raw/lfs/superset-video-4k.mp4 -->

[superset-video-1080p.webm](https://github.com/user-attachments/assets/b37388f7-a971-409c-96a7-90c4e31322e6)

<br/>

**Large Gallery of Visualizations**

<kbd><img title="Gallery" src="https://superset.apache.org/img/screenshots/gallery.jpg"/></kbd><br/>

**Craft Beautiful, Dynamic Dashboards**

<kbd><img title="View Dashboards" src="https://superset.apache.org/img/screenshots/dashboard.jpg"/></kbd><br/>

**No-Code Chart Builder**

<kbd><img title="Slice & dice your data" src="https://superset.apache.org/img/screenshots/explore.jpg"/></kbd><br/>

**Powerful SQL Editor**

<kbd><img title="SQL Lab" src="https://superset.apache.org/img/screenshots/sql_lab.jpg"/></kbd><br/>

## Supported Databases

Superset can query data from any SQL-speaking datastore or data engine (Presto, Trino, Athena, [and more](https://superset.apache.org/docs/databases)) that has a Python DB-API driver and a SQLAlchemy dialect.

Here are some of the major database solutions that are supported:

<!-- SUPPORTED_DATABASES_START -->
<p align="center">
  <a href="https://superset.apache.org/docs/databases/supported/amazon-athena" title="Amazon Athena"><img src="docs/static/img/databases/amazon-athena.jpg" alt="Amazon Athena" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/amazon-dynamodb" title="Amazon DynamoDB"><img src="docs/static/img/databases/aws.png" alt="Amazon DynamoDB" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/amazon-redshift" title="Amazon Redshift"><img src="docs/static/img/databases/redshift.png" alt="Amazon Redshift" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-doris" title="Apache Doris"><img src="docs/static/img/databases/doris.png" alt="Apache Doris" width="103" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-drill" title="Apache Drill"><img src="docs/static/img/databases/apache-drill.png" alt="Apache Drill" width="81" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-druid" title="Apache Druid"><img src="docs/static/img/databases/druid.png" alt="Apache Druid" width="117" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-hive" title="Apache Hive"><img src="docs/static/img/databases/apache-hive.svg" alt="Apache Hive" width="44" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-impala" title="Apache Impala"><img src="docs/static/img/databases/apache-impala.png" alt="Apache Impala" width="21" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-kylin" title="Apache Kylin"><img src="docs/static/img/databases/apache-kylin.png" alt="Apache Kylin" width="44" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-pinot" title="Apache Pinot"><img src="docs/static/img/databases/apache-pinot.svg" alt="Apache Pinot" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-solr" title="Apache Solr"><img src="docs/static/img/databases/apache-solr.png" alt="Apache Solr" width="79" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/apache-spark-sql" title="Apache Spark SQL"><img src="docs/static/img/databases/apache-spark.png" alt="Apache Spark SQL" width="75" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/ascend" title="Ascend"><img src="docs/static/img/databases/ascend.webp" alt="Ascend" width="117" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/aurora-mysql-data-api" title="Aurora MySQL (Data API)"><img src="docs/static/img/databases/mysql.png" alt="Aurora MySQL (Data API)" width="77" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/aurora-postgresql-data-api" title="Aurora PostgreSQL (Data API)"><img src="docs/static/img/databases/postgresql.svg" alt="Aurora PostgreSQL (Data API)" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/azure-data-explorer" title="Azure Data Explorer"><img src="docs/static/img/databases/kusto.png" alt="Azure Data Explorer" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/azure-synapse" title="Azure Synapse"><img src="docs/static/img/databases/azure.svg" alt="Azure Synapse" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/clickhouse" title="ClickHouse"><img src="docs/static/img/databases/clickhouse.png" alt="ClickHouse" width="150" height="37" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/cloudflare-d1" title="Cloudflare D1"><img src="docs/static/img/databases/cloudflare.png" alt="Cloudflare D1" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/cockroachdb" title="CockroachDB"><img src="docs/static/img/databases/cockroachdb.png" alt="CockroachDB" width="150" height="24" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/couchbase" title="Couchbase"><img src="docs/static/img/databases/couchbase.svg" alt="Couchbase" width="150" height="35" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/cratedb" title="CrateDB"><img src="docs/static/img/databases/cratedb.svg" alt="CrateDB" width="180" height="24" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/databend" title="Databend"><img src="docs/static/img/databases/databend.png" alt="Databend" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/databricks" title="Databricks"><img src="docs/static/img/databases/databricks.png" alt="Databricks" width="152" height="24" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/denodo" title="Denodo"><img src="docs/static/img/databases/denodo.png" alt="Denodo" width="138" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/dremio" title="Dremio"><img src="docs/static/img/databases/dremio.png" alt="Dremio" width="126" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/duckdb" title="DuckDB"><img src="docs/static/img/databases/duckdb.png" alt="DuckDB" width="52" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/elasticsearch" title="Elasticsearch"><img src="docs/static/img/databases/elasticsearch.png" alt="Elasticsearch" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/exasol" title="Exasol"><img src="docs/static/img/databases/exasol.png" alt="Exasol" width="72" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/firebird" title="Firebird"><img src="docs/static/img/databases/firebird.png" alt="Firebird" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/firebolt" title="Firebolt"><img src="docs/static/img/databases/firebolt.png" alt="Firebolt" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/google-bigquery" title="Google BigQuery"><img src="docs/static/img/databases/google-big-query.svg" alt="Google BigQuery" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/google-sheets" title="Google Sheets"><img src="docs/static/img/databases/google-sheets.svg" alt="Google Sheets" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/greenplum" title="Greenplum"><img src="docs/static/img/databases/greenplum.png" alt="Greenplum" width="124" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/hologres" title="Hologres"><img src="docs/static/img/databases/hologres.png" alt="Hologres" width="44" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/ibm-db2" title="IBM Db2"><img src="docs/static/img/databases/ibm-db2.svg" alt="IBM Db2" width="91" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/ibm-netezza-performance-server" title="IBM Netezza Performance Server"><img src="docs/static/img/databases/netezza.png" alt="IBM Netezza Performance Server" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/mariadb" title="MariaDB"><img src="docs/static/img/databases/mariadb.png" alt="MariaDB" width="150" height="37" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/microsoft-sql-server" title="Microsoft SQL Server"><img src="docs/static/img/databases/msql.png" alt="Microsoft SQL Server" width="50" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/monetdb" title="MonetDB"><img src="docs/static/img/databases/monet-db.png" alt="MonetDB" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/mongodb" title="MongoDB"><img src="docs/static/img/databases/mongodb.png" alt="MongoDB" width="150" height="38" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/motherduck" title="MotherDuck"><img src="docs/static/img/databases/motherduck.png" alt="MotherDuck" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/oceanbase" title="OceanBase"><img src="docs/static/img/databases/oceanbase.svg" alt="OceanBase" width="175" height="24" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/oracle" title="Oracle"><img src="docs/static/img/databases/oraclelogo.png" alt="Oracle" width="111" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/presto" title="Presto"><img src="docs/static/img/databases/presto-og.png" alt="Presto" width="127" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/risingwave" title="RisingWave"><img src="docs/static/img/databases/risingwave.svg" alt="RisingWave" width="147" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/sap-hana" title="SAP HANA"><img src="docs/static/img/databases/sap-hana.png" alt="SAP HANA" width="137" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/sap-sybase" title="SAP Sybase"><img src="docs/static/img/databases/sybase.png" alt="SAP Sybase" width="100" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/shillelagh" title="Shillelagh"><img src="docs/static/img/databases/shillelagh.png" alt="Shillelagh" width="40" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/singlestore" title="SingleStore"><img src="docs/static/img/databases/singlestore.png" alt="SingleStore" width="150" height="31" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/snowflake" title="Snowflake"><img src="docs/static/img/databases/snowflake.svg" alt="Snowflake" width="76" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/sqlite" title="SQLite"><img src="docs/static/img/databases/sqlite.png" alt="SQLite" width="84" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/starrocks" title="StarRocks"><img src="docs/static/img/databases/starrocks.png" alt="StarRocks" width="149" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/superset-meta-database" title="Superset meta database"><img src="docs/static/img/databases/superset.svg" alt="Superset meta database" width="150" height="39" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/tdengine" title="TDengine"><img src="docs/static/img/databases/tdengine.png" alt="TDengine" width="140" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/teradata" title="Teradata"><img src="docs/static/img/databases/teradata.png" alt="Teradata" width="124" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/timescaledb" title="TimescaleDB"><img src="docs/static/img/databases/timescale.png" alt="TimescaleDB" width="150" height="36" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/trino" title="Trino"><img src="docs/static/img/databases/trino.png" alt="Trino" width="89" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/vertica" title="Vertica"><img src="docs/static/img/databases/vertica.png" alt="Vertica" width="128" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/ydb" title="YDB"><img src="docs/static/img/databases/ydb.svg" alt="YDB" width="110" height="40" /></a> &nbsp;
  <a href="https://superset.apache.org/docs/databases/supported/yugabytedb" title="YugabyteDB"><img src="docs/static/img/databases/yugabyte.png" alt="YugabyteDB" width="150" height="26" /></a>
</p>
<!-- SUPPORTED_DATABASES_END -->

**A more comprehensive list of supported databases** along with the configuration instructions can be found [here](https://superset.apache.org/docs/databases).

Want to add support for your datastore or data engine? Read more [here](https://superset.apache.org/docs/frequently-asked-questions#does-superset-work-with-insert-database-engine-here) about the technical requirements.

## Installation and Configuration

Try out Superset's [quickstart](https://superset.apache.org/docs/quickstart/) guide or learn about [the options for production deployments](https://superset.apache.org/docs/installation/architecture/).

## Get Involved

- Ask and answer questions on [Stack Overflow](https://stackoverflow.com/questions/tagged/apache-superset) using the **apache-superset** tag
- [Join our community's Slack](https://bit.ly/join-superset-slack)
  and please read our [Slack Community Guidelines](https://github.com/apache/superset/blob/master/CODE_OF_CONDUCT.md#slack-community-guidelines)
- [Join our dev@superset.apache.org mailing list](https://lists.apache.org/list.html?dev@superset.apache.org). To join, simply send an email to [dev-subscribe@superset.apache.org](mailto:dev-subscribe@superset.apache.org)
- Follow us on social media:
  [X](https://x.com/apachesuperset) |
  [LinkedIn](https://www.linkedin.com/company/apache-superset) |
  [Bluesky](https://bsky.app/profile/apachesuperset.bsky.social) |
  [Reddit](https://reddit.com/r/apache-superset)
- If you want to help troubleshoot GitHub Issues involving the numerous database drivers that Superset supports, please consider adding your name and the databases you have access to on the [Superset Database Familiarity Rolodex](https://docs.google.com/spreadsheets/d/1U1qxiLvOX0kBTUGME1AHHi6Ywel6ECF8xk_Qy-V9R8c/edit#gid=0)
- Join Superset's Town Hall and [Operational Model](https://preset.io/blog/the-superset-operational-model-wants-you/) recurring meetings. Meeting info is available on the [Superset Community Calendar](https://superset.apache.org/community)

## Contributor Guide

Interested in contributing? Check out our [Developer Guide](https://superset.apache.org/developer-docs/) for resources and a detailed setup guide.

## Resources

- [Superset "In the Wild"](https://superset.apache.org/inTheWild) - see who's using Superset, and [add your organization](https://github.com/apache/superset/edit/master/RESOURCES/INTHEWILD.yaml) to the list!
- [Feature Flags](https://superset.apache.org/docs/configuration/feature-flags) - the status of Superset's Feature Flags.
- [Standard Roles](https://github.com/apache/superset/blob/master/RESOURCES/STANDARD_ROLES.md) - How RBAC permissions map to roles.
- [Superset Wiki](https://github.com/apache/superset/wiki) - Tons of additional community resources: best practices, community content and other information.
- [Superset SIPs](https://github.com/orgs/apache/projects/170) - The status of Superset's SIPs (Superset Improvement Proposals) for both consensus and implementation status.

Understanding the Superset Points of View

- [The Case for Dataset-Centric Visualization](https://preset.io/blog/dataset-centric-visualization/)
- [Understanding the Superset Semantic Layer](https://preset.io/blog/understanding-superset-semantic-layer/)

- Getting Started with Superset
  - [Superset in 2 Minutes using Docker Compose](https://superset.apache.org/admin-docs/installation/docker-compose)
  - [Installing Database Drivers](https://superset.apache.org/user-docs/databases#installing-database-drivers)
  - [Building New Database Connectors](https://preset.io/blog/building-database-connector/)
  - [Create Your First Dashboard](https://superset.apache.org/docs/using-superset/creating-your-first-dashboard/)
  - [Comprehensive Tutorial for Contributing Code to Apache Superset
    ](https://preset.io/blog/tutorial-contributing-code-to-apache-superset/)
- [Resources to master Superset by Preset](https://preset.io/resources/)

- Deploying Superset

  - [Official Docker image](https://hub.docker.com/r/apache/superset)
  - [Helm Chart](https://github.com/apache/superset/tree/master/helm/superset)

- Recordings of Past [Superset Community Events](https://preset.io/events)

  - [Mixed Time Series Charts](https://preset.io/events/mixed-time-series-visualization-in-superset-workshop/)
  - [How the Bing Team Customized Superset for the Internal Self-Serve Data & Analytics Platform](https://preset.io/events/how-the-bing-team-heavily-customized-superset-for-their-internal-data/)
  - [Live Demo: Visualizing MongoDB and Pinot Data using Trino](https://preset.io/events/2021-04-13-visualizing-mongodb-and-pinot-data-using-trino/)
  - [Introduction to the Superset API](https://preset.io/events/introduction-to-the-superset-api/)
  - [Building a Database Connector for Superset](https://preset.io/events/2021-02-16-building-a-database-connector-for-superset/)

- Visualizations

  - [Creating Viz Plugins](https://superset.apache.org/docs/contributing/creating-viz-plugins/)
  - [Managing and Deploying Custom Viz Plugins](https://medium.com/nmc-techblog/apache-superset-manage-custom-viz-plugins-in-production-9fde1a708e55)
  - [Why Apache Superset is Betting on Apache ECharts](https://preset.io/blog/2021-4-1-why-echarts/)

- [Superset API](https://superset.apache.org/docs/rest-api)

<!--
  The OSS Insight "Repo Activity" widget (https://next.ossinsight.io/) was
  intentionally removed. This README is rendered on the ASF-hosted website
  (superset.apache.org), so its contents are subject to ASF's third-party
  content and CSP rules. OSS Insight has no Data Processing Agreement (DPA)
  with the ASF, so we cannot embed its images/widgets here. Do not re-add it.
-->

<!-- telemetry/analytics pixel: -->
<img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=bc1c90cd-bc04-4e11-8c7b-289fb2839492" />
