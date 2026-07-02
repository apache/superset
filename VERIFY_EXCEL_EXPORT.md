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

# Verifying the dashboard "Export Data to Excel" feature locally

Everything runs in Docker under the compose project `amman-excel`, fully
isolated from your other superset stacks (distinct project name, no host-port
collisions: redis/db host bindings are dropped by the overlay).

## One-time setup

1. Create `docker/pythonpath_dev/superset_config_docker.py` (gitignored) with
   the S3/SMTP wiring for the overlay services:

   ```python
   EXCEL_EXPORT_S3_BUCKET = "dashboard-exports"
   EXCEL_EXPORT_S3_CLIENT_KWARGS = {
       "endpoint_url": "http://minio:9100",
       "aws_access_key_id": "minioadmin",
       "aws_secret_access_key": "minioadmin",
       "region_name": "us-east-1",
   }

   # Mailpit: plain SMTP, no TLS, no auth (defaults would try STARTTLS + login).
   SMTP_HOST = "mailpit"
   SMTP_PORT = 1025
   SMTP_STARTTLS = False
   SMTP_SSL = False
   SMTP_USER = None
   SMTP_PASSWORD = None
   SMTP_MAIL_FROM = "superset@example.com"
   ```

2. The pre-signed download link in the email points at `http://minio:9100/...`.
   For your **browser** to resolve `minio`, add one line to /etc/hosts:

   ```bash
   sudo sh -c 'echo "127.0.0.1 minio" >> /etc/hosts'
   ```

   (Skip this if you only verify via curl inside the network.)

## Start / stop

```bash
# start (first boot: installs deps + loads example dashboards, ~5-10 min)
docker compose -p amman-excel \
  -f docker-compose.yml -f docker-compose-excel-verify.yml \
  up -d superset superset-worker superset-init minio createbucket mailpit

# watch until init finishes
docker compose -p amman-excel logs -f superset-init | tail -5

# stop (keeps data)     / tear down completely (incl. volumes)
docker compose -p amman-excel down
docker compose -p amman-excel down -v
```

## The verification walk

| Where | What |
|---|---|
| http://localhost:8088 | Superset UI — login `admin` / `admin` |
| http://localhost:8025 | Mailpit — the "inbox" that catches the export email |
| http://localhost:9101 | MinIO console (`minioadmin`/`minioadmin`) — see the uploaded .xlsx |

1. Open any example dashboard (e.g. "Sales Dashboard").
2. Header `⋯` menu → **Export Data to Excel** → confirm the toast.
3. Watch the worker: `docker compose -p amman-excel logs -f superset-worker`
   — expect `Task export_dashboard_excel[...] succeeded`.
4. Open Mailpit (localhost:8025) → email "[Report] Your dashboard export is
   ready: …" → click the download button → the .xlsx downloads.
5. Open the workbook: one sheet per chart, named `<chart id> - <chart name>`;
   charts without a saved query context are listed in the email as omitted.

## Negative paths worth clicking

- Comment out `EXCEL_EXPORT_S3_BUCKET` in
  `docker/pythonpath_dev/superset_config_docker.py`, restart the `superset`
  service, and hit the endpoint → clean **501** "not configured".
- A dashboard with no charts → **400** "Dashboard has no charts to export."
- Tamper any character of the pre-signed URL's signature → MinIO rejects it.

## Files that make this work

- `docker-compose-excel-verify.yml` — compose overlay: MinIO + Mailpit +
  bucket bootstrap, resets conflicting redis/db host ports.
- `docker/pythonpath_dev/superset_config_docker.py` — gitignored local
  override (create it from the snippet above): S3 client kwargs pointing at
  MinIO, SMTP pointing at Mailpit.
- `docker/pythonpath_dev/superset_config.py` — adds
  `superset.tasks.export_dashboard_excel` to the docker dev CeleryConfig
  imports (without it, docker-compose exports silently no-op).
