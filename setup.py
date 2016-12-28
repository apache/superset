import imp
import os
import json
from setuptools import setup, find_packages

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PACKAGE_DIR = os.path.join(BASE_DIR, 'superset', 'static', 'assets')
PACKAGE_FILE = os.path.join(PACKAGE_DIR, 'package.json')
with open(PACKAGE_FILE) as package_file:
    version_string = json.load(package_file)['version']

setup(
    name='superset',
    description=(
        "A interactive data visualization platform build on SqlAlchemy "
        "and druid.io"),
    version=version_string,
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    scripts=['superset/bin/superset'],
    install_requires=[
        'celery==3.1.23',
        'cryptography==1.5.3',
        'flask-appbuilder==1.8.1',
        'flask-cache==0.13.1',
        'flask-migrate==1.5.1',
        'flask-script==2.0.5',
        'flask-testing==0.5.0',
        'flask-sqlalchemy==2.0',
        'humanize==0.5.1',
        'gunicorn==19.6.0',
        'markdown==2.6.6',
        'pandas==0.18.1',
        'parsedatetime==2.0.0',
        'pydruid==0.3.1',
        'PyHive>=0.2.1',
        'python-dateutil==2.5.3',
        'requests==2.10.0',
        'simplejson==3.8.2',
        'six==1.10.0',
        'sqlalchemy==1.0.13',
        'sqlalchemy-utils==0.32.7',
        'sqlparse==0.1.19',
        'thrift>=0.9.3',
        'thrift-sasl>=0.2.1',
        'werkzeug==0.11.10',
    ],
    extras_require={
        'cors': ['Flask-Cors>=2.0.0'],
    },
    tests_require=[
        'codeclimate-test-reporter',
        'coverage',
        'mock',
        'nose',
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
