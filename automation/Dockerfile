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

# Toolbox image for reproducing and validating the Devin automations that run
# against this fork (see automation/README.md). It is NOT the Superset app image
# (that is the top-level Dockerfile); it only bundles the scanners the nightly
# scan uses plus the GitHub CLI, so anyone can run the same checks locally.
#
#   docker build -t superset-automation -f automation/Dockerfile .
#   docker run --rm -it --user "$(id -u):$(id -g)" -v "$PWD":/workspace -e GH_TOKEN superset-automation
#
# Run with --user so the reports written to automation/out/ are owned by you,
# not root. HOME is pre-created world-writable so gh/npm/pip-audit caches work
# for any uid.
#
ARG PY_VER=3.11-slim-bookworm
FROM python:${PY_VER}

ARG NODE_MAJOR=24
ARG RUFF_VERSION=0.9.7

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/toolbox \
    WORKSPACE=/workspace

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bsdextrautils ca-certificates curl git gnupg jq \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs gh \
    && rm -rf /var/lib/apt/lists/*

# Same scanners the nightly-scan automation installs. ruff is pinned to the
# version in requirements/development.txt so results match CI.
RUN pip install pip-audit bandit radon "ruff==${RUFF_VERSION}"

COPY automation/scripts/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh \
    && mkdir -p ${HOME} ${WORKSPACE} && chmod 1777 ${HOME}

WORKDIR ${WORKSPACE}
CMD ["/bin/bash"]
