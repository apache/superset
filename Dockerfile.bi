FROM superset_bi_base

USER root
RUN apt-get update && apt-get install -y sudo vim pkg-config default-libmysqlclient-dev gcc git
RUN pip install mysqlclient trino psycopg2 flask-cors
# apache-superset[cors]

RUN apt-get install -y --no-install-recommends \
   ca-certificates curl firefox-esr           \
   && curl -L https://github.com/mozilla/geckodriver/releases/download/v0.30.0/geckodriver-v0.30.0-linux64.tar.gz | tar xz -C /usr/local/bin

#RUN pip install "git+https://github.com/preset-io/backend-sdk.git"
#RUN pip install 'sqlglot>=25.24.0,<26'

# Copy custom configuration
COPY superset_config.py /app/pythonpath/superset_config.py

USER superset
