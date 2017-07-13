.. image:: https://img.shields.io/pypi/v/backports.functools_lru_cache.svg
   :target: https://pypi.org/project/backports.functools_lru_cache

.. image:: https://img.shields.io/pypi/pyversions/backports.functools_lru_cache.svg

.. image:: https://img.shields.io/pypi/dm/backports.functools_lru_cache.svg

.. image:: https://img.shields.io/travis/jaraco/backports.functools_lru_cache/master.svg
   :target: http://travis-ci.org/jaraco/backports.functools_lru_cache


License
=======

License is indicated in the project metadata (typically one or more
of the Trove classifiers). For more details, see `this explanation
<https://github.com/jaraco/skeleton/issues/1>`_.

Backport of functools.lru_cache from Python 3.3 as published at `ActiveState
<http://code.activestate.com/recipes/578078/>`_.

Usage
-----

Consider using this technique for importing the 'lru_cache' function::

    try:
        from functools import lru_cache
    except ImportError:
        from backports.functools_lru_cache import lru_cache


