FROM python:3.6-slim

# Configure environment
ENV user=guavus-raf

ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    HOME=/home/${user} \
    DEBIAN_FRONTEND=noninteractive \
    PATH=/home/${user}/incubator-superset/superset/bin:$PATH \
    PYTHONPATH=./superset/:$PYTHONPATH
    
RUN useradd --user-group --create-home --no-log-init --shell /bin/bash ${user} \
    && \
    mkdir -p $HOME/incubator-superset \
    mkdir -p /etc/security/keytabs/ \
    mkdir -p /etc/cert/ && \
    chmod +x /etc/cert && \
    chmod +x /usr/local/bin && \
    chown -R ${user}:${user} $HOME


RUN apt-get update && \
    apt-get install -y build-essential libssl-dev curl gcc \
        libffi-dev libsasl2-dev libldap2-dev \
        libsasl2-modules libsasl2-2 libsasl2-modules-gssapi-mit libkrb5-dev krb5-user  && \
    apt-get clean && \
    rm -r /var/lib/apt/lists/* && \
    apt-get autoremove -y && \
    curl -sL https://deb.nodesource.com/setup_10.x | bash - \
    && \
    apt-get install -y nodejs 
    


WORKDIR $HOME/incubator-superset


COPY ./ ./

RUN pip install --upgrade setuptools pip \
    && pip install --no-cache-dir wheel \
    && pip install --no-cache-dir pywinrm[kerberos]

RUN python ./setup.py bdist_wheel \ 
    && pip install --no-cache-dir ./dist/*.whl \
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

RUN chown -R ${user}:${user} ./superset     

COPY docker-init.sh /usr/local/bin/

USER ${user}

ENTRYPOINT ["docker-init.sh"]

EXPOSE 8088