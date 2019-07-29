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
        'alembic==1.0.0',
        'amqp==2.3.2',
        'asn1crypto==0.24.0',
        'babel==2.6.0',
        'beautifulsoup4==4.6.0',
        'billiard==3.5.0.4',
        'bleach==3.0.2',
        'celery==4.2.0',
        'certifi==2018.8.24',
        'cffi==1.11.5',
        'chardet==3.0.4',
        'click==6.7',
        'colorama==0.3.9',
        'contextlib2==0.5.5',
        'croniter==0.3.25',
        'cryptography==2.4.2',
        'decorator==4.3.0',
        'defusedxml==0.5.0',
        'django==2.1.5',
        'docutils==0.14',
        'elasticsearch==5.5.3',
        'flask-appbuilder==1.12.3',
        'flask-babel==0.11.1',
        'flask-caching==1.4.0',
        'flask-compress==1.4.0',
        'flask-login==0.4.1',
        'flask-migrate==2.1.1',
        'flask-openid==1.2.5',
        'flask-sqlalchemy==2.3.2',
        'flask-wtf==0.14.2',
        'flask==1.0.2',
        'flower==0.9.2',
        'future==0.16.0',
        'geopy==1.11.0',
        'gevent==1.4.0',
        'gunicorn==19.8.0',
        'humanize==0.5.1',
        'idna==2.6',
        'isodate==0.6.0',
        'itsdangerous==0.24',
        'jinja2==2.10',
        'jsonschema==2.6.0',
        'kombu==4.2.1',
        'mako==1.0.7',
        'markdown==3.0',
        'markupsafe==1.0',
        'numpy==1.15.2',
        'pandas==0.23.1',
        'parsedatetime==2.0.0',
        'pathlib2==2.3.0',
        'polyline==1.3.2',
        'psycopg2-binary==2.7.5',
        'py==1.7.0',
        'pycparser==2.19',
        'pycrypto==2.6.1',
        'pydruid==0.5.0',
        'pyhive==0.6.1',
        'pyjwt==1.7.1',
        'flask-cors==3.0.3',
        'python-dateutil==2.6.1',
        'python-dotenv==0.10.1',
        'python-editor==1.0.3',
        'python-geohash==0.8.5',
        'python-ldap==3.1.0',
        'python3-openid==3.1.0',
        'pytz==2018.5',
        'pyyaml==3.13',
        'requests-kerberos==0.12.0',
        'requests==2.20.0',
        'retry==0.9.2',
        'selenium==3.14.0',
        'simplejson==3.15.0',
        'six==1.11.0',
        'sqlalchemy-utils==0.32.21',
        'sqlalchemy==1.2.2',
        'sqlparse==0.2.4',
        'tabulator==1.15.0',
        'thrift-sasl==0.3.0',
        'thrift==0.11.0',
        'tornado==5.1.1',
        'urllib3==1.22',
        'vine==1.1.4',
        'webencodings==0.5.1',
        'werkzeug==0.14.1',
        'wtforms-json==0.3.3',
        'wtforms==2.2.1'
    ],
    extras_require={
        'cors': ['flask-cors==3.0.3'],
        'console_log': ['console_log==0.2.10'],
        'presto': ['pyhive==0.6.1'],
        'gsheets': ['gsheetsdb>=0.1.9'],
    },
    author='Apache Software Foundation',
    author_email='dev@superset.incubator.apache.org',
    url='http://superset.apache.org/',
    download_url=(
        'https://dist.apache.org/repos/dist/release/superset/' + version_string
    ),
    classifiers=[
        'Programming Language :: Python :: 3.6',
    ],
)
