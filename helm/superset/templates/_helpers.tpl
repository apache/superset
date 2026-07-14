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
{{- $name := coalesce .Values.serviceAccount.name .Values.serviceAccountName -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "superset.fullname" .) $name -}}
{{- else -}}
{{- default "default" $name -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "superset.chart" -}}
  {{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels for all resources - follows Kubernetes recommended labels
https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/
*/}}
{{- define "superset.labels" -}}
helm.sh/chart: {{ include "superset.chart" . }}
{{ include "superset.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: superset
{{- if .Values.extraLabels }}
{{ toYaml .Values.extraLabels }}
{{- end }}
{{- end -}}

{{/*
Selector labels - used by selectors and matchLabels
*/}}
{{- define "superset.selectorLabels" -}}
app.kubernetes.io/name: {{ include "superset.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Component labels - extends superset.labels with component-specific labels
Usage: {{ include "superset.componentLabels" (dict "component" "web" "root" .) }}
*/}}
{{- define "superset.componentLabels" -}}
{{ include "superset.labels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Component selector labels - for matchLabels with component
Usage: {{ include "superset.componentSelectorLabels" (dict "component" "web" "root" .) }}
*/}}
{{- define "superset.componentSelectorLabels" -}}
{{ include "superset.selectorLabels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}


{{/*
Coalescing resolvers for DB and Redis connection parameters.
Each resolver checks (in order):
  1. New top-level database.* / cache.* values
  2. Legacy supersetNode.connections.* keys (deprecation path, using safe index to avoid errors on absent maps)
  3. cluster.* service name overrides
  4. Hard-coded defaults derived from the release name
Call with root context: {{ include "superset.db.host" . }}
*/}}

{{/*
Helper to safely read .Values.supersetNode.connections.<key> without erroring when maps are absent.
*/}}
{{- define "_superset.legacyConn" -}}
{{- $sn := index .Values "supersetNode" | default dict -}}
{{- $conn := index $sn "connections" | default dict -}}
{{- $conn | toJson -}}
{{- end -}}

{{- define "superset.db.host" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- tpl (coalesce .Values.database.host (index $conn "db_host") .Values.cluster.databaseServiceName (printf "%s-postgresql" .Release.Name)) $ -}}
{{- end -}}

{{- define "superset.db.port" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- if .Values.database.port -}}
{{- .Values.database.port | toString -}}
{{- else -}}
{{- coalesce (index $conn "db_port") "5432" -}}
{{- end -}}
{{- end -}}

{{- define "superset.db.user" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- coalesce .Values.database.user (index $conn "db_user") "superset" -}}
{{- end -}}

{{- define "superset.db.password" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- coalesce .Values.database.password (index $conn "db_pass") "superset" -}}
{{- end -}}

{{- define "superset.db.name" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- coalesce .Values.database.name (index $conn "db_name") "superset" -}}
{{- end -}}

{{- define "superset.db.driver" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- coalesce .Values.database.driver (index $conn "db_type") "postgresql+psycopg2" -}}
{{- end -}}

{{- define "superset.redis.host" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- tpl (coalesce .Values.cache.host (index $conn "redis_host") .Values.cluster.redisServiceName (printf "%s-redis-headless" .Release.Name)) $ -}}
{{- end -}}

{{- define "superset.redis.port" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- if .Values.cache.port -}}
{{- .Values.cache.port | toString -}}
{{- else -}}
{{- coalesce (index $conn "redis_port") "6379" -}}
{{- end -}}
{{- end -}}

{{- define "superset.redis.user" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- coalesce .Values.cache.user (index $conn "redis_user") "" -}}
{{- end -}}

{{- define "superset.redis.password" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- coalesce .Values.cache.password (index $conn "redis_password") "" -}}
{{- end -}}

{{- define "superset.redis.cacheDb" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- if not (kindIs "invalid" .Values.cache.cacheDb) -}}
{{- .Values.cache.cacheDb | toString -}}
{{- else -}}
{{- coalesce (index $conn "redis_cache_db") "1" -}}
{{- end -}}
{{- end -}}

{{- define "superset.redis.celeryDb" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- if not (kindIs "invalid" .Values.cache.celeryDb) -}}
{{- .Values.cache.celeryDb | toString -}}
{{- else -}}
{{- coalesce (index $conn "redis_celery_db") "0" -}}
{{- end -}}
{{- end -}}

{{- define "superset.redis.proto" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- if .Values.cache.driver }}{{ .Values.cache.driver }}{{- else if index $conn "redis_driver" }}{{ index $conn "redis_driver" }}{{- else if .Values.cache.ssl.enabled }}rediss{{- else }}redis{{- end -}}
{{- end -}}

{{- define "superset.config" }}
{{- /* SECURITY: Validate admin password is set if admin creation is enabled */}}
{{- if and .Values.init.createAdmin (or (not .Values.init.adminUser.password) (eq .Values.init.adminUser.password "")) }}
{{- fail "SECURITY ERROR: init.createAdmin is true but init.adminUser.password is empty. You must set a secure password using --set init.adminUser.password='your-password' or via external secret." }}
{{- end }}

import os
import json
from urllib.parse import quote
{{- if or .Values.config.cacheConfig .Values.config.dataCacheConfig .Values.config.resultsBackend .Values.config.celeryConfig .Values.cache.enabled }}
from flask_caching.backends.rediscache import RedisCache
{{- end }}

def env(key, default=None):
    return os.getenv(key, default)

{{- /* Database Configuration - Superset always requires a database */}}
{{- if .Values.database.uri }}
SQLALCHEMY_DATABASE_URI = {{ .Values.database.uri | quote }}
{{- else }}
{{- $driver := include "superset.db.driver" . }}
{{- $sslParams := "" }}
{{- if and (hasKey .Values.database "ssl") .Values.database.ssl.enabled }}
{{- $sslMode := .Values.database.ssl.mode | default "require" }}
{{- $sslParams = printf "?sslmode=%s" $sslMode }}
{{- end }}
SQLALCHEMY_DATABASE_URI = f"{{ $driver }}://{quote(env('DB_USER', ''), safe='')}:{quote(env('DB_PASS', ''), safe='')}@{env('DB_HOST')}:{env('DB_PORT')}/{env('DB_NAME')}{{ $sslParams }}"
{{- end }}
{{- if hasKey .Values.config "SQLALCHEMY_TRACK_MODIFICATIONS" }}
SQLALCHEMY_TRACK_MODIFICATIONS = {{ .Values.config.SQLALCHEMY_TRACK_MODIFICATIONS | toString | title }}
{{- else }}
SQLALCHEMY_TRACK_MODIFICATIONS = False
{{- end }}

{{- /* Redis Configuration - only if Redis cache is configured */}}
{{- if .Values.cache.enabled }}
{{- if .Values.cache.cacheUrl }}
CACHE_REDIS_URL = {{ .Values.cache.cacheUrl | quote }}
{{- else }}
{{- $useSSL := and (hasKey .Values.cache "ssl") .Values.cache.ssl.enabled }}
_redis_user = quote(env('REDIS_USER', ''), safe='')
_redis_password = quote(env('REDIS_PASSWORD', ''), safe='')
_redis_auth = f"{_redis_user}:{_redis_password}@" if (_redis_user or _redis_password) else ""
REDIS_BASE_URL = f"{{ include "superset.redis.proto" . }}://{_redis_auth}{env('REDIS_HOST')}:{env('REDIS_PORT')}"
{{- if $useSSL }}
{{- $sslCertReqs := .Values.cache.ssl.ssl_cert_reqs | default "required" }}
REDIS_URL_PARAMS = f"?ssl_cert_reqs={{ $sslCertReqs }}"
{{- else }}
REDIS_URL_PARAMS = ""
{{- end }}
{{- $cacheDb := include "superset.redis.cacheDb" . }}
CACHE_REDIS_URL = f"{REDIS_BASE_URL}/{{ $cacheDb }}{REDIS_URL_PARAMS}"
{{- end }}
{{- if .Values.cache.celeryUrl }}
CELERY_REDIS_URL = {{ .Values.cache.celeryUrl | quote }}
{{- else if not .Values.cache.cacheUrl }}
{{- $celeryDb := include "superset.redis.celeryDb" . }}
CELERY_REDIS_URL = f"{REDIS_BASE_URL}/{{ $celeryDb }}{REDIS_URL_PARAMS}"
{{- else }}
{{- if or .Values.config.celeryConfig (not .Values.cache.enabled) }}
{{- /* Custom celeryConfig provided or cache disabled - OK */}}
{{- else }}
{{- fail "CONFIGURATION ERROR: cache.cacheUrl is set but cache.celeryUrl is not set. When using cacheUrl, you must also set celeryUrl for Celery to work. Alternatively, set config.celeryConfig to provide a custom Celery configuration." }}
{{- end }}
{{- end }}
{{- end }}

{{- /* Cache Configuration */}}
{{- if .Values.config.cacheConfig }}
CACHE_CONFIG = json.loads({{ .Values.config.cacheConfig | toJson | quote }})
{{- else if .Values.cache.enabled }}
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': {{ .Values.cache.defaultTimeout | default (.Values.config.cacheDefaultTimeout | default 86400) | int }},
    'CACHE_KEY_PREFIX': {{ .Values.cache.keyPrefix | default "superset_" | quote }},
    'CACHE_REDIS_URL': CACHE_REDIS_URL,
}
{{- end }}

{{- if .Values.config.dataCacheConfig }}
DATA_CACHE_CONFIG = json.loads({{ .Values.config.dataCacheConfig | toJson | quote }})
{{- else if .Values.config.cacheConfig }}
DATA_CACHE_CONFIG = CACHE_CONFIG
{{- else if .Values.cache.enabled }}
DATA_CACHE_CONFIG = CACHE_CONFIG
{{- end }}

{{- /* SQLLAB_ASYNC_TIME_LIMIT_SEC - Required for async_queries module import (default: 6 hours) */}}
{{- if .Values.config.SQLLAB_ASYNC_TIME_LIMIT_SEC }}
SQLLAB_ASYNC_TIME_LIMIT_SEC = {{ .Values.config.SQLLAB_ASYNC_TIME_LIMIT_SEC | int }}
{{- else }}
from datetime import timedelta
SQLLAB_ASYNC_TIME_LIMIT_SEC = int(timedelta(hours=6).total_seconds())
{{- end }}

{{- /* Celery Configuration */}}
{{- if .Values.config.celeryConfig }}
{{- if kindIs "string" .Values.config.celeryConfig }}
{{ .Values.config.celeryConfig }}
{{- else }}
class CeleryConfig:
{{- range $key, $value := .Values.config.celeryConfig }}
    {{ $key }} = json.loads({{ $value | toJson | quote }})
{{- end }}

{{- if hasKey .Values.config.celeryConfig "imports" }}
CELERY_IMPORTS = CeleryConfig.imports
{{- else }}
CELERY_IMPORTS = ()
{{- end }}
CELERY_CONFIG = CeleryConfig
{{- end }}
{{- else if .Values.cache.enabled }}
from celery.schedules import crontab
from datetime import timedelta

class CeleryConfig:
    imports = (
        "superset.sql_lab",
        "superset.tasks.scheduler",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
    )
    broker_connection_retry_on_startup = True
    worker_prefetch_multiplier = 10
    task_acks_late = True
    broker_url = CELERY_REDIS_URL
    result_backend = CELERY_REDIS_URL
    task_annotations = {
        "sql_lab.get_sql_results": {
            "rate_limit": "100/s",
        },
    }
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="*", hour="*"),
            "options": {"expires": int(timedelta(weeks=1).total_seconds())},
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=0, hour=0),
        },
    }

