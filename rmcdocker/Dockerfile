#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#

######################################################################
# Node stage to deal with static asset construction
######################################################################
ARG PY_VER=3.11-slim-bookworm

# If BUILDPLATFORM is null, set it to 'amd64' (or leave as is otherwise).
ARG BUILDPLATFORM=${BUILDPLATFORM:-amd64}

######################################################################
# superset-node-ci used as a base for building frontend assets and CI
######################################################################
FROM --platform=${BUILDPLATFORM} node:20-bookworm-slim AS superset-node-ci
ARG DEV_MODE="false"             # Skip frontend build in dev mode
ENV DEV_MODE=${DEV_MODE}

COPY docker/ /app/docker/

# Install system dependencies required for node-gyp
RUN /app/docker/apt-install.sh build-essential python3 zstd

# Define environment variables for frontend build
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
WORKDIR /app/superset-frontend
RUN mkdir -p /app/superset/static/assets

# First, copy only the package files. This improves Docker caching.
COPY superset-frontend/package.json superset-frontend/package-lock.json /app/superset-frontend/

# Now, run npm install. The files are writeable inside the container.
RUN --mount=type=cache,target=/root/.npm \
    if [ "$DEV_MODE" = "false" ]; then \
        npm install; \
    else \
        echo "Skipping 'npm install' in dev mode"; \
    fi

# Finally, copy the rest of the frontend source code for the build step.
COPY superset-frontend /app/superset-frontend

######################################################################
# superset-node used for compile frontend assets
######################################################################
FROM superset-node-ci AS superset-node

# Build the frontend if not in dev mode
RUN --mount=type=cache,target=/root/.npm \
    if [ "$DEV_MODE" = "false" ]; then \
        echo "Running 'npm run build'"; \
        npm run build; \
    else \
        echo "Skipping 'npm run build' in dev mode"; \
    fi;

######################################################################
# Base python layer
######################################################################
FROM python:${PY_VER} AS python-base

ARG SUPERSET_HOME="/app/superset_home"
ENV SUPERSET_HOME=${SUPERSET_HOME}
RUN mkdir -p $SUPERSET_HOME
RUN useradd --user-group -d ${SUPERSET_HOME} -m --no-log-init --shell /bin/bash superset
COPY --chmod=755 docker/*.sh /app/docker/
RUN pip install --no-cache-dir --upgrade uv
RUN uv venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"

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

WORKDIR /app
RUN mkdir -p ${PYTHONPATH} superset/static

# Install Playwright for reports/alerts
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install playwright && \
    playwright install-deps && \
    playwright install chromium

# Copy required files for Python build
COPY pyproject.toml setup.py MANIFEST.in README.md ./
COPY superset-frontend/package.json superset-frontend/

# Some debian libs required by Superset
RUN /app/docker/apt-install.sh \
      curl \
      libsasl2-dev \
      libsasl2-modules-gssapi-mit \
      libpq-dev \
      libecpg-dev \
      libldap2-dev

# Copy compiled assets from previous stage
COPY --from=superset-node /app/superset/static/assets superset/static/assets
COPY superset superset
RUN rm -rf superset/translations

# --- START: CRITICAL FIX ---
# Copy the entrypoint scripts, including the missing run-server.sh
COPY --chmod=755 docker/entrypoints /app/docker/entrypoints
COPY --chmod=755 ./docker/entrypoints/run-server.sh /usr/bin/
# --- END: CRITICAL FIX ---


######################################################################
# Final lean production image...
######################################################################
FROM python-common AS lean

# Install base Python dependencies
COPY requirements/base.txt requirements/
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    /app/docker/pip-install.sh --requires-build-essential -r requirements/base.txt

# --- START: YOUR CUSTOMIZATIONS ---
# Switch to root user to install custom dependencies
USER root
ENV DEBIAN_FRONTEND=noninteractive

# Install system packages for ODBC, FreeTDS, and bash
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    unixodbc \
    unixodbc-dev \
    freetds-bin \
    tdsodbc \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Specify bash as the shell for subsequent RUN commands
SHELL ["/bin/bash", "-c"]

# Install MS ODBC Driver 18
RUN OS_VERSION_ID=$(grep VERSION_ID /etc/os-release | cut -d '"' -f 2) && \
    CONFIG_URL_BASE="https://packages.microsoft.com/config" && \
    OS_TYPE=$(grep '^ID=' /etc/os-release | cut -d'=' -f2) && \
    if [[ "$OS_TYPE" == "debian" ]]; then \
        CONFIG_URL="${CONFIG_URL_BASE}/debian/${OS_VERSION_ID}/packages-microsoft-prod.deb"; \
    elif [[ "$OS_TYPE" == "ubuntu" ]]; then \
        CONFIG_URL="${CONFIG_URL_BASE}/ubuntu/${OS_VERSION_ID}/packages-microsoft-prod.deb"; \
    else \
        echo "ERROR: Unsupported OS type ${OS_TYPE} in base image." >&2; exit 1; \
    fi && \
    curl -sSL -O "${CONFIG_URL}" && \
    dpkg -i --force-confnew packages-microsoft-prod.deb && \
    rm packages-microsoft-prod.deb && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y msodbcsql18 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install your custom Python packages from requirements-local.txt
COPY ./rmcdocker/requirements-local.txt /app/
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install -r /app/requirements-local.txt

# Copy your custom superset_config.py for production
COPY ./rmcdocker/superset_config.py /app/pythonpath/

# Copy your custom assets and set correct ownership
COPY --chown=superset:superset files/ /app/superset/static/assets/custom/

# --- END: YOUR CUSTOMIZATIONS ---

# Install the superset package itself
RUN python -m ensurepip && pip install --upgrade pip

RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install .
RUN python -m compileall /app/superset

# Switch back to the non-root user for security
USER superset
