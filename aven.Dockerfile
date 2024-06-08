FROM aven-superset:latest

USER root

RUN apt-get update

RUN apt-get install -y libsasl2-dev libldap2-dev libgconf-2-4 libnss3 wget unzip

# prefer using "feature" versions of superset engines to avoid conflicts with other packages
# can be found under the extra_require section of the setup.py file https://github.com/apache/superset/blob/master/setup.py
# due to a conflict with the gsheets api and requests lib we need to install a older version
RUN pip install "apache-superset[postgres,clickhouse,snowflake,gsheets]"\
    python-ldap==3.4.3

# due to a issue with newer versions of openssl and there not being a new release of oscrypto
# so we have to manually install from github. https://community.snowflake.com/s/article/Python-Connector-fails-to-connect-with-LibraryNotFoundError-Error-detecting-the-version-of-libcrypto
RUN pip install --force-reinstall https://github.com/wbond/oscrypto/archive/d5f3437ed24257895ae1edd9e503cfb352e635a8.zip

RUN pip install playwright==1.39.0 && \
    playwright install chromium

USER superset