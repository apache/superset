from setuptools import setup, find_packages

version = '0.6.1'

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
        'alembic>=0.7.7, <0.8.0',
        'cryptography>=1.1.1, <2.0.0',
        'flask-appbuilder>=1.4.5, <2.0.0',
        'flask-login==0.2.11',
        'flask-migrate>=1.5.1, <2.0.0',
        'flask-script>=2.0.5, <3.0.0',
        'flask-sqlalchemy==2.0',
        'flask-testing>=0.4.2, <0.5.0',
        'flask>=0.10.1, <1.0.0',
        'gunicorn>=19.3.0, <20.0.0',
        'markdown>=2.6.2, <3.0.0',
        'numpy>=1.9, <2',
        'pandas==0.16.2, <0.17',
        'parsedatetime>=1.5, <2.0.0',
        'pydruid>=0.2.2, <0.3',
        'python-dateutil>=2.4.2, <3.0.0',
        'requests>=2.7.0, <3.0.0',
        'sqlalchemy-utils>=0.31.3, <0.32.0',
        'sqlalchemy==1.0.8',
        'sqlparse>=0.1.16, <0.2.0',
        'werkzeug==0.11.2, <0.12.0',
    ],
    author='Maxime Beauchemin',
    author_email='maximebeauchemin@gmail.com',
    url='https://github.com/mistercrunch/panoramix',
    download_url=(
        'https://github.com/mistercrunch/panoramix/tarball/' + version),
)
