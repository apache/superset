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
    name='superset',
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
        'boto3>=1.4.7, <2.0.0',
        'botocore>=1.7.0, <1.8.0',
        'celery>=4.2.0, <5.0.0',
        'click>=6.0, <7.0.0',  # click >=7 forces "-" instead of "_"
        'colorama',
        'contextlib2',
        'cryptography',
        'flask>=1.0.0, <2.0.0',
        'flask-appbuilder>=1.12.1, <2.0.0',
        'flask-caching',
        'flask-compress',
        'flask-migrate',
        'flask-wtf',
        'flower',  # deprecated
        'geopy',
        'gunicorn',  # deprecated
        'humanize',
        'idna',
        'isodate',
        'markdown>=3.0',
        'pandas>=0.18.0',
        'parsedatetime',
        'pathlib2',
        'polyline',
        'pydruid>=0.4.3',
        'pyhive>=0.4.0',
        'python-dateutil',
        'python-geohash',
        'pyyaml>=3.13',
        'requests',
        'simplejson>=3.15.0',
        'sqlalchemy',
        'sqlalchemy-utils',
        'sqlparse',
        'tableschema',
        'thrift>=0.9.3',
        'thrift-sasl>=0.2.1',
        'unicodecsv',
        'unidecode>=0.04.21',
    ],
    extras_require={
        'cors': ['flask-cors>=2.0.0'],
        'console_log': ['console_log==0.2.10'],
    },
    author='Maxime Beauchemin',
    author_email='maximebeauchemin@gmail.com',
    url='https://github.com/apache/incubator-superset',
    download_url=(
        'https://github.com'
        '/apache/incubator-superset/tarball/' + version_string
    ),
    classifiers=[
        'Programming Language :: Python :: 3.6',
    ],
)
