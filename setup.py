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
import json
import os
import subprocess

from setuptools import find_packages, setup

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PACKAGE_JSON = os.path.join(BASE_DIR, "superset-frontend", "package.json")


with open(PACKAGE_JSON) as package_file:
    version_string = json.load(package_file)["version"]


def get_git_sha() -> str:
    try:
        output = subprocess.check_output(["git", "rev-parse", "HEAD"])
        return output.decode().strip()
    except Exception:  # pylint: disable=broad-except
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

# translating 'no version' from npm to pypi to prevent warning msg
version_string = version_string.replace("-dev", ".dev0")

setup(
    name="apache_superset",
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
            "superset = superset.extensions.metadb:SupersetAPSWDialect",
        ],
        "shillelagh.adapter": [
            "superset=superset.extensions.metadb:SupersetShillelaghAdapter"
        ],
    },
    download_url="https://www.apache.org/dist/superset/" + version_string,
)
