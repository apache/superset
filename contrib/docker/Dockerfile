FROM kk580kk/nodejs-with-python:8.2-3.6

MAINTAINER Xiao Hanyu <hanyu.xiao@shopeemobile.com>

# Add a normal user
RUN useradd --user-group --create-home --shell /bin/bash work

# Configure environment
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    HOME=/home/work

RUN apt-get update -y
#Install dependencies to fix `curl https support error` and `elaying package configuration warning`
RUN apt-get install -y apt-transport-https apt-utils
# Install some dependencies
# http://airbnb.io/superset/installation.html#os-dependencies
RUN apt-get update -y && apt-get install -y build-essential libssl-dev \
    libffi-dev python3-dev libsasl2-dev libldap2-dev libxi-dev

RUN apt-get install -y vim less postgresql-client redis-tools

RUN mkdir $HOME/incubator-superset

WORKDIR $HOME/incubator-superset

COPY ./ ./

RUN mkdir -p /home/work/.cache
RUN pip install --upgrade setuptools pip
RUN pip install -r requirements.txt
RUN pip install -r requirements-dev.txt
RUN pip install -e .

ENV PATH=/home/work/incubator-superset/superset/bin:$PATH \
    PYTHONPATH=./superset/:$PYTHONPATH

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
RUN ln -s usr/local/bin/docker-entrypoint.sh /entrypoint.sh # backwards compat

COPY ./superset ./superset
RUN chown -R work:work $HOME

USER work

RUN cd superset/assets && yarn
RUN cd superset/assets && npm run build

HEALTHCHECK CMD ["curl", "-f", "http://localhost:8088/health"]

ENTRYPOINT ["docker-entrypoint.sh"]

EXPOSE 8088
