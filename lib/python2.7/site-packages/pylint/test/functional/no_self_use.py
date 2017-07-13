# pylint: disable=R0903,W0232,missing-docstring
"""test detection of method which could be a function"""

from __future__ import print_function

class Toto(object):
    """bla bal abl"""

    def __init__(self):
        self.aaa = 2

    def regular_method(self):
        """this method is a real method since it access to self"""
        self.function_method()

    def function_method(self): # [no-self-use]
        """this method isn' a real method since it doesn't need self"""
        print('hello')


class Base(object):
    """an abstract class"""

    def __init__(self):
        self.aaa = 2

    def check(self, arg):
        """an abstract method, could not be a function"""
        raise NotImplementedError


class Sub(Base):
    """a concrete class"""

    def check(self, arg):
        """a concrete method, could not be a function since it need
        polymorphism benefits
        """
        return arg == 0

class Super(object):
    """same as before without abstract"""
    attr = 1
    def method(self):
        """regular"""
        print(self.attr)

class Sub1(Super):
    """override method with need for self"""
    def method(self):
        """no i can not be a function"""
        print(42)

    def __len__(self):
        """no i can not be a function"""
        print(42)

    def __cmp__(self, other):
        """no i can not be a function"""
        print(42)

    def __copy__(self):
        return 24

    def __getstate__(self):
        return 42


class Prop(object):

    @property
    def count(self):
        """Don't emit no-self-use for properties.

        They can't be functions and they can be part of an
        API specification.
        """
        return 42
