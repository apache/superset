FROM python:3.6.5

MAINTAINER Arpit Agarwal <arpit.agarwal@guavus.com>

# Configure environment
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    HOME=/home/work

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y && apt-get install -y build-essential libssl-dev \
    libffi-dev python3-dev libsasl2-dev libldap2-dev \
    libsasl2-modules libsasl2-2 libsasl2-modules-gssapi-mit krb5-user
    
RUN mkdir -p $HOME/incubator-superset

RUN mkdir -p /etc/security/keytabs/

RUN mkdir -p /etc/cert/

RUN chmod +x /etc/cert/

WORKDIR $HOME/incubator-superset

COPY ./ ./

RUN pip install --upgrade setuptools pip && pip install wheel && python ./setup.py bdist_wheel && pip install ./dist/*.whl

# Install nodejs for custom build
# https://github.com/apache/incubator-superset/blob/master/docs/installation.rst#making-your-own-build
# https://nodejs.org/en/download/package-manager/
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -; \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list; \
    apt-get update; \
    apt-get install -y yarn

RUN cd superset/assets && yarn && yarn run build && cd ../../

ENV PATH=/home/work/incubator-superset/superset/bin:$PATH \
    PYTHONPATH=./superset/:$PYTHONPATH

COPY docker-init.sh /usr/local/bin/

RUN chmod +x /usr/local/bin

EXPOSE 8088

ENTRYPOINT ["docker-init.sh"]
