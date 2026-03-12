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
Check for deprecated configuration values and fail with helpful error message
This validates that users have migrated from deprecated configuration patterns.
*/}}
{{- define "superset.checkDeprecatedValues" -}}
{{- if and .Values.supersetNode .Values.supersetNode.connections }}
{{- fail "DEPRECATED: supersetNode.connections.* is no longer supported. Use database.* and cache.* instead. See UPGRADING.md" }}
{{- end }}
{{- if .Values.serviceAccountName }}
{{- fail "DEPRECATED: serviceAccountName at root level is no longer supported. Use serviceAccount.name instead. See UPGRADING.md" }}
{{- end }}
{{- end -}}

{{/*
URL-encode a string for use in URI userinfo (e.g. database user or password).
Reserved characters (@, :, /, #, ?, etc.) are percent-encoded so credentials
with special characters produce a valid connection string.
*/}}
{{- define "superset.urlencodeUserinfo" -}}
{{- $v := . | default "" | toString -}}
{{- $v | regexReplaceAll "%" "%25" | regexReplaceAll ":" "%3A" | regexReplaceAll "@" "%40" | regexReplaceAll "/" "%2F" | regexReplaceAll "\\?" "%3F" | regexReplaceAll "#" "%23" | regexReplaceAll "\\[" "%5B" | regexReplaceAll "\\]" "%5D" | regexReplaceAll " " "%20" | regexReplaceAll "\\\\" "%5C" -}}
{{- end -}}

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
Best Practice: https://helm.sh/docs/chart_best_practices/rbac
*/}}
{{- define "superset.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
    {{- default (include "superset.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
    {{- default "default" .Values.serviceAccount.name -}}
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
app.kubernetes.io/name: {{ include "superset.name" .root }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}


{{- define "superset.config" }}
{{- /* Check for deprecated configuration values */}}
{{- include "superset.checkDeprecatedValues" . }}
{{- /* SECURITY: Validate admin password is set if admin creation is enabled */}}
{{- /* Note: JWT secret validation is in deployment-ws.yaml since websocket config is in a separate secret */}}
{{- if and .Values.init.createAdmin (or (not .Values.init.adminUser.password) (eq .Values.init.adminUser.password "")) }}
{{- fail "SECURITY ERROR: init.createAdmin is true but init.adminUser.password is empty. You must set a secure password using --set init.adminUser.password='your-password' or via external secret." }}
{{- end }}
{{- /* PRODUCTION: Validate resource limits are set for production deployments */}}
{{- if and (not .Values.resources.limits) (not .Values.resources.requests) }}
{{- /* Note: This is a warning - pre-install validation job will also check this */}}
{{- /* Resource limits are critical for production to prevent resource exhaustion */}}
{{- end }}

import os
{{- if or .Values.config.cacheConfig .Values.config.dataCacheConfig .Values.config.resultsBackend .Values.config.celeryConfig .Values.cache.enabled }}
from flask_caching.backends.rediscache import RedisCache
{{- end }}

def env(key, default=None):
    return os.getenv(key, default)

{{- /* Database Configuration - Superset always requires a database */}}
{{- if .Values.database.uri }}
SQLALCHEMY_DATABASE_URI = {{ .Values.database.uri | quote }}
{{- else }}
{{- /* Determine database host - use explicit host, or default to service name */}}
{{- $dbHost := .Values.database.host }}
{{- if not $dbHost }}
{{- if .Values.cluster.databaseServiceName }}
{{- $dbHost = .Values.cluster.databaseServiceName }}
{{- else }}
{{- $dbHost = printf "%s-postgresql" .Release.Name }}
{{- end }}
{{- end }}
{{- $driver := .Values.database.driver | default "postgresql+psycopg2" }}
{{- $sslParams := "" }}
{{- if and (hasKey .Values.database "ssl") .Values.database.ssl.enabled }}
{{- $sslMode := .Values.database.ssl.mode | default "require" }}
{{- $sslParams = printf "?sslmode=%s" $sslMode }}
{{- end }}
SQLALCHEMY_DATABASE_URI = f"{{ $driver }}://{{ include "superset.urlencodeUserinfo" .Values.database.user }}:{{ include "superset.urlencodeUserinfo" .Values.database.password }}@{{ $dbHost }}:{{ .Values.database.port }}/{{ .Values.database.name }}{{ $sslParams }}"
{{- end }}
{{- if hasKey .Values.config "SQLALCHEMY_TRACK_MODIFICATIONS" }}
SQLALCHEMY_TRACK_MODIFICATIONS = {{ if .Values.config.SQLALCHEMY_TRACK_MODIFICATIONS }}True{{ else }}False{{ end }}
{{- else }}
SQLALCHEMY_TRACK_MODIFICATIONS = False
{{- end }}

{{- /* Cache/Redis host fallback - reuse same logic for results backend and GAQ backends so null host does not break runtime */}}
{{- $cacheHost := .Values.cache.host }}
{{- if not $cacheHost }}
{{- if .Values.cluster.redisServiceName }}
{{- $cacheHost = .Values.cluster.redisServiceName }}
{{- else }}
{{- $cacheHost = printf "%s-redis-headless" .Release.Name }}
{{- end }}
{{- end }}

{{- /* Redis Configuration - only if Redis cache is configured */}}
{{- if .Values.cache.enabled }}
{{- if .Values.cache.cacheUrl }}
CACHE_REDIS_URL = {{ .Values.cache.cacheUrl | quote }}
{{- else }}
{{- /* Automatically use rediss (SSL) protocol when SSL is enabled, otherwise use redis */}}
{{- /* Determine Redis host - use explicit host, or default to service name */}}
{{- $redisHost := .Values.cache.host }}
{{- if not $redisHost }}
{{- if .Values.cluster.redisServiceName }}
{{- $redisHost = .Values.cluster.redisServiceName }}
{{- else }}
{{- $redisHost = printf "%s-redis-headless" .Release.Name }}
{{- end }}
{{- end }}
{{- $redisUser := .Values.cache.user | default "" }}
{{- $redisPort := .Values.cache.port }}
{{- $redisPassword := .Values.cache.password }}
{{- $useSSL := and (hasKey .Values.cache "ssl") .Values.cache.ssl.enabled }}
{{- if $redisPassword }}
{{- if $redisUser }}
REDIS_BASE_URL = f"{{ if $useSSL }}rediss{{ else }}redis{{ end }}://{{ $redisUser }}:{{ $redisPassword }}@{{ $redisHost }}:{{ $redisPort }}"
{{- else }}
REDIS_BASE_URL = f"{{ if $useSSL }}rediss{{ else }}redis{{ end }}://:{{ $redisPassword }}@{{ $redisHost }}:{{ $redisPort }}"
{{- end }}
{{- else }}
REDIS_BASE_URL = f"{{ if $useSSL }}rediss{{ else }}redis{{ end }}://{{ $redisHost }}:{{ $redisPort }}"
{{- end }}
{{- if $useSSL }}
{{- $sslCertReqs := .Values.cache.ssl.ssl_cert_reqs | default "required" }}
REDIS_URL_PARAMS = f"?ssl_cert_reqs={{ $sslCertReqs }}"
{{- else }}
REDIS_URL_PARAMS = ""
{{- end }}
{{- $cacheDb := .Values.cache.cacheDb | default 1 }}
CACHE_REDIS_URL = f"{REDIS_BASE_URL}/{{ $cacheDb }}{REDIS_URL_PARAMS}"
{{- end }}
{{- if .Values.cache.celeryUrl }}
CELERY_REDIS_URL = {{ .Values.cache.celeryUrl | quote }}
{{- else if not .Values.cache.cacheUrl }}
{{- $celeryDb := .Values.cache.celeryDb | default 0 }}
CELERY_REDIS_URL = f"{REDIS_BASE_URL}/{{ $celeryDb }}{REDIS_URL_PARAMS}"
{{- else }}
{{- /* SECURITY: If cacheUrl is set but celeryUrl is not, Celery will fail. Validate this. */}}
{{- if or .Values.config.celeryConfig (not .Values.cache.enabled) }}
{{- /* Custom celeryConfig provided or cache disabled - OK */}}
{{- else }}
{{- fail "CONFIGURATION ERROR: cache.cacheUrl is set but cache.celeryUrl is not set. When using cacheUrl, you must also set celeryUrl for Celery to work. Alternatively, set config.celeryConfig to provide a custom Celery configuration." }}
{{- end }}
{{- end }}
{{- end }}

{{- /* Cache Configuration */}}
{{- if .Values.config.cacheConfig }}
CACHE_CONFIG = {{ .Values.config.cacheConfig | toJson | indent 2 }}
{{- else if .Values.cache.enabled }}
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': {{ .Values.cache.defaultTimeout | default (.Values.config.cacheDefaultTimeout | default 86400) | int }},
    'CACHE_KEY_PREFIX': {{ .Values.cache.keyPrefix | default "superset_" | quote }},
    'CACHE_REDIS_URL': CACHE_REDIS_URL,
}
{{- end }}

{{- if .Values.config.dataCacheConfig }}
DATA_CACHE_CONFIG = {{ .Values.config.dataCacheConfig | toJson | indent 2 }}
{{- else if .Values.config.cacheConfig }}
DATA_CACHE_CONFIG = CACHE_CONFIG
{{- else if .Values.cache.enabled }}
DATA_CACHE_CONFIG = CACHE_CONFIG
{{- end }}

{{- /* SQLLAB_ASYNC_TIME_LIMIT_SEC - Required for async_queries module import (default: 6 hours) */}}
{{- /* This MUST be set before Celery config imports async_queries, as it accesses current_app.config at module level */}}
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
    {{ $key }} = {{ $value | toJson }}
{{- end }}

CELERY_IMPORTS = getattr(CeleryConfig, "imports", ())
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
        # NOTE: async_queries is temporarily excluded due to a bug where it accesses current_app.config
        # at module import time without an app context. This causes worker/beat/flower to crash.
        # TODO: Re-enable when Superset fixes the issue or provides a workaround
        # "superset.tasks.async_queries",  # REQUIRED for GAQ
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
{{- /* See: https://medium.com/ambient-innovation/health-checks-for-celery-in-kubernetes-cf3274a3e106 */}}
{{- /* NOTE: These signals only fire for Celery workers, not beat or flower */}}
{{- if and .Values.supersetWorker.healthCheck .Values.supersetWorker.healthCheck.enabled }}
# Celery Worker Health Check Configuration
# File paths are injected at deploy time from values.yaml
# NOTE: worker_ready/worker_shutdown signals only fire for workers, not beat
import threading
from celery import bootsteps
from celery.signals import worker_ready, worker_shutdown, worker_init

# File paths for health check probes (from values.yaml)
_readiness_file = {{ .Values.supersetWorker.healthCheck.readinessFile | default "/tmp/celery_worker_ready" | quote }}
_liveness_file = {{ .Values.supersetWorker.healthCheck.livenessFile | default "/tmp/celery_worker_alive" | quote }}
_heartbeat_interval = {{ .Values.supersetWorker.healthCheck.livenessHeartbeatInterval | default 10 | int }}
_liveness_thread = None
_liveness_stop_event = None

# Readiness Probe: Create/remove file based on worker state
# These signals only fire for workers, safe to register globally
@worker_ready.connect
def create_ready_file(sender, **kwargs):
    """Create readiness file when Celery worker is ready to process tasks"""
    try:
        open(_readiness_file, 'w').close()
        print(f"Celery worker ready - created {_readiness_file}")
    except Exception as e:
        print(f"Warning: Could not create readiness file: {e}")

@worker_shutdown.connect
def remove_ready_file(sender, **kwargs):
    """Remove readiness file when Celery worker is shutting down"""
    global _liveness_thread, _liveness_stop_event
    # Stop the liveness heartbeat thread
    if _liveness_stop_event:
        _liveness_stop_event.set()
    if _liveness_thread:
        _liveness_thread.join(timeout=5)
    # Remove health check files
    try:
        if os.path.exists(_readiness_file):
            os.remove(_readiness_file)
            print(f"Celery worker shutdown - removed {_readiness_file}")
        if os.path.exists(_liveness_file):
            os.remove(_liveness_file)
            print(f"Celery worker shutdown - removed {_liveness_file}")
    except Exception as e:
        print(f"Warning: Could not remove health check files: {e}")

# Liveness Probe: Start heartbeat thread when worker initializes
# worker_init only fires for workers, not beat
@worker_init.connect
def start_liveness_heartbeat(sender, **kwargs):
    """Start the liveness heartbeat thread when worker initializes"""
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
    print(f"Celery liveness heartbeat started - updating {_liveness_file} every {_heartbeat_interval}s")
{{- else }}
CELERY_WORKER_HEALTH_CHECK_ENABLED = False
{{- end }}

{{- /* Results Backend */}}
{{- if .Values.config.resultsBackend }}
{{- if kindIs "string" .Values.config.resultsBackend }}
RESULTS_BACKEND = {{ .Values.config.resultsBackend }}
{{- else }}
RESULTS_BACKEND = RedisCache(
    host={{ $cacheHost | quote }},
    {{- if .Values.cache.password }}
    password={{ .Values.cache.password | quote }},
    {{- end }}
    port={{ .Values.cache.port | int }},
    key_prefix={{ .Values.cache.resultsBackendKeyPrefix | default "superset_results" | quote }},
    {{- if and (hasKey .Values.cache "ssl") .Values.cache.ssl.enabled }}
    ssl=True,
    ssl_cert_reqs={{ .Values.cache.ssl.ssl_cert_reqs | default "required" | quote }},
    {{- end }}
)
{{- end }}
{{- else if .Values.cache.enabled }}
RESULTS_BACKEND = RedisCache(
    host={{ $cacheHost | quote }},
    {{- if .Values.cache.password }}
    password={{ .Values.cache.password | quote }},
    {{- end }}
    port={{ .Values.cache.port | int }},
    key_prefix={{ .Values.cache.resultsBackendKeyPrefix | default "superset_results" | quote }},
    {{- if and (hasKey .Values.cache "ssl") .Values.cache.ssl.enabled }}
    ssl=True,
    ssl_cert_reqs={{ .Values.cache.ssl.ssl_cert_reqs | default "required" | quote }},
    {{- end }}
)
{{- end }}

{{- /* Global Async Queries Cache Backend - Required when using GLOBAL_ASYNC_QUERIES feature flag. Uses $cacheHost (same fallback as results backend). */}}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_CACHE_BACKEND }}
GLOBAL_ASYNC_QUERIES_CACHE_BACKEND = {{ .Values.config.GLOBAL_ASYNC_QUERIES_CACHE_BACKEND | toJson | indent 2 }}
{{- else if .Values.cache.enabled }}
GLOBAL_ASYNC_QUERIES_CACHE_BACKEND = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_HOST": {{ $cacheHost | quote }},
    "CACHE_REDIS_PORT": {{ .Values.cache.port | int }},
    "CACHE_REDIS_USER": {{ .Values.cache.user | default "" | quote }},
    {{- if .Values.cache.password }}
    "CACHE_REDIS_PASSWORD": {{ .Values.cache.password | quote }},
    {{- else }}
    "CACHE_REDIS_PASSWORD": "",
    {{- end }}
    "CACHE_REDIS_DB": {{ .Values.cache.asyncQueries.db | default .Values.cache.cacheDb | default 0 | int }},
    "CACHE_KEY_PREFIX": {{ .Values.cache.asyncQueries.keyPrefix | default "qc-" | quote }},
    "CACHE_DEFAULT_TIMEOUT": {{ .Values.cache.asyncQueries.timeout | default 86400 | int }},
    {{- if and .Values.cache.sentinel (ne (index .Values.cache.sentinel "enabled") false) }}
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

{{- /* Global Async Queries Results Backend - Required when using GLOBAL_ASYNC_QUERIES feature flag */}}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_RESULTS_BACKEND }}
GLOBAL_ASYNC_QUERIES_RESULTS_BACKEND = {{ .Values.config.GLOBAL_ASYNC_QUERIES_RESULTS_BACKEND | toJson | indent 2 }}
{{- else if .Values.cache.enabled }}
GLOBAL_ASYNC_QUERIES_RESULTS_BACKEND = {
    "backend": "redis",
    "host": {{ $cacheHost | quote }},
    "port": {{ .Values.cache.port | int }},
    "prefix": {{ .Values.cache.asyncQueries.keyPrefix | default "qc-" | quote }},
    "db": {{ .Values.cache.asyncQueries.db | default .Values.cache.cacheDb | default 0 | int }},
    {{- if .Values.cache.password }}
    "password": {{ .Values.cache.password | quote }},
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
{{- else }}
    "{{ $key }}": {{ $value | toJson }},
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

{{- /* Global Async Queries WebSocket URL - Auto-configure if websockets are enabled */}}
{{- $wsUrl := "" }}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL }}
{{- $wsUrl = .Values.config.GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL }}
GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL = {{ $wsUrl | quote }}
{{- else if and .Values.supersetWebsockets.enabled .Values.supersetWebsockets.websocketUrl }}
{{- $wsUrl = .Values.supersetWebsockets.websocketUrl }}
GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL = {{ $wsUrl | quote }}
{{- else if .Values.supersetWebsockets.enabled }}
{{- /* Default: Use service name - user should override with external URL accessible from browser */}}
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

