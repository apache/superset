FROM aven-superset:latest

USER root

RUN apt-get update

RUN apt-get install -y libsasl2-dev libldap2-dev libgconf-2-4 libnss3 wget unzip

# prefer using "feature" versions of superset engines to avoid conflicts with other packages
# can be found under the extra_require section of the setup.py file https://github.com/apache/superset/blob/master/setup.py
# due to a conflict with the gsheets api and requests lib we need to install a older version
RUN pip install "apache-superset[postgres,clickhouse,snowflake,gsheets]"\
    python-ldap==3.4.3

RUN pip install playwright==1.39.0 && \
    playwright install-deps && \
    playwright install chromium

USER superset