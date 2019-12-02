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

ARG PY_VER=3.6.9
FROM python:${PY_VER} AS superset-py

RUN mkdir /app \
        && apt-get update -y \
        && apt-get install -y --no-install-recommends \
            build-essential \
            default-libmysqlclient-dev \
            libpq-dev \
        && rm -rf /var/lib/apt/lists/*

COPY requirements* ./setup.py ./MANIFEST.in ./README.md ./app/
COPY superset /app/superset

RUN cd /app \
        && pip install --upgrade setuptools pip \
        && pip install -r requirements.txt -r requirements-dev.txt \
        && pip install -e .


FROM node:10-jessie AS superset-node

COPY ./superset/assets /app/superset/assets

RUN cd /app/superset/assets \
        && npm ci \
        && npm run build \
        && rm -rf node_modules

# Final lean image...
ARG PY_VER=3.6.9
FROM python:${PY_VER}

ENV FLASK_ENV=production \
    FLASK_APP="superset.app:create_app()" \
    PYTHONPATH="/app/pythonpath" \
    SUPERSET_HOME="/app/superset_home" \
    SUPERSET_PORT=8080

RUN useradd --user-group --no-create-home --no-log-init --shell /bin/bash superset \
        && mkdir -p ${SUPERSET_HOME} \
        && chown -R superset:superset /app \
        && apt-get update -y \
        && apt-get install -y --no-install-recommends \
            build-essential \
            default-libmysqlclient-dev \
            libpq-dev \
        && rm -rf /var/lib/apt/lists/*

COPY --from=superset-py --chown=superset:superset /app/superset /app/superset
COPY --from=superset-py /usr/local/lib/python3.6/site-packages/ /usr/local/lib/python3.6/site-packages/
# Copying site-packages doesn't move the CLIs, so let's copy them one by one
COPY --from=superset-py /usr/local/bin/superset /usr/local/bin/gunicorn /usr/local/bin/celery /usr/local/bin/flask /usr/bin/
COPY --from=superset-py /app/apache_superset.egg-info /app/apache_superset.egg-info

COPY --from=superset-node /app/superset/assets /app/superset/assets

# COPY ./docker/superset_config.py ${PYTHONPATH}/
COPY ./docker/docker-entrypoint.sh /usr/bin/

WORKDIR /app
USER superset
EXPOSE ${SUPERSET_PORT}

ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]

#RUN useradd --user-group --no-create-home --no-log-init --shell /bin/bash superset
#
## Configure environment
#ENV LANG=C.UTF-8 \
#    LC_ALL=C.UTF-8
#
#RUN apt-get update -y
#
## Install dependencies to fix `curl https support error` and `elaying package configuration warning`
#RUN apt-get install -y apt-transport-https apt-utils
#
## Install superset dependencies
## https://superset.incubator.apache.org/installation.html#os-dependencies
#RUN apt-get install -y build-essential libssl-dev \
#    libffi-dev python3-dev libsasl2-dev libldap2-dev libxi-dev
#
## Install extra useful tool for development
#RUN apt-get install -y vim less postgresql-client redis-tools
#
## Install nodejs for custom build
## https://superset.incubator.apache.org/installation.html#making-your-own-build
## https://nodejs.org/en/download/package-manager/
#RUN curl -sL https://deb.nodesource.com/setup_10.x | bash - \
#    && apt-get install -y nodejs
#
#WORKDIR /home/superset
#
#COPY requirements.txt .
#COPY requirements-dev.txt .
#COPY contrib/docker/requirements-extra.txt .
#
#RUN pip --default-timeout=120 install --upgrade setuptools pip \
#    && pip --default-timeout=120 install -r requirements.txt -r requirements-dev.txt -r requirements-extra.txt \
#    && rm -rf /root/.cache/pip
#
#COPY --chown=superset:superset superset superset
#
#ENV PATH=/home/superset/superset/bin:$PATH \
#    PYTHONPATH=/home/superset/superset/:$PYTHONPATH
#
#USER superset
#
#RUN cd superset/assets \
#    && npm ci \
#    && npm run build \
#    && rm -rf node_modules
#
#COPY contrib/docker/docker-init.sh .
#COPY contrib/docker/docker-entrypoint.sh /entrypoint.sh
#ENTRYPOINT ["/entrypoint.sh"]
#
#HEALTHCHECK CMD ["curl", "-f", "http://localhost:8088/health"]
#
#EXPOSE 8088