{{- /* Global Async Queries JWT Secret - Required when using GLOBAL_ASYNC_QUERIES feature flag */}}
{{- /* Must match the JWT secret in the websocket server config.json */}}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_JWT_SECRET }}
GLOBAL_ASYNC_QUERIES_JWT_SECRET = {{ .Values.config.GLOBAL_ASYNC_QUERIES_JWT_SECRET | quote }}
{{- else if and .Values.supersetWebsockets.enabled .Values.supersetWebsockets.config.jwtSecret }}
GLOBAL_ASYNC_QUERIES_JWT_SECRET = {{ .Values.supersetWebsockets.config.jwtSecret | quote }}
{{- end }}

{{- /* Global Async Queries JWT Cookie Settings - Important for HTTPS/WSS */}}
{{- /* SECURE: Must be True when using HTTPS/WSS, otherwise browser won't send the cookie */}}
{{- if hasKey .Values.config "GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE" }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE = {{ if .Values.config.GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE }}True{{ else }}False{{ end }}
{{- else if and .Values.supersetWebsockets.enabled (or (hasPrefix "wss://" $wsUrl) .Values.ingress.tls) }}
{{- /* Auto-detect: Enable secure cookies when using wss:// or when TLS is configured */}}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE = True
{{- else if .Values.supersetWebsockets.enabled }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE = False
{{- end }}

{{- /* SAMESITE: Controls when browser sends the cookie */}}
{{- /* "Lax" is recommended for most cases, "None" required for cross-origin (but requires Secure=True) */}}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE = {{ .Values.config.GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE | quote }}
{{- else if .Values.supersetWebsockets.enabled }}
{{- /* Default to "Lax" for same-origin WebSocket connections */}}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE = "Lax"
{{- end }}

{{- /* JWT Cookie Name - must match websocket server config */}}
{{- if .Values.config.GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME = {{ .Values.config.GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME | quote }}
{{- else if and .Values.supersetWebsockets.enabled .Values.supersetWebsockets.config.jwtCookieName }}
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME = {{ .Values.supersetWebsockets.config.jwtCookieName | quote }}
{{- end }}

{{- /* Content Security Policy (CSP) - Auto-add WebSocket URL to connect-src when websockets are enabled */}}
{{- if and .Values.supersetWebsockets.enabled $wsUrl (not (hasKey .Values.config "TALISMAN_CONFIG")) }}
{{- /* Add WebSocket URL to CSP connect-src to allow browser WebSocket connections */}}
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
{{- if and (ne $key "cacheConfig") (ne $key "dataCacheConfig") (ne $key "celeryConfig") (ne $key "resultsBackend") (ne $key "GLOBAL_ASYNC_QUERIES_CACHE_BACKEND") (ne $key "GLOBAL_ASYNC_QUERIES_RESULTS_BACKEND") (ne $key "GLOBAL_ASYNC_QUERIES_TRANSPORT") (ne $key "GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL") (ne $key "GLOBAL_ASYNC_QUERIES_JWT_SECRET") (ne $key "GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE") (ne $key "GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE") (ne $key "GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME") (ne $key "TALISMAN_CONFIG") (ne $key "SQLLAB_ASYNC_TIME_LIMIT_SEC") }}
{{- if kindIs "map" $value }}
{{ $key }} = {{ $value | toJson | indent 2 }}
{{- else if kindIs "slice" $value }}
{{ $key }} = {{ $value | toJson }}
{{- else if kindIs "bool" $value }}
{{ $key }} = {{ if $value }}True{{ else }}False{{ end }}
{{- else if kindIs "string" $value }}
{{- if or (hasPrefix "f\"" $value) (hasPrefix "F\"" $value) (hasPrefix "r\"" $value) (hasPrefix "R\"" $value) (hasPrefix "b\"" $value) (hasPrefix "B\"" $value) }}
{{ $key }} = {{ $value }}
{{- else }}
{{ $key }} = {{ $value | quote }}
{{- end }}
{{- else }}
{{ $key }} = {{ $value | toJson }}
{{- end }}
{{- end }}
{{- end }}

{{- /* Custom Config Overrides - for advanced use cases */}}
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

{{- end }}

{{/*
Component-specific selector labels
These use the standardized Kubernetes recommended labels pattern:
  - app.kubernetes.io/name: Application name
  - app.kubernetes.io/instance: Release name  
  - app.kubernetes.io/component: Component identifier
See: https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/
*/}}

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

{{- define "supersetWorker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "superset.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: worker
{{- end }}

{{- define "supersetWebsockets.selectorLabels" -}}
app.kubernetes.io/name: {{ include "superset.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: websocket
{{- end }}


{{- define "superset.defaultInitContainers" -}}
{{- $waitCommands := "" }}
{{- /* Database - Superset always requires a database */}}
{{- /* Auto-detect host from release name if not explicitly set */}}
{{- $dbHost := .Values.database.host }}
{{- if not $dbHost }}
{{- if .Values.cluster.databaseServiceName }}
{{- $dbHost = .Values.cluster.databaseServiceName }}
{{- else }}
{{- $dbHost = printf "%s-postgresql" .Release.Name }}
{{- end }}
{{- end }}
{{- $dbPort := .Values.database.port | default 5432 }}
{{- $waitCommands = printf "-wait tcp://%s:%d" $dbHost (int $dbPort) }}
{{- /* Redis - only wait if cache is enabled */}}
{{- if .Values.cache.enabled }}
{{- $redisHost := .Values.cache.host }}
{{- if not $redisHost }}
{{- if .Values.cluster.redisServiceName }}
{{- $redisHost = .Values.cluster.redisServiceName }}
{{- else }}
{{- $redisHost = printf "%s-redis-headless" .Release.Name }}
{{- end }}
{{- end }}
{{- $redisPort := .Values.cache.port | default 6379 }}
{{- $waitCommands = printf "%s -wait tcp://%s:%d" $waitCommands $redisHost (int $redisPort) }}
{{- end }}
- name: wait-for-services
  image: "{{ .Values.initImage.repository }}:{{ .Values.initImage.tag }}"
  imagePullPolicy: "{{ .Values.initImage.pullPolicy }}"
  securityContext:
    allowPrivilegeEscalation: false
    {{- if ne (int .Values.runAsUser) 0 }}
    runAsNonRoot: true
    {{- end }}
    runAsUser: {{ .Values.runAsUser }}
    capabilities:
      drop:
        - ALL
  command:
    - /bin/sh
    - -c
    - |
      echo "Waiting for dependencies to be available..."
      dockerize {{ $waitCommands }} -timeout 120s
      echo "All dependencies are available!"
{{- end }}

{{/*
Init script for admin creation and initial data loading.
This runs AFTER the upgrade job has initialized the database.
NOTE: DB migrations are handled by the upgrade job, not here.
*/}}
{{- define "superset.initScript" -}}
#!/bin/sh
set -eu
echo "Init job: Creating admin user and loading initial data..."
{{- if .Values.init.createAdmin }}
echo "Creating admin user..."
superset fab create-admin \
    --username {{ .Values.init.adminUser.username | quote }} \
    --firstname {{ .Values.init.adminUser.firstname | quote }} \
    --lastname {{ .Values.init.adminUser.lastname | quote }} \
    --email {{ .Values.init.adminUser.email | quote }} \
    --password {{ .Values.init.adminUser.password | quote }} \
    || true
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