CELERY_IMPORTS = CeleryConfig.imports
CELERY_CONFIG = CeleryConfig
{{- end }}

{{- /* Celery Worker Health Check - File-based health probes for Kubernetes */}}
{{- if and .Values.supersetWorker.healthCheck .Values.supersetWorker.healthCheck.enabled }}
# Celery Worker Health Check Configuration
import threading
from celery import bootsteps
from celery.signals import worker_ready, worker_shutdown, worker_init

_readiness_file = {{ .Values.supersetWorker.healthCheck.readinessFile | default "/tmp/celery_worker_ready" | quote }}
_liveness_file = {{ .Values.supersetWorker.healthCheck.livenessFile | default "/tmp/celery_worker_alive" | quote }}
_heartbeat_interval = {{ .Values.supersetWorker.healthCheck.livenessHeartbeatInterval | default 10 | int }}
_liveness_thread = None
_liveness_stop_event = None

@worker_ready.connect
def create_ready_file(sender, **kwargs):
    try:
        open(_readiness_file, 'w').close()
    except Exception as e:
        print(f"Warning: Could not create readiness file: {e}")

@worker_shutdown.connect
def remove_ready_file(sender, **kwargs):
    global _liveness_thread, _liveness_stop_event
    if _liveness_stop_event:
        _liveness_stop_event.set()
    if _liveness_thread:
        _liveness_thread.join(timeout=5)
    try:
        if os.path.exists(_readiness_file):
            os.remove(_readiness_file)
        if os.path.exists(_liveness_file):
            os.remove(_liveness_file)
    except Exception as e:
        print(f"Warning: Could not remove health check files: {e}")

