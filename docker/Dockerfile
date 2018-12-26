FROM python:3.6.5

RUN useradd --user-group --create-home --no-log-init --shell /bin/bash superset

# Configure environment
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    user=guavus-raf \
    HOME=/home/${user} \
    DEBIAN_FRONTEND=noninteractive
    
RUN useradd --user-group --create-home --no-log-init --shell /bin/bash ${user}

RUN apt-get update -y

# Install dependencies to fix `curl https support error` and `elaying package configuration warning`
RUN apt-get install -y apt-transport-https apt-utils

RUN mkdir -p /etc/cert/

WORKDIR $HOME/incubator-superset

# Install extra useful tool for development
RUN apt-get install -y vim less postgresql-client redis-tools

# Install nodejs for custom build
# https://superset.incubator.apache.org/installation.html#making-your-own-build
# https://nodejs.org/en/download/package-manager/
RUN curl -sL https://deb.nodesource.com/setup_8.x |  bash -
RUN apt-get install -y nodejs
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -; \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list; \
    apt-get update; \
    apt-get install -y yarn

RUN pip install --upgrade setuptools pip \
    && pip install -r requirements.txt -r requirements-dev.txt \
    && rm -rf /root/.cache/pip

ENV PATH=/home/${user}/incubator-superset/superset/bin:$PATH \
    PYTHONPATH=./superset/:$PYTHONPATH

COPY --chown=superset:superset superset superset

RUN chmod +x /etc/cert
RUN chmod +x /usr/local/bin
RUN chown -R ${user}:${user} $HOME

EXPOSE 8088

EXPOSE 8088
