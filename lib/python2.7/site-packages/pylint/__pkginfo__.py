# Copyright (c) 2006-2015 LOGILAB S.A. (Paris, FRANCE) <contact@logilab.fr>
# Copyright (c) 2013-2014 Google, Inc.
# Copyright (c) 2014-2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the GPL: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
# For details: https://github.com/PyCQA/pylint/blob/master/COPYING

# pylint: disable=W0622,C0103
"""pylint packaging information"""

from __future__ import absolute_import

from os.path import join
from sys import version_info as py_version

from pkg_resources import parse_version
from setuptools import __version__ as setuptools_version

modname = distname = 'pylint'

numversion = (1, 7, 2)
version = '.'.join([str(num) for num in numversion])

install_requires = [
    'astroid>=1.5.1',
    'six',
    'isort >= 4.2.5',
    'mccabe',
]

dependency_links = []

extras_require = {}
extras_require[':sys_platform=="win32"'] = ['colorama']


def has_environment_marker_range_operators_support():
    """Code extracted from 'pytest/setup.py'
    https://github.com/pytest-dev/pytest/blob/7538680c/setup.py#L31
    The first known release to support environment marker with range operators
    it is 17.1, see: https://setuptools.readthedocs.io/en/latest/history.html#id113
    """
    return parse_version(setuptools_version) >= parse_version('17.1')


if has_environment_marker_range_operators_support():
    extras_require[':python_version=="2.7"'] = ['configparser', 'backports.functools_lru_cache']
    extras_require[':python_version<"3.4"'] = ['singledispatch']
else:
    if (py_version.major, py_version.minor) == (2, 7):
        install_requires.extend(['configparser', 'backports.functools_lru_cache'])
    if py_version < (3, 4):
        install_requires.extend(['singledispatch'])


license = 'GPL'
description = "python code static checker"
web = 'https://github.com/PyCQA/pylint'
mailinglist = "mailto:code-quality@python.org"
author = 'Python Code Quality Authority'
author_email = 'code-quality@python.org'

classifiers = ['Development Status :: 4 - Beta',
               'Environment :: Console',
               'Intended Audience :: Developers',
               'License :: OSI Approved :: GNU General Public License (GPL)',
               'Operating System :: OS Independent',
               'Programming Language :: Python',
               'Programming Language :: Python :: 2',
               'Programming Language :: Python :: 3',
               'Topic :: Software Development :: Debuggers',
               'Topic :: Software Development :: Quality Assurance',
               'Topic :: Software Development :: Testing'
              ]


long_desc = """\
 Pylint is a Python source code analyzer which looks for programming
 errors, helps enforcing a coding standard and sniffs for some code
 smells (as defined in Martin Fowler's Refactoring book)
 .
 Pylint can be seen as another PyChecker since nearly all tests you
 can do with PyChecker can also be done with Pylint. However, Pylint
 offers some more features, like checking length of lines of code,
 checking if variable names are well-formed according to your coding
 standard, or checking if declared interfaces are truly implemented,
 and much more.
 .
 Additionally, it is possible to write plugins to add your own checks.
 .
 Pylint is shipped with "pyreverse" (UML diagram generator)
 and "symilar" (an independent similarities checker)."""

scripts = [join('bin', filename)
           for filename in ('pylint', "symilar", "epylint",
                            "pyreverse")]

include_dirs = [join('pylint', 'test')]
