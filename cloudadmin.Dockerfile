ARG PY_VER=3.9-slim-bookworm

# if BUILDPLATFORM is null, set it to 'amd64' (or leave as is otherwise).
ARG BUILDPLATFORM=${BUILDPLATFORM:-amd64}
FROM --platform=${BUILDPLATFORM} node:16-bookworm-slim AS superset-node

ARG NPM_BUILD_CMD="build-dev"

RUN apt-get update -qq \
    && apt-get install -yqq --no-install-recommends \
        build-essential \
        python3

ENV BUILD_CMD=${NPM_BUILD_CMD} \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# NPM ci first, as to NOT invalidate previous steps except for when package.json changes
WORKDIR /app/superset-frontend

RUN --mount=type=bind,target=/frontend-mem-nag.sh,src=./docker/frontend-mem-nag.sh \
    /frontend-mem-nag.sh

COPY ./superset-frontend ./
RUN npm i
# This seems to be the most expensive step
RUN npm run ${BUILD_CMD}

######################################################################
# Final lean image...
######################################################################
FROM python:${PY_VER} AS lean

WORKDIR /app
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    SUPERSET_ENV=production \
    FLASK_APP="superset.app:create_app()" \
    PYTHONPATH="/app/pythonpath" \
    SUPERSET_HOME="/app/superset_home" \
    SUPERSET_PORT=8088

RUN --mount=target=/var/lib/apt/lists,type=cache \
    --mount=target=/var/cache/apt,type=cache \
    mkdir -p ${PYTHONPATH} superset/static superset-frontend apache_superset.egg-info requirements \
    && useradd --user-group -d ${SUPERSET_HOME} -m --no-log-init --shell /bin/bash superset \
    && apt-get update -qq && apt-get install -yqq --no-install-recommends \
        build-essential \
        curl \
        default-libmysqlclient-dev \
        libsasl2-dev \
        libsasl2-modules-gssapi-mit \
        libpq-dev \
        libecpg-dev \
        libldap2-dev \
    && touch superset/static/version_info.json \
    && chown -R superset:superset ./*

COPY --chown=superset:superset setup.py MANIFEST.in README.md ./
# setup.py uses the version information in package.json
COPY --chown=superset:superset superset-frontend/package.json superset-frontend/
RUN --mount=type=bind,target=./requirements/local.txt,src=./requirements/local.txt \
    --mount=type=bind,target=./requirements/development.txt,src=./requirements/development.txt \
    --mount=type=bind,target=./requirements/base.txt,src=./requirements/base.txt \
    --mount=type=bind,target=./requirements/cloudadmin.txt,src=./requirements/cloudadmin.txt \
    --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements/local.txt \
    pip install -r requirements/cloudadmin.txt

COPY --chown=superset:superset --from=superset-node /app/superset/static/assets superset/static/assets
## Lastly, let's install superset itself
COPY --chown=superset:superset superset superset
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -e . \
    && flask fab babel-compile --target superset/translations \
    && chown -R superset:superset superset/translations

COPY --chmod=755 ./docker/run-server.sh /usr/bin/
USER superset

HEALTHCHECK CMD curl -f "http://localhost:${SUPERSET_PORT}/health"

EXPOSE ${SUPERSET_PORT}

CMD ["/usr/bin/run-server.sh"]
