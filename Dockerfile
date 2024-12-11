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
ARG PY_VER=3.10-slim-bookworm

# If BUILDPLATFORM is null, set it to 'amd64' (or leave as is otherwise).
ARG BUILDPLATFORM=${BUILDPLATFORM:-amd64}

######################################################################
# superset-node used for building frontend assets
######################################################################
FROM --platform=${BUILDPLATFORM} node:20-bullseye-slim AS superset-node
ARG BUILD_TRANSLATIONS="false" # Include translations in the final build
ENV BUILD_TRANSLATIONS=${BUILD_TRANSLATIONS}
ARG DEV_MODE="false"           # Skip frontend build in dev mode
ENV DEV_MODE=${DEV_MODE}

COPY --chmod=750 docker/*.sh /app/docker/

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

# Copy translation files
COPY superset/translations /app/superset/translations

# Mount package files and install dependencies if not in dev mode
RUN --mount=type=bind,source=./superset-frontend/package.json,target=./package.json \
    --mount=type=bind,source=./superset-frontend/package-lock.json,target=./package-lock.json \
    if [ "$DEV_MODE" = "false" ]; then \
        npm ci; \
    else \
        echo "Skipping 'npm ci' in dev mode"; \
    fi

# Runs the webpack build process
COPY superset-frontend /app/superset-frontend

# Build the frontend if not in dev mode
RUN if [ "$DEV_MODE" = "false" ]; then \
        echo "Running 'npm run ${BUILD_CMD}'"; \
        npm run build-translation; \
        npm run ${BUILD_CMD}; \
    else \
        echo "Skipping 'npm run ${BUILD_CMD}' in dev mode"; \
    fi


######################################################################
# Base python layer
######################################################################
FROM python:${PY_VER} AS python-base
ARG BUILD_TRANSLATIONS="false" # Include translations in the final build
ENV BUILD_TRANSLATIONS=${BUILD_TRANSLATIONS}
ARG DEV_MODE="false"           # Skip frontend build in dev mode
ENV DEV_MODE=${DEV_MODE}

# Some bash scripts needed throughout the layers
COPY --chmod=750 docker/*.sh /app/docker/

RUN pip install --no-cache-dir --upgrade setuptools pip uv

# Using uv as it's faster/simpler than pip
RUN uv venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"

# Install Playwright and optionally setup headless browsers
ARG INCLUDE_CHROMIUM="true"
ARG INCLUDE_FIREFOX="false"
RUN --mount=type=cache,target=/root/.cache/pip \
    if [ "$INCLUDE_CHROMIUM" = "true" ] || [ "$INCLUDE_FIREFOX" = "true" ]; then \
        pip install playwright && \
        playwright install-deps && \
        if [ "$INCLUDE_CHROMIUM" = "true" ]; then playwright install chromium; fi && \
        if [ "$INCLUDE_FIREFOX" = "true" ]; then playwright install firefox; fi; \
    else \
        echo "Skipping browser installation"; \
    fi


######################################################################
# Python common layer
######################################################################
FROM python-base AS python-common

WORKDIR /app
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    SUPERSET_ENV=production \
    FLASK_APP="superset.app:create_app()" \
    PYTHONPATH="/app/pythonpath" \
    SUPERSET_HOME="/app/superset_home" \
    SUPERSET_PORT=8088

# Set up necessary directories and user
RUN mkdir -p \
      {SUPERSET_HOME} \
      ${PYTHONPATH} \
      superset/static \
      requirements \
      superset-frontend \
      apache_superset.egg-info \
      requirements \
    && useradd --user-group -d ${SUPERSET_HOME} -m --no-log-init --shell /bin/bash superset \
    && touch superset/static/version_info.json

# Copy required files for Python build
COPY pyproject.toml setup.py MANIFEST.in README.md ./
COPY superset-frontend/package.json superset-frontend/
COPY scripts/check-env.py scripts/
COPY --chmod=750 ./docker/run-server.sh /usr/bin/

# Some debian libs
RUN /app/docker/apt-install.sh \
      curl \
      libsasl2-dev \
      libsasl2-modules-gssapi-mit \
      libpq-dev \
      libecpg-dev \
      libldap2-dev

# Copy the main Superset source code
COPY superset superset
# Copy .json translations from frontend image
COPY --from=superset-node /app/superset/translations superset/translations

# Copy the compiled frontend assets from the node image
COPY --from=superset-node /app/superset/static/assets superset/static/assets

# Add the translations script
COPY ./scripts/translations/generate_mo_files.sh ./scripts/translations/

HEALTHCHECK CMD curl -f "http://localhost:${SUPERSET_PORT}/health"
CMD ["/usr/bin/run-server.sh"]
EXPOSE ${SUPERSET_PORT}

######################################################################
# Final lean image...
######################################################################
FROM python-common AS lean

# Install Python dependencies using docker/pip-install.sh
COPY requirements/base.txt requirements/
RUN --mount=type=cache,target=/root/.cache/pip \
    /app/docker/pip-install.sh --requires-build-essential -r requirements/base.txt && \
    uv pip install . && \
    /app/docker/docker-translate.sh

RUN chown -R superset:superset /app && chmod -R 750 /app
USER superset

######################################################################
# Dev image...
######################################################################
FROM python-common AS dev

USER root

# Debian libs needed for dev
RUN /app/docker/apt-install.sh \
    git \
    pkg-config \
    default-libmysqlclient-dev

# Copy development requirements and install them
COPY requirements/*.txt requirements/
# Install Python dependencies using docker/pip-install.sh
RUN --mount=type=cache,target=/root/.cache/pip \
    /app/docker/pip-install.sh --requires-build-essential -r requirements/development.txt && \
    uv pip install . && \
    /app/docker/docker-translate.sh

# Compile translations
RUN /app/docker/docker-translate.sh

RUN chown -R superset:superset /app && chmod -R 750 /app
USER superset

######################################################################
# CI image...
######################################################################
FROM lean AS ci

CMD ["/app/docker/docker-ci.sh"]
