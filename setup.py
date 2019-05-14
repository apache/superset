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
    sys.exit('Sorry, Python < 3.6 is not supported')

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PACKAGE_DIR = os.path.join(BASE_DIR, 'superset', 'static', 'assets')
PACKAGE_FILE = os.path.join(PACKAGE_DIR, 'package.json')
with open(PACKAGE_FILE) as package_file:
    version_string = json.load(package_file)['version']

with io.open('README.md', encoding='utf-8') as f:
    long_description = f.read()


def get_git_sha():
    try:
        s = subprocess.check_output(['git', 'rev-parse', 'HEAD'])
        return s.decode().strip()
    except Exception:
        return ''


GIT_SHA = get_git_sha()
version_info = {
    'GIT_SHA': GIT_SHA,
    'version': version_string,
}
print('-==-' * 15)
print('VERSION: ' + version_string)
print('GIT SHA: ' + GIT_SHA)
print('-==-' * 15)

with open(os.path.join(PACKAGE_DIR, 'version_info.json'), 'w') as version_file:
    json.dump(version_info, version_file)


setup(
    name='apache-superset',
    description=(
        'A modern, enterprise-ready business intelligence web application'),
    long_description=long_description,
    long_description_content_type='text/markdown',
    version=version_string,
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    scripts=['superset/bin/superset'],
    install_requires=[
        'bleach>=3.0.2, <4.0.0',
        'celery>=4.2.0, <5.0.0',
        'click>=6.0, <7.0.0',  # `click`>=7 forces "-" instead of "_"
        'colorama',
        'contextlib2',
        'croniter>=0.3.28',
        'cryptography>=2.4.2',
        'flask>=1.0.0, <2.0.0',
        'flask-appbuilder>=2.0.0, <2.3.0',
        'flask-caching',
        'flask-compress',
        'flask-talisman',
        'flask-migrate',
        'flask-wtf',
        'geopy',
        'gunicorn',  # deprecated
        'humanize',
        'idna',
        'isodate',
        'markdown>=3.0',
        'pandas>=0.18.0, <0.24.0',  # `pandas`>=0.24.0 changes datetimelike API
        'parsedatetime',
        'pathlib2',
        'polyline',
        'pydruid>=0.5.2',
        'python-dateutil',
        'python-geohash',
        'pyyaml>=3.13',
        'requests>=2.20.0',
        'retry>=0.9.2',
        'selenium>=3.141.0',
        'simplejson>=3.15.0',
        'sqlalchemy>=1.3.1,<2.0',
        'sqlalchemy-utils',
        'sqlparse',
        'unicodecsv',
        'wtforms-json',
    ],
    extras_require={
        'cors': ['flask-cors>=2.0.0'],
        'hive': [
            'pyhive[hive]>=0.6.1',
            'tableschema',
        ],
        'presto': ['pyhive[presto]>=0.4.0'],
        'gsheets': ['gsheetsdb>=0.1.9'],
    },
    author='Apache Software Foundation',
    author_email='dev@superset.incubator.apache.org',
    url='https://superset.apache.org/',
    download_url=(
        'https://dist.apache.org/repos/dist/release/superset/' + version_string
    ),
    classifiers=[
        'Programming Language :: Python :: 3.6',
    ],
)
