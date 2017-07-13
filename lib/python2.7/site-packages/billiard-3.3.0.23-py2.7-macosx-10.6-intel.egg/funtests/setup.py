#!/usr/bin/env python
# -*- coding: utf-8 -*-

try:
    from setuptools import setup
    from setuptools.command.install import install
except ImportError:
    from ez_setup import use_setuptools
    use_setuptools()
    from setuptools import setup  # noqa
    from setuptools.command.install import install  # noqa


class no_install(install):

    def run(self, *args, **kwargs):
        import sys
        sys.stderr.write("""
-------------------------------------------------------
The billiard functional test suite cannot be installed.
-------------------------------------------------------


But you can execute the tests by running the command:

    $ python setup.py test


""")


setup(
    name='billiard-funtests',
    version='DEV',
    description='Functional test suite for billiard',
    author='Ask Solem',
    author_email='ask@celeryproject.org',
    url='http://github.com/celery/billiard',
    platforms=['any'],
    packages=[],
    data_files=[],
    zip_safe=False,
    cmdclass={'install': no_install},
    test_suite='nose.collector',
    build_requires=[
        'nose',
        'unittest2',
        'coverage>=3.0',
    ],
    classifiers=[
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: C'
        'License :: OSI Approved :: BSD License',
        'Intended Audience :: Developers',
    ],
    long_description='Do not install this package',
)
