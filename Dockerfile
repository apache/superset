#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

######################################################################
# Node stage to deal with static asset construction
######################################################################
# Base images are pinned by digest so builds are reproducible and cached
# stages don't silently outlive base image updates. Renovate
# (.github/renovate.json) refreshes the digests weekly; when changing a tag
# by hand, bump its digest too. PY_VER carries its digest, so overriding it
# (e.g. the py311/py312 presets) replaces both.
ARG PY_VER=3.11-slim-trixie@sha256:b7a9e5f6a93d6d4a31f129bbd4bdee69efccb6ded0fb230d78aafaf37af98377

# If BUILDPLATFORM is null, set it to 'amd64' (or leave as is otherwise).
ARG BUILDPLATFORM=${BUILDPLATFORM:-amd64}

# Include translations in the final build
ARG BUILD_TRANSLATIONS="false"

######################################################################
# system-ca exposes the system CA bundle of the pinned python image. The
# node base images ship no CA store, so the Node stages copy this one in
# and verify TLS against the same store as the Python stages, rather than
# Node's built-in CA list.
######################################################################
FROM python:${PY_VER} AS system-ca

######################################################################
# superset-node-manifests holds only the npm manifests of the frontend
# tree (the root package.json + lockfile, .npmrc, and every workspace package.json),
# so the `npm ci` layer in superset-node-ci can see the workspaces and is
# cached on dependency declarations alone, not on every source change.
# Docker cannot COPY a glob while keeping the directory structure, hence
# the copy-then-prune stage.
######################################################################
FROM --platform=${BUILDPLATFORM} node:24-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea AS superset-node-manifests
WORKDIR /app/superset-frontend
COPY superset-frontend /app/superset-frontend
RUN find . -type f ! -name package.json ! -name package-lock.json ! -name .npmrc -delete \
    && find . -depth -type d -empty -delete

######################################################################
# superset-node-ci used as a base for building frontend assets and CI
######################################################################
FROM --platform=${BUILDPLATFORM} node:24-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea AS superset-node-ci
ARG BUILD_TRANSLATIONS
ENV BUILD_TRANSLATIONS=${BUILD_TRANSLATIONS}
ARG DEV_MODE="false"           # Skip frontend build in dev mode
ENV DEV_MODE=${DEV_MODE}

COPY docker/ /app/docker/
# Arguments for build configuration
ARG NPM_BUILD_CMD="build"

# Install system dependencies required for node-gyp
RUN /app/docker/apt-install.sh build-essential python3 zstd

# Define environment variables for frontend build
ENV BUILD_CMD=${NPM_BUILD_CMD} \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Run the frontend memory monitoring script
RUN /app/docker/frontend-mem-nag.sh

WORKDIR /app/superset-frontend

# Create necessary folders to avoid errors in subsequent steps
RUN mkdir -p /app/superset/static/assets \
             /app/superset/translations

# Harden `npm ci` against transient npm-registry network blips (e.g. ECONNRESET),
# which otherwise fail the entire multi-platform image build with no retry.
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=600000

# Verify TLS against the system CA store (see system-ca)
COPY --from=system-ca /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV NODE_OPTIONS=--use-openssl-ca \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

# Install dependencies from the manifests alone (root + workspaces) if not in
# dev mode. With the workspace package.json files present, npm ci links the
# workspaces and installs their dependencies too, so the CI jobs that run
# in this image do not need an `npm i` of their own.
COPY --from=superset-node-manifests /app/superset-frontend /app/superset-frontend
RUN --mount=type=cache,target=/root/.cache \
    --mount=type=cache,target=/root/.npm \
    if [ "${DEV_MODE}" = "false" ]; then \
        npm ci; \
    else \
        echo "Skipping 'npm ci' in dev mode"; \
    fi

# Runs the webpack build process
COPY superset-frontend /app/superset-frontend

######################################################################
# superset-node is used for compiling frontend assets
######################################################################
FROM superset-node-ci AS superset-node

