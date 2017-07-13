"""Checks variable types aren't redefined within a method or a function"""

# pylint: disable=too-few-public-methods,missing-docstring,unused-variable,invalid-name

_OK = True

class MyClass(object):

    class Klass(object):
        def __init__(self):
            self.var2 = 'var'

    def __init__(self):
        self.var = True
        self.var1 = 2
        self.var2 = 1.
        self.var1 = 2.  # [redefined-variable-type]
        self.a_str = "hello"
        a_str = False
        (a_str, b_str) = (1, 2)  # no support for inference on tuple assignment
        a_str = 2.0 if self.var else 1.0  # no support for inference on ifexpr

    def _getter(self):
        return self.a_str
    def _setter(self, val):
        self.a_str = val
    var2 = property(_getter, _setter)

    def some_method(self):
        def func():
            var = 1
            test = 'bar'
            var = 'baz'  # [redefined-variable-type]
        self.var = 1  # the rule checks for redefinitions in the scope of a function or method
        test = 'foo'
        myint = 2
        myint = False  # [redefined-variable-type]

_OK = "This is OK"  # [redefined-variable-type]

if _OK:
    SOME_FLOAT = 1.

def dummy_function():
    return 2

def other_function():
    instance = MyClass()
    instance = True  # [redefined-variable-type]

SOME_FLOAT = dummy_function()  # [redefined-variable-type]

A_GLOB = None
A_GLOB = [1, 2, 3]

def func2(x):
    if x:
        var = 'foo'
    else:
        var = True

    if x:
        var2 = 'foo'
    elif not x:
        var2 = 2
    else:
        pass

    if x:
        var3 = 'foo'
        var3 = 2  # [redefined-variable-type]
    else:
        pass

    var = 2  # [redefined-variable-type]

    if x:
        pass
    elif not x:
        var4 = True
    elif _OK:
        pass
    else:
        var4 = 2.
        var4 = 'baz'  # [redefined-variable-type]