@worker_init.connect
def start_liveness_heartbeat(sender, **kwargs):
    global _liveness_thread, _liveness_stop_event
    _liveness_stop_event = threading.Event()

    def update_liveness():
        while not _liveness_stop_event.is_set():
            try:
                with open(_liveness_file, 'w') as f:
                    f.write(str(os.getpid()))
            except Exception as e:
                print(f"Warning: Could not update liveness file: {e}")
            _liveness_stop_event.wait(_heartbeat_interval)

    _liveness_thread = threading.Thread(target=update_liveness, daemon=True)
    _liveness_thread.start()
{{- else }}
CELERY_WORKER_HEALTH_CHECK_ENABLED = False
{{- end }}

{{- /* Results Backend */}}
{{- $redisHostForBackend := include "superset.redis.host" . }}
{{- $redisPortForBackend := include "superset.redis.port" . }}
{{- $redisPasswordForBackend := include "superset.redis.password" . }}
{{- if .Values.config.resultsBackend }}
{{- if kindIs "string" .Values.config.resultsBackend }}
RESULTS_BACKEND = {{ .Values.config.resultsBackend }}
{{- else }}
RESULTS_BACKEND = RedisCache(
    host={{ $redisHostForBackend | quote }},
    {{- if $redisPasswordForBackend }}
    password={{ $redisPasswordForBackend | quote }},
    {{- end }}
    port={{ $redisPortForBackend | int }},
    key_prefix={{ .Values.cache.resultsBackendKeyPrefix | default "superset_results" | quote }},
    {{- if and (hasKey .Values.cache "ssl") .Values.cache.ssl.enabled }}
    ssl=True,
    ssl_cert_reqs={{ .Values.cache.ssl.ssl_cert_reqs | default "required" | quote }},
    {{- end }}
)
{{- end }}
{{- else if .Values.cache.enabled }}
RESULTS_BACKEND = RedisCache(
    host={{ $redisHostForBackend | quote }},
    {{- if $redisPasswordForBackend }}
    password={{ $redisPasswordForBackend | quote }},
    {{- end }}
    port={{ $redisPortForBackend | int }},
    key_prefix={{ .Values.cache.resultsBackendKeyPrefix | default "superset_results" | quote }},
    {{- if and (hasKey .Values.cache "ssl") .Values.cache.ssl.enabled }}
    ssl=True,
    ssl_cert_reqs={{ .Values.cache.ssl.ssl_cert_reqs | default "required" | quote }},
    {{- end }}
)
{{- end }}

