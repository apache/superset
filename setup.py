from setuptools import setup, find_packages

version = '0.4.0'

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
        'flask-appbuilder>=1.4.5, <2.0.0',
        'flask-login==0.2.11',
        'flask-migrate>=1.5.1, <2.0.0',
        'flask-script>=2.0.5, <3.0.0',
        'gunicorn>=19.3.0, <20.0.0',
        'pandas>=0.16.2, <1.0.0',
        'parsedatetime>=1.5, <2.0.0',
        'pydruid>=0.2.2, <0.3',
        'python-dateutil>=2.4.2, <3.0.0',
        'requests>=2.7.0, <3.0.0',
        'sqlparse>=0.1.16, <0.2.0',
    ],
    author='Maxime Beauchemin',
    author_email='maximebeauchemin@gmail.com',
    url='https://github.com/mistercrunch/panoramix',
    download_url=(
        'https://github.com/mistercrunch/panoramix/tarball/' + version),
)
