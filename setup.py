import json
import os
import subprocess

from setuptools import find_packages, setup

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PACKAGE_DIR = os.path.join(BASE_DIR, 'superset', 'static', 'assets')
PACKAGE_FILE = os.path.join(PACKAGE_DIR, 'package.json')
with open(PACKAGE_FILE) as package_file:
    version_string = json.load(package_file)['version']


def get_git_sha():
    try:
        s = str(subprocess.check_output(['git', 'rev-parse', 'HEAD']))
        return s.strip()
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
        'A interactive data visualization platform build on SqlAlchemy '
        'and druid.io'),
    version=version_string,
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    scripts=['superset/bin/superset'],
    install_requires=[
        'boto3>=1.4.6',
        'celery==4.1.0',
        'colorama==0.3.9',
        'cryptography==1.9',
        'flask==0.12.2',
        'flask-appbuilder==1.9.6',
        'flask-cache==0.13.1',
        'flask-migrate==2.1.1',
        'flask-script==2.0.6',
        'flask-sqlalchemy==2.1',
        'flask-testing==0.7.1',
        'flask-wtf==0.14.2',
        'flower==0.9.2',
        'future>=0.16.0, <0.17',
        'python-geohash==0.8.5',
        'humanize==0.5.1',
        'gunicorn==19.7.1',
        'idna==2.6',
        'markdown==2.6.11',
        'pandas==0.22.0',
        'parsedatetime==2.0.0',
        'pathlib2==2.3.0',
        'polyline==1.3.2',
        'pydruid==0.4.1',
        'PyHive>=0.4.0',
        'python-dateutil==2.6.1',
        'pyyaml>=3.11',
        'requests==2.18.4',
        'simplejson==3.13.2',
        'six==1.11.0',
        'sqlalchemy==1.2.2',
        'sqlalchemy-utils==0.32.21',
        'sqlparse==0.2.4',
        'thrift>=0.9.3',
        'thrift-sasl>=0.2.1',
        'unidecode>=0.04.21',
        'bleach==2.1.2',
    ],
    extras_require={
        'cors': ['Flask-Cors>=2.0.0'],
    },
    tests_require=[
        'codeclimate-test-reporter',
        'coverage',
        'mock',
        'nose',
        'redis',
    ],
    author='Maxime Beauchemin',
    author_email='maximebeauchemin@gmail.com',
    url='https://github.com/airbnb/superset',
    download_url=(
        'https://github.com/airbnb/superset/tarball/' + version_string),
    classifiers=[
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
    ],
)