{{- /* Global Async Queries Cache Backend */}}
{{- $redisUserForGaq := include "superset.redis.user" . }}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_CACHE_BACKEND }}
GLOBAL_ASYNC_QUERIES_CACHE_BACKEND = json.loads({{ .Values.config.GLOBAL_ASYNC_QUERIES_CACHE_BACKEND | toJson | quote }})
{{- else if .Values.cache.enabled }}
GLOBAL_ASYNC_QUERIES_CACHE_BACKEND = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_HOST": {{ $redisHostForBackend | quote }},
    "CACHE_REDIS_PORT": {{ $redisPortForBackend | int }},
    {{- if $redisUserForGaq }}
    "CACHE_REDIS_USER": {{ $redisUserForGaq | quote }},
    {{- end }}
    {{- if $redisPasswordForBackend }}
    "CACHE_REDIS_PASSWORD": {{ $redisPasswordForBackend | quote }},
    {{- else }}
    "CACHE_REDIS_PASSWORD": "",
    {{- end }}
    "CACHE_REDIS_DB": {{ .Values.cache.asyncQueries.db | default .Values.cache.cacheDb | default 0 | int }},
    "CACHE_KEY_PREFIX": {{ .Values.cache.asyncQueries.keyPrefix | default "qc-" | quote }},
    "CACHE_DEFAULT_TIMEOUT": {{ .Values.cache.asyncQueries.timeout | default 86400 | int }},
    {{- if and .Values.cache.sentinel .Values.cache.sentinel.enabled }}
    {{- if .Values.cache.sentinel.sentinels }}
    "CACHE_REDIS_SENTINELS": {{ .Values.cache.sentinel.sentinels | toJson }},
    {{- else }}
    {{- fail "CONFIGURATION ERROR: cache.sentinel.enabled is true but cache.sentinel.sentinels is not set. You must provide Sentinel host(s) in cache.sentinel.sentinels (e.g., [['sentinel-host', 26379]])." }}
    {{- end }}
    "CACHE_REDIS_SENTINEL_MASTER": {{ .Values.cache.sentinel.master | default "mymaster" | quote }},
    {{- if .Values.cache.sentinel.password }}
    "CACHE_REDIS_SENTINEL_PASSWORD": {{ .Values.cache.sentinel.password | quote }},
    {{- else }}
    "CACHE_REDIS_SENTINEL_PASSWORD": None,
    {{- end }}
    {{- end }}
    {{- if and (hasKey .Values.cache "ssl") .Values.cache.ssl.enabled }}
    "CACHE_REDIS_SSL": True,
    "CACHE_REDIS_SSL_CERTFILE": {{ if .Values.cache.ssl.certfile }}{{ .Values.cache.ssl.certfile | quote }}{{ else }}None{{ end }},
    "CACHE_REDIS_SSL_KEYFILE": {{ if .Values.cache.ssl.keyfile }}{{ .Values.cache.ssl.keyfile | quote }}{{ else }}None{{ end }},
    "CACHE_REDIS_SSL_CERT_REQS": {{ .Values.cache.ssl.ssl_cert_reqs | default "required" | quote }},
    "CACHE_REDIS_SSL_CA_CERTS": {{ if .Values.cache.ssl.ca_certs }}{{ .Values.cache.ssl.ca_certs | quote }}{{ else }}None{{ end }},
    {{- else }}
    "CACHE_REDIS_SSL": False,
    "CACHE_REDIS_SSL_CERTFILE": None,
    "CACHE_REDIS_SSL_KEYFILE": None,
    "CACHE_REDIS_SSL_CERT_REQS": {{ .Values.cache.ssl.ssl_cert_reqs | default "required" | quote }},
    "CACHE_REDIS_SSL_CA_CERTS": None,
    {{- end }}
}
{{- end }}

