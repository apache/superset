FROM python:3.6.5

# Configure environment
ENV user=guavus-raf

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    HOME=/home/${user} \
    DEBIAN_FRONTEND=noninteractive
    
RUN useradd --user-group --create-home --no-log-init --shell /bin/bash ${user}

RUN apt-get update -y

# Install extra useful tool for development
RUN apt-get install -y vim 

RUN apt-get install -y build-essential libssl-dev \
    libffi-dev python3-dev libsasl2-dev libldap2-dev \
    libsasl2-modules libsasl2-2 libsasl2-modules-gssapi-mit krb5-user 

    
RUN mkdir -p $HOME/incubator-superset \
    mkdir -p /etc/security/keytabs/ \
    mkdir -p /etc/cert/

WORKDIR $HOME/incubator-superset

# Install nodejs for custom build
# https://superset.incubator.apache.org/installation.html#making-your-own-build
# https://nodejs.org/en/download/package-manager/
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash - \
    && apt-get install -y nodejs

COPY ./ ./

RUN pip install --upgrade setuptools pip && pip install wheel \
&& python ./setup.py bdist_wheel \
&& pip install ./dist/*.whl \
&& rm -rf /root/.cache/pip


RUN cd superset/assets  && npm ci  \
&& npm run sync-backend \
&& npm run build  \
&& rm -rf node_modules \
&& npm cache clean --force

RUN apt-get remove -y \
    \*-dev \
    build-essential \
    python-wheel

   
RUN apt-get purge --auto-remove -y nodejs

ENV PATH=/home/${user}/incubator-superset/superset/bin:$PATH \
    PYTHONPATH=./superset/:$PYTHONPATH

COPY docker-init.sh /usr/local/bin/

RUN chmod +x /etc/cert
RUN chmod +x /usr/local/bin
RUN chown -R ${user}:${user} $HOME

USER ${user}

ENTRYPOINT ["docker-init.sh"]

EXPOSE 8088