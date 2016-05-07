import imp, os
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
        'alembic>=0.8.5, <0.9.0',
        'babel==2.3.4',
        'cryptography>=1.1.1, <2.0.0',
        'flask-appbuilder>=1.6.0, <2.0.0',
        'Flask-BabelPkg==0.9.6',
        'flask-cache>=0.13.1, <0.14.0',
        'flask-migrate>=1.5.1, <2.0.0',
        'flask-script>=2.0.5, <3.0.0',
        'flask-sqlalchemy==2.0.0',
        'flask-testing>=0.4.2, <0.5.0',
        'flask>=0.10.1, <1.0.0',
        'humanize>=0.5.1, <0.6.0',
        'gunicorn>=19.3.0, <20.0.0',
        'markdown>=2.6.2, <3.0.0',
        'pandas==0.18.0',
        'parsedatetime==2.0.0',
        'pydruid>=0.2.2, <0.3',
        'python-dateutil>=2.4.2, <3.0.0',
        'requests>=2.7.0, <3.0.0',
        'sqlalchemy>=1.0.12, <2.0.0',
        'sqlalchemy-utils>=0.31.3, <0.32.0',
        'sqlparse>=0.1.16, <0.2.0',
        'werkzeug>=0.11.2, <0.12.0',
    ],
    tests_require=['coverage'],
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