{{- /* Global Async Queries Results Backend */}}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_RESULTS_BACKEND }}
GLOBAL_ASYNC_QUERIES_RESULTS_BACKEND = json.loads({{ .Values.config.GLOBAL_ASYNC_QUERIES_RESULTS_BACKEND | toJson | quote }})
{{- else if .Values.cache.enabled }}
GLOBAL_ASYNC_QUERIES_RESULTS_BACKEND = {
    "backend": "redis",
    "host": {{ $redisHostForBackend | quote }},
    "port": {{ $redisPortForBackend | int }},
    "prefix": {{ .Values.cache.asyncQueries.keyPrefix | default "qc-" | quote }},
    "db": {{ .Values.cache.asyncQueries.db | default .Values.cache.cacheDb | default 0 | int }},
    {{- if $redisPasswordForBackend }}
    "password": {{ $redisPasswordForBackend | quote }},
    {{- end }}
}
{{- end }}

{{- /* Feature Flags */}}
{{- if .Values.featureFlags }}
FEATURE_FLAGS = {
{{- range $key, $value := .Values.featureFlags }}
{{- if kindIs "bool" $value }}
    "{{ $key }}": {{ if $value }}True{{ else }}False{{ end }},
{{- else if kindIs "string" $value }}
    "{{ $key }}": {{ $value | quote }},
{{- else if kindIs "float64" $value }}
    "{{ $key }}": {{ $value }},
{{- else if kindIs "int" $value }}
    "{{ $key }}": {{ $value }},
{{- else if kindIs "invalid" $value }}
    "{{ $key }}": None,
{{- else }}
    "{{ $key }}": json.loads({{ $value | toJson | quote }}),
{{- end }}
{{- end }}
}
{{- end }}

