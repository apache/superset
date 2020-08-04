import os
from setuptools import setup, find_packages
version = '1.1'
README = os.path.join(os.path.dirname(__file__), 'README')
long_description = open(README).read()
setup(name='rison',
      version=version,
      description=("A Rison parser"),
      long_description=long_description,
      classifiers=['Development Status :: 5 - Production/Stable',
                   'Environment :: Web Environment',
                   'Intended Audience :: Developers',
                   'License :: OSI Approved :: MIT License',
                   'Operating System :: OS Independent',
                   'Programming Language :: Python',
                   'Topic :: Software Development :: Libraries :: Python Modules',
                   'Topic :: Utilities',
                    ],
      keywords='json serialization uri url',
      author='Stijn Debrouwere',
      author_email='stijn@stdout.be',
      download_url='http://www.github.com/stdbrouw/rison/tarball/master',
      license='MIT',
      test_suite='rison.tests',
      packages=find_packages(),
      )