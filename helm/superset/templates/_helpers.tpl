{{/*

 Licensed to the Apache Software Foundation (ASF) under one or more
 contributor license agreements.  See the NOTICE file distributed with
 this work for additional information regarding copyright ownership.
 The ASF licenses this file to You under the Apache License, Version 2.0
 (the "License"); you may not use this file except in compliance with
 the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

*/}}

{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "superset.name" -}}
  {{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "superset.fullname" -}}
  {{- if .Values.fullnameOverride -}}
    {{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
  {{- else -}}
    {{- $name := default .Chart.Name .Values.nameOverride -}}
    {{- if contains $name .Release.Name -}}
      {{- .Release.Name | trunc 63 | trimSuffix "-" -}}
    {{- else -}}
      {{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
    {{- end -}}
  {{- end -}}
{{- end -}}

{{/*
Create the name of the service account to use
*/}}
{{- define "superset.serviceAccountName" -}}
  {{- if .Values.serviceAccount.create -}}
    {{- default (include "superset.fullname" .) .Values.serviceAccountName -}}
  {{- else -}}
    {{- default "default" .Values.serviceAccountName -}}
  {{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "superset.chart" -}}
  {{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Generate Redis URL for SSL and non-SSL protocols
*/}}
{{- define "superset-redis-url" -}}
  {{- if .Values.supersetNode.connections.use_redis_ssl -}}
    {{- if .Values.supersetNode.connections.redis_password -}}
      rediss://:{env('REDIS_PASSWORD')}@{env('REDIS_HOST')}:{env('REDIS_PORT')}/0?ssl_cert_reqs={{- .Values.supersetNode.connections.use_redis_ssl.ssl_cert_reqs | default "none" -}}
    {{- else -}}
      rediss://{env('REDIS_HOST')}:{env('REDIS_PORT')}/0?ssl_cert_reqs={{- .Values.supersetNode.connections.use_redis_ssl.ssl_cert_reqs | default "none" -}}
    {{- end -}}
  {{- else -}}
    {{- if .Values.supersetNode.connections.redis_password -}}
      redis://:{env('REDIS_PASSWORD')}@{env('REDIS_HOST')}:{env('REDIS_PORT')}/0
    {{- else -}}
      redis://{env('REDIS_HOST')}:{env('REDIS_PORT')}/0
    {{- end -}}
  {{- end -}}
{{- end -}}

{{- define "superset-config" }}
import os
from flask_caching.backends.rediscache import RedisCache
import redis

redis_cache_config = redis.Redis(
  host=env('REDIS_HOST'), 
  port=env('REDIS_PORT'), 
  db=env('REDIS_DB', 1), 
  password=env('REDIS_PASSWORD'),
  {{- if .Values.supersetNode.connections.use_redis_ssl }}
  ssl=True, 
  ssl_cert_reqs={{- .Values.supersetNode.connections.use_redis_ssl.ssl_cert_reqs | default "none" | quote }},
  {{- end }}
)

def env(key, default=None):
    return os.getenv(key, default)

MAPBOX_API_KEY = env('MAPBOX_API_KEY', '')
CACHE_CONFIG = {
      'CACHE_TYPE': 'RedisCache',
      'CACHE_DEFAULT_TIMEOUT': 300,
      'CACHE_KEY_PREFIX': 'superset_',
      'CACHE_REDIS_HOST': redis_cache_config,
}
DATA_CACHE_CONFIG = CACHE_CONFIG

SQLALCHEMY_DATABASE_URI = f"postgresql+psycopg2://{env('DB_USER')}:{env('DB_PASS')}@{env('DB_HOST')}:{env('DB_PORT')}/{env('DB_NAME')}"
SQLALCHEMY_TRACK_MODIFICATIONS = True

class CeleryConfig:
  imports  = ("superset.sql_lab", )
  broker_url = f"{{- include "superset-redis-url" . -}}"
  result_backend = f"{{- include "superset-redis-url" . -}}"

CELERY_CONFIG = CeleryConfig
RESULTS_BACKEND = RedisCache(
      host=env('REDIS_HOST'),
      {{- if .Values.supersetNode.connections.redis_password }}
      password=env('REDIS_PASSWORD'),
      {{- end }}
      port=env('REDIS_PORT'),
      key_prefix='superset_results',
      {{- if .Values.supersetNode.connections.use_redis_ssl }}
      ssl=True, 
      ssl_cert_reqs={{- .Values.supersetNode.connections.use_redis_ssl.ssl_cert_reqs | default "none" | quote }},
      {{- end }}
)

{{ if .Values.configOverrides }}
# Overrides
{{- range $key, $value := .Values.configOverrides }}
# {{ $key }}
{{ tpl $value $ }}
{{- end }}
{{- end }}

{{ if .Values.configOverridesFiles }}
# Overrides from files
{{- $files := .Files }}
{{- range $key, $value := .Values.configOverridesFiles }}
# {{ $key }}
{{ $files.Get $value }}
{{- end }}
{{- end }}

{{- end }}