{{- /* FAB Security API - Required for List Roles view in 6.0.0+ */}}
{{- if not (hasKey .Values.config "FAB_ADD_SECURITY_API") }}
FAB_ADD_SECURITY_API = True
{{- end }}
{{- if not (hasKey .Values.config "FAB_ADD_SECURITY_VIEWS") }}
FAB_ADD_SECURITY_VIEWS = True
{{- end }}

{{- /* Global Async Queries Transport - Auto-configure for websockets if enabled */}}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_TRANSPORT }}
GLOBAL_ASYNC_QUERIES_TRANSPORT = {{ .Values.config.GLOBAL_ASYNC_QUERIES_TRANSPORT | quote }}
{{- else if .Values.supersetWebsockets.enabled }}
GLOBAL_ASYNC_QUERIES_TRANSPORT = "ws"
{{- else }}
GLOBAL_ASYNC_QUERIES_TRANSPORT = "polling"
{{- end }}

{{- /* Global Async Queries WebSocket URL */}}
{{- $wsUrl := "" }}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL }}
{{- $wsUrl = .Values.config.GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL }}
GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL = {{ $wsUrl | quote }}
{{- else if and .Values.supersetWebsockets.enabled .Values.supersetWebsockets.websocketUrl }}
{{- $wsUrl = .Values.supersetWebsockets.websocketUrl }}
GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL = {{ $wsUrl | quote }}
{{- else if .Values.supersetWebsockets.enabled }}
{{- $wsServiceName := .Values.cluster.websocketServiceName }}
{{- if not $wsServiceName }}
{{- $wsServiceName = printf "%s-ws" (include "superset.fullname" .) }}
{{- end }}
{{- $wsPort := .Values.supersetWebsockets.service.port | default 8080 }}
{{- $wsPath := "/ws" }}
{{- $clusterDomain := .Values.cluster.domain | default ".svc.cluster.local" }}
{{- $wsUrl = printf "ws://%s.%s%s:%d%s" $wsServiceName .Release.Namespace $clusterDomain $wsPort $wsPath }}
GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL = {{ $wsUrl | quote }}
{{- end }}

