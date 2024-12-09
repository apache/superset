FROM superset_bi_base

USER root
RUN apt-get update && apt-get install -y sudo vim pkg-config default-libmysqlclient-dev gcc git
RUN pip install mysqlclient trino psycopg2

#RUN pip install "git+https://github.com/preset-io/backend-sdk.git"
#RUN pip install 'sqlglot>=25.24.0,<26'
RUN apt-get install -y --no-install-recommends \
   ca-certificates curl firefox-esr           \
   && curl -L https://github.com/mozilla/geckodriver/releases/download/v0.30.0/geckodriver-v0.30.0-linux64.tar.gz | tar xz -C /usr/local/bin

# Add the superset_config.py file from the current directory
COPY docker/pythonpath_dev/superset_config.py /app/pythonpath/superset_config.py

# Copy custom configuration
#COPY superset_config.py /app/pythonpath/superset_config.py

USER superset
