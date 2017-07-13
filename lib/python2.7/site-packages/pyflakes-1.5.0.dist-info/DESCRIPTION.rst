========
Pyflakes
========

A simple program which checks Python source files for errors.

Pyflakes analyzes programs and detects various errors.  It works by
parsing the source file, not importing it, so it is safe to use on
modules with side effects.  It's also much faster.

It is `available on PyPI <https://pypi.python.org/pypi/pyflakes>`_
and it supports all active versions of Python from 2.5 to 3.5.



Installation
------------

It can be installed with::

  $ pip install --upgrade pyflakes


Useful tips:

* Be sure to install it for a version of Python which is compatible
  with your codebase: for Python 2, ``pip2 install pyflakes`` and for
  Python3, ``pip3 install pyflakes``.

* You can also invoke Pyflakes with ``python3 -m pyflakes .`` or
  ``python2 -m pyflakes .`` if you have it installed for both versions.

* If you require more options and more flexibility, you could give a
  look to Flake8_ too.


Design Principles
-----------------
Pyflakes makes a simple promise: it will never complain about style,
and it will try very, very hard to never emit false positives.

Pyflakes is also faster than Pylint_
or Pychecker_. This is
largely because Pyflakes only examines the syntax tree of each file
individually. As a consequence, Pyflakes is more limited in the
types of things it can check.

If you like Pyflakes but also want stylistic checks, you want
flake8_, which combines
Pyflakes with style checks against
`PEP 8`_ and adds
per-project configuration ability.


Mailing-list
------------

Share your feedback and ideas: `subscribe to the mailing-list
<https://mail.python.org/mailman/listinfo/code-quality>`_

Contributing
------------

Issues are tracked on `Launchpad <https://bugs.launchpad.net/pyflakes>`_.

Patches may be submitted via a `GitHub pull request`_ or via the mailing list
if you prefer. If you are comfortable doing so, please `rebase your changes`_
so they may be applied to master with a fast-forward merge, and each commit is
a coherent unit of work with a well-written log message.  If you are not
comfortable with this rebase workflow, the project maintainers will be happy to
rebase your commits for you.

All changes should include tests and pass flake8_.

.. image:: https://api.travis-ci.org/PyCQA/pyflakes.svg
   :target: https://travis-ci.org/PyCQA/pyflakes
   :alt: Build status

.. _Pylint: http://www.pylint.org/
.. _flake8: https://pypi.python.org/pypi/flake8
.. _`PEP 8`: http://legacy.python.org/dev/peps/pep-0008/
.. _Pychecker: http://pychecker.sourceforge.net/
.. _`rebase your changes`: https://git-scm.com/book/en/v2/Git-Branching-Rebasing
.. _`GitHub pull request`: https://github.com/PyCQA/pyflakes/pulls


