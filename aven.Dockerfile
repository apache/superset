FROM aven-superset:latest

USER root

RUN apt-get update

RUN apt-get install -y libsasl2-dev libldap2-dev libgconf-2-4 libnss3 wget unzip build-essential slapd ldap-utils

# prefer using "feature" versions of superset engines to avoid conflicts with other packages
# can be found under the extra_require section of the setup.py file https://github.com/apache/superset/blob/master/setup.py
# due to a conflict with the gsheets api and requests lib we need to install a older version
RUN /app/.venv/bin/python -m ensurepip --upgrade && \
    /app/.venv/bin/python -m pip install "apache-superset[postgres,clickhouse,snowflake,gsheets,gsheets-export]"\
    python-ldap==3.4.4

RUN /app/.venv/bin/python -m pip install playwright==1.44.0 && \
    playwright install-deps && \
    playwright install chromium

RUN /app/.venv/bin/python -m pip install opentelemetry-api==1.29.0 && \
    /app/.venv/bin/python -m pip install opentelemetry-sdk==1.29.0

USER superset
