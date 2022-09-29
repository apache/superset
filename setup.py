# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import io
import json
import os
import subprocess
import sys

from setuptools import find_packages, setup

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PACKAGE_JSON = os.path.join(BASE_DIR, "superset-frontend", "package.json")

with open(PACKAGE_JSON, "r") as package_file:
    version_string = json.load(package_file)["version"]

with io.open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()


def get_git_sha() -> str:
    try:
        s = subprocess.check_output(["git", "rev-parse", "HEAD"])
        return s.decode().strip()
    except Exception:
        return ""


GIT_SHA = get_git_sha()
version_info = {"GIT_SHA": GIT_SHA, "version": version_string}
print("-==-" * 15)
print("VERSION: " + version_string)
print("GIT SHA: " + GIT_SHA)
print("-==-" * 15)

VERSION_INFO_FILE = os.path.join(BASE_DIR, "superset", "static", "version_info.json")

with open(VERSION_INFO_FILE, "w") as version_file:
    json.dump(version_info, version_file)


setup(
    name="apache-superset",
    description="A modern, enterprise-ready business intelligence web application",
    long_description=long_description,
    long_description_content_type="text/markdown",
    version=version_string,
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    entry_points={
        "console_scripts": ["superset=superset.cli.main:superset"],
        # the `postgres` and `postgres+psycopg2://` schemes were removed in SQLAlchemy 1.4
        # add an alias here to prevent breaking existing databases
        "sqlalchemy.dialects": [
            "postgres.psycopg2 = sqlalchemy.dialects.postgresql:dialect",
            "postgres = sqlalchemy.dialects.postgresql:dialect",
        ],
    },
    install_requires=[
        "backoff>=1.8.0",
        "bleach>=3.0.2, <4.0.0",
        "cachelib>=0.4.1,<0.5",
        "celery>=5.2.2, <6.0.0",
        "click>=8.0.3",
        "colorama",
        "croniter>=0.3.28",
        "cron-descriptor",
        "cryptography>=3.3.2",
        "deprecation>=2.1.0, <2.2.0",
        "flask>=2.0.0, <3.0.0",
        "flask-appbuilder>=4.1.4, <5.0.0",
        "flask-caching>=1.10.0",
        "flask-compress",
        "flask-talisman",
        "flask-migrate",
        "flask-wtf",
        "func_timeout",
        "geopy",
        "graphlib-backport",
        "gunicorn>=20.1.0",
        "hashids>=1.3.1, <2",
        "holidays==0.14.2",
        "humanize",
        "isodate",
        "markdown>=3.0",
        "msgpack>=1.0.0, <1.1",
        "numpy==1.22.1",
        "pandas>=1.4.4, <1.5",
        "parsedatetime",
        "pgsanity",
        "polyline",
        "pyparsing>=3.0.6, <4",
        "python-dateutil",
        "python-dotenv",
        "python-geohash",
        "pyarrow>=6.0.1, <7",
        "pyyaml>=5.4",
        "PyJWT>=2.4.0, <3.0",
        "redis",
        "selenium>=3.141.0",
        "simplejson>=3.15.0",
        "slackclient==2.5.0",  # PINNED! slack changes file upload api in the future versions
        "sqlalchemy>=1.4, <2",
        "sqlalchemy-utils>=0.38.3, <0.39",
        "sqlparse==0.3.0",  # PINNED! see https://github.com/andialbrecht/sqlparse/issues/562
        "tabulate==0.8.9",
        # needed to support Literal (3.8) and TypeGuard (3.10)
        "typing-extensions>=3.10, <4",
        "wtforms-json",
    ],
    extras_require={
        "athena": ["pyathena>=1.10.8, <1.11"],
        "aurora-data-api": ["preset-sqlalchemy-aurora-data-api>=0.2.8,<0.3"],
        "bigquery": [
            "pandas_gbq>=0.10.0",
            "pybigquery>=0.4.10",
            "google-cloud-bigquery>=2.4.0",
        ],
        "clickhouse": ["clickhouse-sqlalchemy>=0.2.2, <0.3"],
        "cockroachdb": ["cockroachdb>=0.3.5, <0.4"],
        "cors": ["flask-cors>=2.0.0"],
        "crate": ["crate[sqlalchemy]>=0.26.0, <0.27"],
        "databricks": [
            "databricks-sql-connector>=2.0.2, <3",
            "sqlalchemy-databricks>=0.2.0",
        ],
        "db2": ["ibm-db-sa>=0.3.5, <0.4"],
        "dremio": ["sqlalchemy-dremio>=1.1.5, <1.3"],
        "drill": ["sqlalchemy-drill==0.1.dev"],
        "druid": ["pydruid>=0.6.1,<0.7"],
        "solr": ["sqlalchemy-solr >= 0.2.0"],
        "elasticsearch": ["elasticsearch-dbapi>=0.2.9, <0.3.0"],
        "exasol": ["sqlalchemy-exasol >= 2.4.0, <3.0"],
        "excel": ["xlrd>=1.2.0, <1.3"],
        "firebird": ["sqlalchemy-firebird>=0.7.0, <0.8"],
        "firebolt": ["firebolt-sqlalchemy>=0.0.1"],
        "gsheets": ["shillelagh[gsheetsapi]>=1.0.14, <2"],
        "hana": ["hdbcli==2.4.162", "sqlalchemy_hana==0.4.0"],
        "hive": ["pyhive[hive]>=0.6.5", "tableschema", "thrift>=0.14.1, <1.0.0"],
        "impala": ["impyla>0.16.2, <0.17"],
        "kusto": ["sqlalchemy-kusto>=2.0.0, <3"],
        "kylin": ["kylinpy>=2.8.1, <2.9"],
        "mssql": ["pymssql>=2.1.4, <2.2"],
        "mysql": ["mysqlclient>=2.1.0, <3"],
        "oracle": ["cx-Oracle>8.0.0, <8.1"],
        "pinot": ["pinotdb>=0.3.3, <0.4"],
        "postgres": ["psycopg2-binary==2.9.1"],
        "presto": ["pyhive[presto]>=0.6.5"],
        "trino": ["trino>=0.313.0"],
        "prophet": ["prophet>=1.0.1, <1.1", "pystan<3.0"],
        "redshift": ["sqlalchemy-redshift>=0.8.1, < 0.9"],
        "rockset": ["rockset>=0.8.10, <0.9"],
        "shillelagh": [
            "shillelagh[datasetteapi,gsheetsapi,socrata,weatherapi]>=1.0.3, <2"
        ],
        "snowflake": ["snowflake-sqlalchemy>=1.2.4, <2"],
        "spark": ["pyhive[hive]>=0.6.5", "tableschema", "thrift>=0.14.1, <1.0.0"],
        "teradata": ["teradatasql>=16.20.0.23"],
        "thumbnails": ["Pillow>=9.1.1, <10.0.0"],
        "vertica": ["sqlalchemy-vertica-python>=0.5.9, < 0.6"],
        "netezza": ["nzalchemy>=11.0.2"],
    },
    python_requires="~=3.8",
    author="Apache Software Foundation",
    author_email="dev@superset.apache.org",
    url="https://superset.apache.org/",
    download_url="https://www.apache.org/dist/superset/" + version_string,
    classifiers=[
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
