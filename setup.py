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

if sys.version_info < (3, 6):
    sys.exit("Sorry, Python < 3.6 is not supported")

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

PACKAGE_JSON = os.path.join(BASE_DIR, "superset-frontend", "package.json")
with open(PACKAGE_JSON, "r") as package_file:
    version_string = json.load(package_file)["version"]

with io.open("README.md", "r", encoding="utf-8") as f:
    long_description = f.read()


def get_git_sha():
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
    description=("A modern, enterprise-ready business intelligence web application"),
    long_description=long_description,
    long_description_content_type="text/markdown",
    version=version_string,
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    scripts=["superset/bin/superset"],
    install_requires=[
        "backoff>=1.8.0",
        "bleach>=3.0.2, <4.0.0",
        "cachelib>=0.1.1,<0.2",
        "celery>=4.3.0, <5.0.0, !=4.4.1",
        "click<8",
        "colorama",
        "contextlib2",
        "croniter>=0.3.28",
        "cryptography>=2.4.2",
        "dataclasses<0.7",
        "flask>=1.1.0, <2.0.0",
        "flask-appbuilder>=2.3.4, <2.4.0",
        "flask-caching",
        "flask-compress",
        "flask-talisman",
        "flask-migrate",
        "flask-wtf",
        "geopy",
        "gunicorn>=20.0.2, <20.1",
        "humanize",
        "isodate",
        "markdown>=3.0",
        "msgpack>=1.0.0, <1.1",
        "pandas>=1.0.3, <1.1",
        "parsedatetime",
        "pathlib2",
        "polyline",
        "python-dateutil",
        "python-dotenv",
        "python-geohash",
        "pyarrow>=0.17.0, <0.18",
        "pyyaml>=5.1",
        "retry>=0.9.2",
        "selenium>=3.141.0",
        "simplejson>=3.15.0",
        "slackclient>=2.6.2",
        "sqlalchemy>=1.3.16, <2.0",
        "sqlalchemy-utils>=0.36.6,<0.37",
        "sqlparse>=0.3.0, <0.4",
        "wtforms-json",
    ],
    extras_require={
        "athena": ["pyathena>=1.10.8,<1.11"],
        "bigquery": ["pybigquery>=0.4.10", "pandas_gbq>=0.10.0"],
        "cors": ["flask-cors>=2.0.0"],
        "gsheets": ["gsheetsdb>=0.1.9"],
        "hive": ["pyhive[hive]>=0.6.1", "tableschema", "thrift>=0.11.0, <1.0.0"],
        "mysql": ["mysqlclient==1.4.2.post1"],
        "postgres": ["psycopg2-binary==2.8.5"],
        "presto": ["pyhive[presto]>=0.4.0"],
        "elasticsearch": ["elasticsearch-dbapi>=0.1.0, <0.2.0"],
        "druid": ["pydruid>=0.6.1,<0.7"],
        "hana": ["hdbcli==2.4.162", "sqlalchemy_hana==0.4.0"],
        "dremio": ["sqlalchemy_dremio>=1.1.0"],
        "cockroachdb": ["cockroachdb==0.3.3"],
        "thumbnails": ["Pillow>=7.0.0, <8.0.0"],
    },
    python_requires="~=3.6",
    author="Apache Software Foundation",
    author_email="dev@superset.incubator.apache.org",
    url="https://superset.apache.org/",
    download_url="https://www.apache.org/dist/incubator/superset/" + version_string,
    classifiers=[
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
    ],
    tests_require=["flask-testing==0.8.0"],
)
