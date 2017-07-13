# pylint: disable=R0201,missing-docstring,using-constant-test
from __future__ import division
__revision__ = ''

class AAAA(object):
    """docstring"""
    def __init__(self):
        pass
    def method1(self):
        """docstring"""

    def method2(self):
        """docstring"""

    def method2(self): # [function-redefined]
        """docstring"""

class AAAA(object): # [function-redefined]
    """docstring"""
    def __init__(self):
        pass
    def yeah(self):
        """hehehe"""
    def yoo(self):
        """yoo"""
def func1():
    """docstring"""

def func2():
    """docstring"""

def func2(): # [function-redefined]
    """docstring"""
    __revision__ = 1 # [redefined-outer-name]
    return __revision__

if __revision__:
    def exclusive_func():
        "docstring"
else:
    def exclusive_func():
        "docstring"

try:
    def exclusive_func2():
        "docstring"
except TypeError:
    def exclusive_func2():
        "docstring"
else:
    def exclusive_func2(): # [function-redefined]
        "this one redefine the one defined line 42"


def with_inner_function_1():
    """docstring"""
    def callback():
        """callback docstring"""
        pass
    return callback

def with_inner_function_2():
    """docstring"""
    def callback():
        """does not redefine callback returned by with_inner_function_1"""
        pass
    return callback

def some_func():
    """Don't emit if we defined a variable with the same name as a
    __future__ directive.
    """
    division = 2
    return division
