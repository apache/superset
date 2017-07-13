README for Pylint - http://www.pylint.org/
==========================================

.. image:: https://travis-ci.org/PyCQA/pylint.svg?branch=master
    :target: https://travis-ci.org/PyCQA/pylint

.. image:: https://ci.appveyor.com/api/projects/status/rbvwhakyj1y09atb/branch/master?svg=true
    :alt: AppVeyor Build Status
    :target: https://ci.appveyor.com/project/PCManticore/pylint

.. image:: https://coveralls.io/repos/github/PyCQA/pylint/badge.svg?branch=master
    :target: https://coveralls.io/github/PyCQA/pylint?branch=master

.. image:: https://img.shields.io/pypi/v/pylint.svg
    :alt: Pypi Package version
    :target: https://pypi.python.org/pypi/pylint

.. image:: https://readthedocs.org/projects/pylint/badge/?version=latest
    :target: http://pylint.readthedocs.io/en/latest/?badge=latest
    :alt: Documentation Status

Pylint is a Python source code analyzer which looks for programming errors,
helps enforcing a coding standard and sniffs for some code smells (as defined in
Martin Fowler's Refactoring book).

Pylint has many rules enabled by default, way too much to silence them all on a
minimally sized program. It's highly configurable and handle pragmas to control
it from within your code. Additionally, it is possible to write plugins to add
your own checks.

It's a free software distributed under the GNU General Public Licence.

Development is hosted on GitHub: https://github.com/PyCQA/pylint/

You can use the code-quality@python.org mailing list to discuss about
Pylint. Subscribe at https://mail.python.org/mailman/listinfo/code-quality/
or read the archives at https://mail.python.org/pipermail/code-quality/

Install
-------

Pylint requires astroid package (the later the better).

* https://github.com/PyCQA/astroid

Installation should be as simple as ::

    python -m pip install astroid

Pylint requires isort package (the later the better).

* https://github.com/timothycrosley/isort

Installation should be as simple as ::

    python -m pip install isort


If you want to install from a source distribution, extract the tarball and run
the following commands ::

    python setup.py install

You'll have to install dependencies in a similar way. For debian and
rpm packages, use your usual tools according to your Linux distribution.

More information about installation and available distribution format
may be found in the user manual in the *doc* subdirectory.

Documentation
-------------

Look in the doc/ subdirectory or at http://docs.pylint.org

Pylint is shipped with following additional commands:

* pyreverse: an UML diagram generator
* symilar: an independent similarities checker
* epylint: Emacs and Flymake compatible Pylint


