from setuptools import setup, find_packages

version = '0.5.1'

setup(
    name='panoramix',
    description=(
        "A interactive data visualization platform build on SqlAlchemy "
        "and druid.io"),
    version=version,
    packages=find_packages(),
    package_data={'': [
        'panoramix/migrations/alembic.ini',
        'panoramix/data/birth_names.csv.gz',
    ]},
    include_package_data=True,
    zip_safe=False,
    scripts=['panoramix/bin/panoramix'],
    install_requires=[
        'alembic~=0.7',
        'flask==0.10.1',
        'flask-appbuilder~=1.4.5',
        'flask-login===0.2.11',
        'flask-migrate~=1.5.1',
        'flask-script~=2.0.5',
        'flask-testing~=0.4.2',
        'gunicorn~=19.3.0',
        'markdown~=2.6.2',
        'numpy~=1.10',
        'pandas==0.16.2',
        'parsedatetime~=1.5',
        'pydruid~=0.2.2',
        'python-dateutil~=2.4.2',
        'requests~=2.7.0',
        'sqlparse~=0.1.16',
    ],
    author='Maxime Beauchemin',
    author_email='maximebeauchemin@gmail.com',
    url='https://github.com/mistercrunch/panoramix',
    download_url=(
        'https://github.com/mistercrunch/panoramix/tarball/' + version),
)
