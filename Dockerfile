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
# PY stage that simply does a pip install on our requirements
######################################################################
ARG PY_VER=3.7.9
FROM python:${PY_VER} AS superset-py

RUN mkdir /app \
        && apt-get update -y \
        && apt-get install -y --no-install-recommends \
            build-essential \
            default-libmysqlclient-dev \
            libpq-dev \
            libsasl2-dev \
            libecpg-dev \
            vim \
            less \
            postgresql-client \
            redis-tools \
        && rm -rf /var/lib/apt/lists/*


# First, we just wanna install requirements, which will allow us to utilize the cache
# in order to only build if and only if requirements change
COPY ./requirements/*.txt  /app/requirements/
COPY setup.py MANIFEST.in README.md /app/
COPY superset-frontend/package.json /app/superset-frontend/
RUN cd /app \
    && mkdir -p superset/static \
    && touch superset/static/version_info.json \
    && pip install --no-cache -r requirements/local.txt

######################################################################
# Node stage to deal with static asset construction
######################################################################
FROM node:14 AS superset-node

ARG NPM_VER=7
RUN npm install -g npm@${NPM_VER}

ARG NPM_BUILD_CMD="build"
ENV BUILD_CMD=${NPM_BUILD_CMD}

# NPM ci first, as to NOT invalidate previous steps except for when package.json changes
RUN mkdir -p /app/superset-frontend
RUN mkdir -p /app/superset/assets
COPY ./peak-docker/frontend-mem-nag.sh /
COPY ./superset-frontend/package* /app/superset-frontend/
RUN chmod +x /frontend-mem-nag.sh \
        && cd /app/superset-frontend \
        && npm ci

# Next, copy in the rest and let webpack do its thing
COPY ./superset-frontend /app/superset-frontend
# This seems to be the most expensive step
RUN cd /app/superset-frontend \
     && npm run ${BUILD_CMD} \
     && rm -rf node_modules


######################################################################
# Final lean image...
######################################################################
ARG PY_VER=3.7.9
FROM python:${PY_VER} AS lean

# Custom Arguments
ARG SUPERSET_ENV=$SUPERSET_ENV
ARG SQLALCHEMY_DATABASE_URI=$SQLALCHEMY_DATABASE_URI
ARG TENANT=$TENANT
ARG STAGE=$STAGE
ARG REDIS_ENDPOINT=$REDIS_ENDPOINT
ARG NO_OF_WORKERS=$NO_OF_WORKERS
ARG ADMIN_EMAIL=$ADMIN_EMAIL
ARG ADMIN_PASSWORD=$ADMIN_PASSWORD
ARG GUEST_EMAIL=$GUEST_EMAIL
ARG GUEST_PASSWORD=$GUEST_PASSWORD
ARG PEAK_USER_EMAIL=$PEAK_USER_EMAIL
ARG PEAK_USER_PASSWORD=$PEAK_USER_PASSWORD
ARG AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION
ARG COMMON_CONFIG_DATA_BUCKET=$COMMON_CONFIG_DATA_BUCKET
ARG REDSHIFT_DATABASE_URI=$REDSHIFT_DATABASE_URI
ARG PEAK_ADMIN_EMAIL=$PEAK_ADMIN_EMAIL
ARG PEAK_ADMIN_PASSWORD=$PEAK_ADMIN_PASSWORD

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    FLASK_ENV=production \
    SUPERSET_LOAD_EXAMPLES=no \
    CYPRESS_CONFIG=false \
    FLASK_APP="superset.app:create_app()" \
    PYTHONPATH="/app/pythonpath" \
    SUPERSET_HOME="/app/superset_home" \
    SUPERSET_PORT=8088 \
    SUPERSET_ENV=${SUPERSET_ENV} \
    SQLALCHEMY_DATABASE_URI=${SQLALCHEMY_DATABASE_URI} \
    TENANT=${TENANT} \
    STAGE=$STAGE \
    REDIS_ENDPOINT=${REDIS_ENDPOINT} \
    NO_OF_WORKERS=${NO_OF_WORKERS} \
    ADMIN_EMAIL=${ADMIN_EMAIL} \
    ADMIN_PASSWORD=${ADMIN_PASSWORD} \
    GUEST_EMAIL=${GUEST_EMAIL} \
    GUEST_PASSWORD=${GUEST_PASSWORD} \
    PEAK_USER_EMAIL=${PEAK_USER_EMAIL} \
    PEAK_USER_PASSWORD=${PEAK_USER_PASSWORD} \
    PEAK_ADMIN_EMAIL=${PEAK_ADMIN_EMAIL} \
    PEAK_ADMIN_PASSWORD=${PEAK_ADMIN_PASSWORD} \
    AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION} \
    COMMON_CONFIG_DATA_BUCKET=${COMMON_CONFIG_DATA_BUCKET} \
    REDSHIFT_DATABASE_URI=${REDSHIFT_DATABASE_URI}

RUN mkdir -p ${PYTHONPATH} \
        && useradd --user-group -d ${SUPERSET_HOME} -m --no-log-init --shell /bin/bash superset \
        && apt-get update -y \
        && apt-get install -y --no-install-recommends \
            build-essential \
            default-libmysqlclient-dev \
            libsasl2-modules-gssapi-mit \
            libpq-dev \
        && rm -rf /var/lib/apt/lists/*

COPY --from=superset-py /usr/local/lib/python3.7/site-packages/ /usr/local/lib/python3.7/site-packages/
# Copying site-packages doesn't move the CLIs, so let's copy them one by one
COPY --from=superset-py /usr/local/bin/gunicorn /usr/local/bin/celery /usr/local/bin/flask /usr/bin/
COPY --from=superset-py /usr/local/bin/supervisord /usr/bin/
COPY --from=superset-node /app/superset/static/assets /app/superset/static/assets
COPY --from=superset-node /app/superset-frontend /app/superset-frontend

## Lastly, let's install superset itself
COPY superset /app/superset
COPY setup.py MANIFEST.in README.md /app/

RUN cd /app \
        && mkdir -p peak-dashboard

RUN cd /app \
        && chown -R superset:superset * \
        && pip install -e . \
        && pip install eventlet

COPY ./peak-docker/docker-entrypoint.sh /usr/bin/
COPY ./supervisor/supervisord.conf /usr/bin/

RUN chmod +x /usr/bin/*.sh
RUN chmod +x /usr/bin/*.conf

# give permission to import dashboard folder
RUN chown superset:superset  ./app/peak-dashboard

WORKDIR /app

USER superset

######################################################################
# CI image...
######################################################################
FROM lean AS ci

COPY --chown=superset ./peak-docker/docker-init.sh /app/docker/
COPY --chown=superset ./peak-docker/docker-ci.sh /app/docker/

# Superset init Step

RUN chmod a+x /app/docker/*.sh && /app/docker/docker-ci.sh

# Superset Entrypoint Step

# HEALTHCHECK CMD curl -f "http://localhost:$SUPERSET_PORT/health"

EXPOSE ${SUPERSET_PORT}

ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
