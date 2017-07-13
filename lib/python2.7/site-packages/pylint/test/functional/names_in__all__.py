# pylint: disable=too-few-public-methods,no-self-use, no-absolute-import,import-error
"""Test Pylint's use of __all__.

* NonExistant is not defined in this module, and it is listed in
  __all__. An error is expected.

* This module imports path and republished it in __all__. No errors
  are expected.
"""
from __future__ import print_function
from os import path
from collections import deque
from missing import Missing

__all__ = [
    'Dummy',
    '', # [undefined-all-variable]
    Missing,
    SomeUndefined, # [undefined-variable]
    'NonExistant',  # [undefined-all-variable]
    'path',
    'func',  # [undefined-all-variable]
    'inner',  # [undefined-all-variable]
    'InnerKlass', deque.__name__]  # [undefined-all-variable]


class Dummy(object):
    """A class defined in this module."""
    pass

DUMMY = Dummy()

def function():
    """Function docstring
    """
    pass

function()

class Klass(object):
    """A klass which contains a function"""
    def func(self):
        """A klass method"""
        inner = None
        print(inner)

    class InnerKlass(object):
        """A inner klass"""
        pass