{{- /* Global Async Queries JWT Secret */}}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_JWT_SECRET }}
GLOBAL_ASYNC_QUERIES_JWT_SECRET = {{ .Values.config.GLOBAL_ASYNC_QUERIES_JWT_SECRET | quote }}
{{- else if and .Values.supersetWebsockets.enabled .Values.supersetWebsockets.config.jwtSecret }}
GLOBAL_ASYNC_QUERIES_JWT_SECRET = {{ .Values.supersetWebsockets.config.jwtSecret | quote }}
{{- end }}

{{- /* Global Async Queries JWT Cookie Settings */}}
{{- if hasKey .Values.config "GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE" }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE = {{ .Values.config.GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE | toString | title }}
{{- else if and .Values.supersetWebsockets.enabled (or (hasPrefix "wss://" $wsUrl) .Values.ingress.tls) }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE = True
{{- else if .Values.supersetWebsockets.enabled }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE = False
{{- end }}

{{- if .Values.config.GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE = {{ .Values.config.GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE | quote }}
{{- else if .Values.supersetWebsockets.enabled }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE = "Lax"
{{- end }}

{{- if .Values.config.GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME = {{ .Values.config.GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME | quote }}
{{- else if and .Values.supersetWebsockets.enabled .Values.supersetWebsockets.config.jwtCookieName }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME = {{ .Values.supersetWebsockets.config.jwtCookieName | quote }}
{{- end }}

{{- /* Content Security Policy (CSP) */}}
{{- if and .Values.supersetWebsockets.enabled $wsUrl (not (hasKey .Values.config "TALISMAN_CONFIG")) }}
TALISMAN_CONFIG = {
    "content_security_policy": {
        "base-uri": ["'self'"],
        "default-src": ["'self'"],
        "img-src": [
            "'self'",
            "blob:",
            "data:",
            "https://apachesuperset.gateway.scarf.sh",
            "https://static.scarf.sh/",
            "ows.terrestris.de",
            "https://cdn.document360.io",
        ],
        "worker-src": ["'self'", "blob:"],
        "connect-src": [
            "'self'",
            {{ $wsUrl | quote }},
            "https://api.mapbox.com",
            "https://events.mapbox.com",
            "https://tile.openstreetmap.org",
            "https://tile.osm.ch",
        ],
        "object-src": "'none'",
        "style-src": [
            "'self'",
            "'unsafe-inline'",
        ],
        "script-src": ["'self'", "'strict-dynamic'"],
    },
    "content_security_policy_nonce_in": ["script-src"],
    {{- if or (hasPrefix "wss://" $wsUrl) .Values.ingress.tls }}
    "force_https": True,
    "session_cookie_secure": True,
    {{- else }}
    "force_https": False,
    "session_cookie_secure": False,
    {{- end }}
}
{{- end }}

{{- /* General Configuration - iterate through all config values */}}
{{- range $key, $value := .Values.config }}
{{- if and (ne $key "cacheConfig") (ne $key "dataCacheConfig") (ne $key "celeryConfig") (ne $key "resultsBackend") (ne $key "GLOBAL_ASYNC_QUERIES_CACHE_BACKEND") (ne $key "GLOBAL_ASYNC_QUERIES_RESULTS_BACKEND") (ne $key "GLOBAL_ASYNC_QUERIES_TRANSPORT") (ne $key "GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL") (ne $key "GLOBAL_ASYNC_QUERIES_JWT_SECRET") (ne $key "GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE") (ne $key "GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE") (ne $key "GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME") (ne $key "TALISMAN_CONFIG") (ne $key "SQLLAB_ASYNC_TIME_LIMIT_SEC") (ne $key "SQLALCHEMY_TRACK_MODIFICATIONS") }}
{{- if kindIs "map" $value }}
{{ $key }} = json.loads({{ $value | toJson | quote }})
{{- else if kindIs "slice" $value }}
{{ $key }} = json.loads({{ $value | toJson | quote }})
{{- else if kindIs "bool" $value }}
{{ $key }} = {{ if $value }}True{{ else }}False{{ end }}
{{- else if kindIs "string" $value }}
{{- if or (hasPrefix "f\"" $value) (hasPrefix "F\"" $value) (hasPrefix "r\"" $value) (hasPrefix "R\"" $value) (hasPrefix "b\"" $value) (hasPrefix "B\"" $value) }}
{{ $key }} = {{ $value }}
{{- else }}
{{ $key }} = {{ $value | quote }}
{{- end }}
{{- else if kindIs "invalid" $value }}
{{ $key }} = None
{{- else }}
{{ $key }} = {{ $value | toJson }}
{{- end }}
{{- end }}
{{- end }}

{{- /* Custom Config Overrides */}}
{{- if .Values.configOverrides }}
# Custom Overrides
{{- range $key, $value := .Values.configOverrides }}
# {{ $key }}
{{ tpl $value $ }}
{{- end }}
{{- end }}

{{- if .Values.configOverridesFiles }}
# Overrides from files
{{- $files := .Files }}
{{- range $key, $value := .Values.configOverridesFiles }}
# {{ $key }}
{{ $files.Get $value }}
{{- end }}
{{- end }}

{{- end -}}

{{- define "superset.initScript" -}}
#!/bin/sh
set -eu
echo "Upgrading DB schema..."
superset db upgrade
echo "Initializing roles and permissions..."
superset init
echo "Init job: Creating admin user and loading initial data..."
{{- if .Values.init.createAdmin }}
echo "Creating admin user (if not present)..."
if superset fab list-users 2>/dev/null | grep -qF {{ printf "username:%s" .Values.init.adminUser.username | squote }}; then
  echo "Admin user already exists, skipping."
else
  superset fab create-admin \
      --username {{ .Values.init.adminUser.username | squote }} \
      --firstname {{ .Values.init.adminUser.firstname | squote }} \
      --lastname {{ .Values.init.adminUser.lastname | squote }} \
      --email {{ .Values.init.adminUser.email | squote }} \
      --password {{ .Values.init.adminUser.password | squote }}
fi
{{- else }}
echo "Skipping admin creation (init.createAdmin=false)"
{{- end }}
{{- if .Values.init.loadExamples }}
echo "Loading examples..."
superset load_examples
{{- else }}
echo "Skipping examples (init.loadExamples=false)"
{{- end }}
if [ -f "{{ .Values.extraConfigMountPath }}/import_datasources.yaml" ]; then
  echo "Importing database connections..."
  superset import_datasources -p {{ .Values.extraConfigMountPath }}/import_datasources.yaml
fi
echo "Init job complete."
{{- end -}}

{{/*
Deprecation warnings — returns a newline-separated list of active deprecation messages,
or empty string when no deprecated keys are set. Rendered in NOTES.txt after install/upgrade.
*/}}
{{- define "superset.deprecationWarnings" -}}
{{- $conn := include "_superset.legacyConn" . | fromJson -}}
{{- if gt (len (keys $conn)) 0 }}
- supersetNode.connections.* is deprecated; use database.* and cache.* (auto-mapped for now). See UPGRADING.md
{{- end }}
{{- if .Values.serviceAccountName }}
- root serviceAccountName is deprecated; use serviceAccount.name (auto-mapped for now). See UPGRADING.md
{{- end }}
{{- end -}}

{{- define "supersetNode.selectorLabels" -}}
app.kubernetes.io/name: {{ include "superset.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: web
{{- end }}

{{- define "supersetCeleryBeat.selectorLabels" -}}
app.kubernetes.io/name: {{ include "superset.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: celerybeat
{{- end }}

{{- define "supersetCeleryFlower.selectorLabels" -}}
app.kubernetes.io/name: {{ include "superset.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: flower
{{- end }}

{{- define "supersetWebsockets.selectorLabels" -}}
app.kubernetes.io/name: {{ include "superset.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: websocket
{{- end }}

{{- define "supersetWorker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "superset.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: worker
{{- end }}