# Build the frontend if not in dev mode
RUN --mount=type=cache,target=/root/.npm \
    if [ "${DEV_MODE}" = "false" ]; then \
        echo "Running 'npm run ${BUILD_CMD}'"; \
        npm run ${BUILD_CMD}; \
    else \
        echo "Skipping 'npm run ${BUILD_CMD}' in dev mode"; \
    fi;

# Copy translation files
COPY superset/translations /app/superset/translations

# Build translations if enabled, then cleanup localization files
RUN if [ "${BUILD_TRANSLATIONS}" = "true" ]; then \
        npm run build-translation; \
    fi; \
    rm -rf /app/superset/translations/*/*/*.[po,mo];


######################################################################
# superset-websocket builds the realtime WebSocket (Node) server that
# ships in the official image, launched via docker/entrypoints/run-websocket.sh
######################################################################
FROM node:24-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea AS superset-websocket

# Harden `npm ci` against transient npm-registry network blips (e.g. ECONNRESET).
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=600000

# Verify TLS against the system CA store (see system-ca)
COPY --from=system-ca /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
ENV NODE_OPTIONS=--use-openssl-ca \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

WORKDIR /app/superset-websocket

# Install against the lockfile first (cached until it changes), then bundle the
# TypeScript server into a single self-contained CJS file (esbuild inlines every
# dependency), so the runtime image needs only the Node binary and dist/ — no
# node_modules to ship.
COPY superset-websocket/package.json superset-websocket/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY superset-websocket/ ./
RUN npm run build


######################################################################
# Base python layer
######################################################################
FROM python:${PY_VER} AS python-base

ARG SUPERSET_HOME="/app/superset_home"
ENV SUPERSET_HOME=${SUPERSET_HOME}

RUN mkdir -p ${SUPERSET_HOME}
RUN useradd --user-group -d ${SUPERSET_HOME} -m --no-log-init --shell /bin/bash superset \
    && chmod -R 1777 ${SUPERSET_HOME} \
    && chown -R superset:superset ${SUPERSET_HOME}

