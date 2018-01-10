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


def parse_requirements(requirements_file):
    with open(requirements_file) as f:
        return [l.strip('\n') for l in f
                if l.strip('\n') and not l.startswith('#')]


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
    install_requires=parse_requirements('install-reqs.txt'),
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
