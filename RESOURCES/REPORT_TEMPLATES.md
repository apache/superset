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

# Report Templates

Superset provides a simple API to manage and generate reports from ODT templates.
Templates can be stored on Amazon S3 and are always kept in a local directory as
well. When the S3 storage is unavailable the system falls back to the local
storage so that templates can still be uploaded and used.

## Configuration

The following configuration values control where templates are stored:

```
REPORT_TEMPLATE_S3_ENDPOINT = 'http://minio:9000'
REPORT_TEMPLATE_S3_BUCKET = 'reports'
REPORT_TEMPLATE_S3_ACCESS_KEY = 'minioadmin'
REPORT_TEMPLATE_S3_SECRET_KEY = 'minioadmin'
REPORT_TEMPLATE_LOCAL_DIR = '/tmp/report_templates'
```

`REPORT_TEMPLATE_LOCAL_DIR` is required and defines the directory where files are
stored on disk. When S3 is reachable every upload is saved locally and then
uploaded to S3. If the upload to S3 fails the template remains available locally.

## REST API

The `ReportTemplateRestApi` exposes the following endpoints:

- `GET /api/v1/report_template/?limit=25&offset=0` – list templates with
  pagination. The response includes `result` and `count` fields.
- `POST /api/v1/report_template/` – upload a new template. The request must use
  `multipart/form-data` with the fields `template` (ODT file), `name`,
  `dataset_id` and optional `description`.
- `DELETE /api/v1/report_template/<id>` – delete a template and remove the file
  from S3 and the local directory.
- `GET /api/v1/report_template/<id>/download` – download the template file.
- `POST /api/v1/report_template/<id>/generate` – generate a report using the
  template and return the rendered ODT file.


