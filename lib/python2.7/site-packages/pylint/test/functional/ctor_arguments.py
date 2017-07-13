"""Test function argument checker on __init__

Based on test/functional/arguments.py
"""
# pylint: disable=C0111,R0903,W0231


class Class1Arg(object):
    def __init__(self, first_argument):
        """one argument function"""

class Class3Arg(object):
    def __init__(self, first_argument, second_argument, third_argument):
        """three arguments function"""

class ClassDefaultArg(object):
    def __init__(self, one=1, two=2):
        """function with default value"""

class Subclass1Arg(Class1Arg):
    pass

class ClassAllArgs(Class1Arg):
    def __init__(self, *args, **kwargs):
        pass

class ClassMultiInheritance(Class1Arg, Class3Arg):
    pass

class ClassNew(object):
    def __new__(cls, first_argument, kwarg=None):
        return first_argument, kwarg

Class1Arg(420)
Class1Arg()  # [no-value-for-parameter]
Class1Arg(1337, 347)  # [too-many-function-args]

Class3Arg(420, 789)  # [no-value-for-parameter]
# +1:[no-value-for-parameter,no-value-for-parameter,no-value-for-parameter]
Class3Arg()
Class3Arg(1337, 347, 456)
Class3Arg('bab', 'bebe', None, 5.6)  # [too-many-function-args]

ClassDefaultArg(1, two=5)
ClassDefaultArg(two=5)

Class1Arg(bob=4)  # [no-value-for-parameter,unexpected-keyword-arg]
ClassDefaultArg(1, 4, coin="hello")  # [unexpected-keyword-arg]

ClassDefaultArg(1, one=5)  # [redundant-keyword-arg]

Subclass1Arg(420)
Subclass1Arg()  # [no-value-for-parameter]
Subclass1Arg(1337, 347)  # [too-many-function-args]

ClassAllArgs()
ClassAllArgs(1, 2, 3, even=4, more=5)

ClassMultiInheritance(1)
ClassMultiInheritance(1, 2, 3)  # [too-many-function-args]

ClassNew(1, kwarg=1)
ClassNew(1, 2, 3)  # [too-many-function-args]
ClassNew(one=2)  # [no-value-for-parameter,unexpected-keyword-arg]


class Metaclass(type):
    def __new__(mcs, name, bases, namespace):
        return type.__new__(mcs, name, bases, namespace)

def with_metaclass(meta, base=object):
    """Create a new type that can be used as a metaclass."""
    return meta("NewBase", (base, ), {})

class ClassWithMeta(with_metaclass(Metaclass)):
    pass

ClassWithMeta()


class BuiltinExc(Exception):
    def __init__(self, val=True):
        self.val = val

BuiltinExc(42, 24, badarg=1) # [too-many-function-args,unexpected-keyword-arg]


class Clsmethod(object):
    def __init__(self, first, second):
        self.first = first
        self.second = second

    @classmethod
    def from_nothing(cls):
        return cls(1, 2, 3, 4) # [too-many-function-args]

    @classmethod
    def from_nothing1(cls):
        return cls() # [no-value-for-parameter,no-value-for-parameter]

    @classmethod
    def from_nothing2(cls):
        # +1: [no-value-for-parameter,unexpected-keyword-arg]
        return cls(1, not_argument=2)
