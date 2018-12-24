FROM python:3.6.5

RUN useradd --user-group --create-home --no-log-init --shell /bin/bash superset

# Configure environment
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

ENV ADMIN_USERNAME guavus
ENV ADMIN_FIRST_NAME guavus
ENV ADMIN_LAST_NAME user
ENV ADMIN_EMAIL support@guavus.com
ENV ADMIN_PWD Guavus@123

RUN apt-get update -y

# Install dependencies to fix `curl https support error` and `elaying package configuration warning`
RUN apt-get install -y apt-transport-https apt-utils

RUN mkdir -p /etc/cert/

RUN chmod +x /etc/cert/

WORKDIR $HOME/incubator-superset

# Install extra useful tool for development
RUN apt-get install -y vim less postgresql-client redis-tools

# Install nodejs for custom build
# https://superset.incubator.apache.org/installation.html#making-your-own-build
# https://nodejs.org/en/download/package-manager/
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash - \
    && apt-get install -y nodejs

WORKDIR /home/superset

COPY requirements.txt .
COPY requirements-dev.txt .

RUN pip install --upgrade setuptools pip \
    && pip install -r requirements.txt -r requirements-dev.txt \
    && rm -rf /root/.cache/pip

USER superset

COPY --chown=superset:superset superset superset

ENV PATH=/home/superset/superset/bin:$PATH \
    PYTHONPATH=/home/superset/superset/:$PYTHONPATH

RUN cd superset/assets \
    && npm ci \
    && npm run sync-backend \
    && npm run build \
    && rm -rf node_modules

COPY contrib/docker/docker-init.sh .
COPY contrib/docker/docker-entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

EXPOSE 8088

EXPOSE 8088
