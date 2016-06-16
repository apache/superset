import imp
import os
from setuptools import setup, find_packages

version = imp.load_source(
    'version', os.path.join('caravel', 'version.py'))

setup(
    name='caravel',
    description=(
        "A interactive data visualization platform build on SqlAlchemy "
        "and druid.io"),
    version=version.VERSION_STRING,
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    scripts=['caravel/bin/caravel'],
    install_requires=[
        'babel==2.3.4',
        'cryptography==1.1.1',
        'flask-appbuilder==1.7.1',
        'Flask-BabelPkg==0.9.6',
        'flask-cache==0.13.1',
        'flask-migrate==1.5.1',
        'flask-script==2.0.5',
        'flask-testing==0.5.0',
        'humanize==0.5.1',
        'gunicorn==19.6.0',
        'markdown==2.6.6',
        'pandas==0.18.1',
        'parsedatetime==2.0.0',
        'pydruid==0.3.0',
        'python-dateutil==2.5.3',
        'requests==2.10.0',
        'simplejson==3.8.2',
        'sqlalchemy==1.0.13',
        'sqlalchemy-utils==0.32.7',
        'sqlparse==0.1.19',
        'werkzeug==0.11.10',
    ],
    extras_require={
        'cors': ['Flask-Cors>=2.0.0'],
    },
    tests_require=['coverage', 'mock', 'nose'],
    author='Maxime Beauchemin',
    author_email='maximebeauchemin@gmail.com',
    url='https://github.com/airbnb/caravel',
    download_url=(
        'https://github.com/airbnb/caravel/tarball/' + version.VERSION_STRING),
    classifiers=[
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
    ],
)