# Some bash scripts needed throughout the layers
COPY --chmod=755 docker/*.sh /app/docker/

# Use the system CA store for every download in the Python stages, rather than
# the CA lists pip and uv bundle. UV_SYSTEM_CERTS needs uv>=0.11.0.
ENV PIP_CERT=/etc/ssl/certs/ca-certificates.crt \
    UV_SYSTEM_CERTS=true

RUN pip install --no-cache-dir --upgrade "uv>=0.11.0"

# Using uv as it's faster/simpler than pip
RUN uv venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"

######################################################################
# Python translation compiler layer
######################################################################
FROM python-base AS python-translation-compiler

ARG BUILD_TRANSLATIONS
ENV BUILD_TRANSLATIONS=${BUILD_TRANSLATIONS}

# Install Python dependencies using docker/pip-install.sh
COPY requirements/translations.txt requirements/
RUN --mount=type=cache,target=/root/.cache/uv \
    . /app/.venv/bin/activate && /app/docker/pip-install.sh --requires-build-essential -r requirements/translations.txt

COPY superset/translations/ /app/translations_mo/
RUN if [ "${BUILD_TRANSLATIONS}" = "true" ]; then \
        pybabel compile --use-fuzzy -d /app/translations_mo || true; \
    fi; \
    rm -f /app/translations_mo/*/*/*.[po,json]

######################################################################
# Python APP common layer
######################################################################
FROM python-base AS python-common

ENV SUPERSET_HOME="/app/superset_home" \
    HOME="/app/superset_home" \
    SUPERSET_ENV="production" \
    FLASK_APP="superset.app:create_app()" \
    PYTHONPATH="/app/pythonpath" \
    SUPERSET_PORT="8088"

# Copy the entrypoints, make them executable in userspace
COPY --chmod=755 docker/entrypoints /app/docker/entrypoints

WORKDIR /app
# Set up necessary directories
RUN mkdir -p \
      ${PYTHONPATH} \
      superset/static \
      requirements \
      superset-frontend \
      apache_superset.egg-info \
      requirements \
    && touch superset/static/version_info.json

# Optionally install Playwright and the headless Chromium used for screenshots.
# `playwright install` runs on Playwright's bundled Node; --use-openssl-ca makes
# it use the system CA store, consistent with the rest of the build.
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright-browsers

ARG INCLUDE_CHROMIUM="false"
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    if [ "${INCLUDE_CHROMIUM}" = "true" ]; then \
        uv pip install playwright && \
        playwright install-deps && \
        NODE_OPTIONS=--use-openssl-ca SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
            playwright install chromium; \
    else \
        echo "Skipping browser installation"; \
    fi

# Copy required files for Python build
COPY pyproject.toml setup.py MANIFEST.in README.md ./
COPY superset-frontend/package.json superset-frontend/
COPY scripts/check-env.py scripts/

# keeping for backward compatibility
COPY --chmod=755 ./docker/entrypoints/run-server.sh /usr/bin/

# Some debian libs
RUN /app/docker/apt-install.sh curl libsasl2-dev libsasl2-modules-gssapi-mit libpq-dev libldap2-dev pkg-config default-libmysqlclient-dev

# Create data directory for DuckDB examples database
# The database file will be created at runtime when examples are loaded from Parquet files
RUN mkdir -p /app/data && chown -R superset:superset /app/data

# --- Realtime WebSocket server (part of the official image) ---------------
# The realtime transport (superset-websocket) is a Node service, bundled by
# esbuild into a single self-contained file. Copy the Node runtime plus that
# bundle so every image built from this stage can launch it via an alternate
# entrypoint (docker/entrypoints/run-websocket.sh) rather than needing a separate
# image. This lives here rather than in a single downstream stage so the lean and
# dev images both ship it — docker-compose-non-dev.yml runs the websocket service
# from the dev target.
RUN /app/docker/apt-install.sh libstdc++6
COPY --from=superset-websocket /usr/local/bin/node /usr/local/bin/node
COPY --from=superset-websocket --chown=superset:superset \
    /app/superset-websocket/dist /app/superset-websocket/dist

HEALTHCHECK CMD /app/docker/docker-healthcheck.sh
CMD ["/app/docker/entrypoints/run-server.sh"]
EXPOSE ${SUPERSET_PORT}

######################################################################
# Final lean image...
######################################################################
FROM python-common AS lean

# Install Python dependencies using docker/pip-install.sh.
# Requirements are installed *before* the application source is copied
# below so that source-only changes don't bust this (slow, network-bound)
# cache layer or defeat --cache-from.
COPY requirements/base.txt requirements/

# Copy superset-core package needed for editable install in base.txt
COPY superset-core superset-core

RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    /app/docker/pip-install.sh --requires-build-essential -r requirements/base.txt

# Copy compiled frontend assets and application source now that
# dependencies have been resolved and cached above.
COPY --from=superset-node /app/superset/static/assets superset/static/assets
# Copy service.worker.js optionally as it doesn't exist when DEV_MODE=true
COPY --from=superset-node /app/superset/static/service-worker.j[s] superset/static/service-worker.js

# TODO, when the next version comes out, use --exclude superset/translations
COPY superset superset
# TODO in the meantime, remove the .po files
RUN rm superset/translations/*/*/*.po

# Merging translations from backend and frontend stages
COPY --from=superset-node /app/superset/translations superset/translations
COPY --from=python-translation-compiler /app/translations_mo superset/translations

# Install the superset package itself. --no-deps because its dependencies
# were already installed from requirements/base.txt above, so this layer
# stays fast even though the source copy above changes on every edit.
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install -e . --no-deps
RUN python -m compileall /app/superset

USER superset

######################################################################
# Batteries-included default image: lean + common drivers, MCP and a
# headless Chromium. This is the image published under the plain tags
# (latest, master, <version>); the minimal image ships as `lean`.
######################################################################
FROM lean AS superset
USER root

# mysqlclient needs the MySQL client dev headers + pkg-config to build.
# python-common already installs the libs for postgres/sasl/ldap, so only
# the MySQL bits are added here — the minimal `lean` stage stays untouched.
RUN /app/docker/apt-install.sh pkg-config default-libmysqlclient-dev

# Bundle the common metadata/analytics drivers (postgres, mysql) and the
# MCP server dependencies (fastmcp) so the default image is usable without
# layering extra packages. Routed through pip-install.sh because mysqlclient
# is a source dist that needs a C compiler to build; the helper installs
# build-essential just for the build and purges it afterward (the lean base
# ships no compiler). The mysql client lib installed above stays, so the
# compiled extension can link against it at runtime.
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    /app/docker/pip-install.sh --requires-build-essential .[postgres,mysql,fastmcp]

# Bundle Playwright + a headless Chromium so Alerts & Reports and thumbnail
# generation work out of the box. Installed directly (rather than via the
# INCLUDE_CHROMIUM build arg on python-common) because this stage builds
# FROM lean, which is already past that arg. Chromium ships for both
# linux/amd64 and linux/arm64, so this works on multi-platform builds.
# See the INCLUDE_CHROMIUM step in python-common for --use-openssl-ca.
ARG INCLUDE_CHROMIUM="false"
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    if [ "${INCLUDE_CHROMIUM}" = "true" ]; then \
        uv pip install playwright \
        && playwright install-deps \
        && NODE_OPTIONS=--use-openssl-ca SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
            playwright install chromium; \
    else \
        echo "Skipping Playwright/Chromium installation"; \
    fi

USER superset

######################################################################
# Dev image...
######################################################################
FROM python-common AS dev
RUN /app/docker/apt-install.sh git pkg-config default-libmysqlclient-dev

# Debian libs needed for dev
COPY requirements/*.txt requirements/

# Copy local packages needed for editable installs in development.txt
COPY superset-core superset-core
COPY superset-extensions-cli superset-extensions-cli

# requirements/development.txt is generated by `uv pip compile` and embeds
# `-e .` (an editable install of this same package) as its first line. That
# self-reference needs the full superset/ source tree, which hasn't been
# copied in yet at this point, so it's stripped here; the real editable
# install of `.` runs below, once the source is present.
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    grep -vxF -- "-e ." requirements/development.txt > requirements/development-deps.txt && \
    /app/docker/pip-install.sh --requires-build-essential -r requirements/development-deps.txt

# Copy compiled frontend assets and application source now that
# dependencies have been resolved and cached above.
COPY --from=superset-node /app/superset/static/assets superset/static/assets
# Copy service.worker.js optionally as it doesn't exist when DEV_MODE=true
COPY --from=superset-node /app/superset/static/service-worker.j[s] superset/static/service-worker.js

# TODO, when the next version comes out, use --exclude superset/translations
COPY superset superset
# TODO in the meantime, remove the .po files
RUN rm superset/translations/*/*/*.po

# Merging translations from backend and frontend stages
COPY --from=superset-node /app/superset/translations superset/translations
COPY --from=python-translation-compiler /app/translations_mo superset/translations

# Install the superset package together with its postgres extra, using the
# same uv cache mount as the requirements install above. --no-deps because
# all dependencies (including the postgres extra's psycopg2-binary) are
# already installed from requirements/development.txt above.
# NOTE: source is bind-mounted over /app/superset in DEV_MODE, so a
# compileall pass here would be wasted work; unlike `lean`, `dev` skips it.
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install -e .[postgres] --no-deps

USER superset

######################################################################
# CI image...
######################################################################
FROM lean AS ci
USER root
RUN uv pip install .[postgres,duckdb]
USER superset
CMD ["/app/docker/entrypoints/docker-ci.sh"]

######################################################################
# Showtime image - lean + DuckDB for examples database
######################################################################
FROM lean AS showtime
USER root
RUN uv pip install .[duckdb]
USER superset
CMD ["/app/docker/entrypoints/docker-ci.sh"]
