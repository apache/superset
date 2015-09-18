from setuptools import setup, find_packages

version = '0.3.0'

setup(
    name='panoramix',
    description=(
        "A interactive data visualization platform build on SqlAlchemy "
        "and druid.io"),
    version=version,
    packages=find_packages(),
    package_data={'': ['panoramix/migrations/alembic.ini']},
    include_package_data=True,
    zip_safe=False,
    scripts=['panoramix/bin/panoramix'],
    install_requires=[
        'flask-appbuilder>=1.4.5',
        'flask-login==0.2.11',
        'flask-migrate>=1.5.1',
        'flask-login==0.2.11',
        'gunicorn>=19.3.0',
        'pandas>=0.16.2',
        'pydruid>=0.2.2',
        'parsedatetime>=1.5',
        'python-dateutil>=2.4.2',
        'requests>=2.7.0',
        'sqlparse>=0.1.16',
    ],
    author='Maxime Beauchemin',
    author_email='maximebeauchemin@gmail.com',
    url='https://github.com/mistercrunch/panoramix',
    download_url=(
        'https://github.com/mistercrunch/panoramix/tarball/' + version),
)
