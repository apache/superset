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
ARG GIT_AUTH_TOKEN
ENV BUILD_CMD=${NPM_BUILD_CMD}
ENV NODE_AUTH_TOKEN=${GIT_AUTH_TOKEN}

# NPM ci first, as to NOT invalidate previous steps except for when package.json changes
RUN mkdir -p /app/superset-frontend
RUN mkdir -p /app/superset/assets
COPY ./docker/frontend-mem-nag.sh /
COPY ./superset-frontend/package* /app/superset-frontend/
COPY ./superset-frontend/.npmrc /app/superset-frontend/
RUN /frontend-mem-nag.sh \
        && cd /app/superset-frontend \
        && npm i

# Next, copy in the rest and let webpack do its thing
COPY ./superset-frontend /app/superset-frontend
# This is BY FAR the most expensive step (thanks Terser!)
RUN cd /app/superset-frontend \
        && npm run ${BUILD_CMD} \
        && rm -rf node_modules


######################################################################
# Final lean image...
######################################################################
ARG PY_VER=3.7.9
FROM python:${PY_VER} AS lean

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    FLASK_ENV=production \
    FLASK_APP="superset.app:create_app()" \
    PYTHONPATH="/app/pythonpath" \
    SUPERSET_HOME="/app/superset_home" \
    SUPERSET_PORT=8088

RUN useradd --user-group --no-create-home --no-log-init --shell /bin/bash superset \
        && mkdir -p ${SUPERSET_HOME} ${PYTHONPATH} \
        && apt-get update -y \
        && apt-get install -y --no-install-recommends \
            build-essential \
            default-libmysqlclient-dev \
            libpq-dev \
        && rm -rf /var/lib/apt/lists/*

COPY --from=superset-py /usr/local/lib/python3.7/site-packages/ /usr/local/lib/python3.7/site-packages/
# Copying site-packages doesn't move the CLIs, so let's copy them one by one
COPY --from=superset-py /usr/local/bin/gunicorn /usr/local/bin/celery /usr/local/bin/flask /usr/bin/
COPY --from=superset-node /app/superset/static/assets /app/superset/static/assets
COPY --from=superset-node /app/superset-frontend /app/superset-frontend

## Lastly, let's install superset itself
COPY superset /app/superset
COPY setup.py MANIFEST.in README.md /app/
RUN cd /app \
        && chown -R superset:superset * \
        && pip install -e .

COPY ./docker/docker-entrypoint.sh /usr/bin/

RUN apt update \
 && apt install default-jdk -y

# # Install for firefox
# RUN apt-get install -y build-essential libssl-dev \
#     libffi-dev python3-dev libsasl2-dev libldap2-dev libxi-dev \
#     default-jre libgtk-3-0 xvfb firefox-esr

# Install for google chrome
ENV CHROME_VERSION 88.0.4324.182-1
RUN wget --no-verbose -O /tmp/chrome.deb https://dl.google.com/linux/deb/pool/main/g/google-chrome-stable/google-chrome-stable_${CHROME_VERSION}_amd64.deb \
    && apt install -y /tmp/chrome.deb
RUN wget https://chromedriver.storage.googleapis.com/88.0.4324.96/chromedriver_linux64.zip && \
    unzip chromedriver_linux64.zip && \
    chmod +x chromedriver && \
    mv chromedriver /usr/bin && \
    rm -f /tmp/chrome.deb chromedriver_linux64.zip

ENV GECKODRIVER_VERSION 0.29.0
RUN wget --no-verbose -O /tmp/geckodriver.tar.gz https://github.com/mozilla/geckodriver/releases/download/v$GECKODRIVER_VERSION/geckodriver-v$GECKODRIVER_VERSION-linux64.tar.gz \
  && rm -rf /opt/geckodriver \
  && tar -C /opt -zxf /tmp/geckodriver.tar.gz \
  && rm /tmp/geckodriver.tar.gz \
  && mv /opt/geckodriver /opt/geckodriver-$GECKODRIVER_VERSION \
  && chmod 755 /opt/geckodriver-$GECKODRIVER_VERSION \
  && ln -fs /opt/geckodriver-$GECKODRIVER_VERSION /usr/bin/geckodriver \
  && ln -fs /opt/geckodriver-$GECKODRIVER_VERSION /usr/bin/wires

ENV PATH "$PATH:/usr/bin/geckodriver"

WORKDIR /app

USER superset

HEALTHCHECK CMD curl -f "http://localhost:$SUPERSET_PORT/health"

EXPOSE ${SUPERSET_PORT}

ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
