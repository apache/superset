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

# Шаблоны отчетов

Superset предоставляет простой API для загрузки, хранения и генерации отчетов по ODT-шаблонам. Файлы можно сохранять в хранилище S3 и обязательно — в локальной директории. Если доступ к S3 отсутствует, приложение использует локальное хранилище, так что загрузка и использование шаблонов продолжают работать.

## Конфигурация

Ниже приведены параметры конфигурации, определяющие, где хранятся шаблоны:

```
REPORT_TEMPLATE_S3_ENDPOINT = 'http://minio:9000'
REPORT_TEMPLATE_S3_BUCKET = 'reports'
REPORT_TEMPLATE_S3_ACCESS_KEY = 'minioadmin'
REPORT_TEMPLATE_S3_SECRET_KEY = 'minioadmin'
REPORT_TEMPLATE_LOCAL_DIR = '/tmp/report_templates'
```

Переменная `REPORT_TEMPLATE_LOCAL_DIR` обязательна и указывает директорию на диске. При доступном S3 файл сначала сохраняется локально, а затем загружается на S3. Если загрузка на S3 не удалась, шаблон остаётся доступным в локальном хранилище.

## REST API

Ресурс `ReportTemplateRestApi` предоставляет следующие эндпоинты:

- `GET /api/v1/report_template/?limit=25&offset=0` – получить список шаблонов с пагинацией. В ответе поля `result` и `count`.
- `POST /api/v1/report_template/` – загрузить новый шаблон. Используется форма `multipart/form-data` с полями `template` (файл ODT), `name`, `dataset_id` и необязательным `description`.
- `DELETE /api/v1/report_template/<id>` – удалить шаблон из S3 и локальной директории.
- `GET /api/v1/report_template/<id>/download` – скачать файл шаблона.
- `POST /api/v1/report_template/<id>/generate` – сгенерировать отчёт по шаблону и вернуть готовый ODT-файл.

