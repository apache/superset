""" Various tests for class members access. """
# pylint: disable=R0903,import-error,no-init,missing-docstring, wrong-import-position,wrong-import-order
from missing import Missing
class MyClass(object):
    """class docstring"""

    def __init__(self):
        """init"""
        self.correct = 1

    def test(self):
        """test"""
        self.correct += 2
        self.incorrect += 2 # [no-member]
        del self.havenot # [no-member]
        self.nonexistent1.truc() # [no-member]
        self.nonexistent2[1] = 'hehe' # [no-member]

class XYZMixin(object):
    """access to undefined members should be ignored in mixin classes by
    default
    """
    def __init__(self):
        print(self.nonexistent)


class NewClass(object):
    """use object.__setattr__"""
    def __init__(self):
        self.__setattr__('toto', 'tutu')

from abc import ABCMeta

class TestMetaclass(object, metaclass=ABCMeta):
    """ Test attribute access for metaclasses. """

class Metaclass(type):
    """ metaclass """
    @classmethod
    def test(mcs):
        """ classmethod """

class UsingMetaclass(object, metaclass=Metaclass):
    """ empty """

TestMetaclass.register(int)
UsingMetaclass.test()
TestMetaclass().register(int) # [no-member]
UsingMetaclass().test() # [no-member]


class NoKnownBases(Missing):
    """Don't emit no-member if we don't know the bases of a class."""

NoKnownBases().lalala()


class MetaClass(object):
    """Look some methods in the implicit metaclass."""

    @classmethod
    def whatever(cls):
        return cls.mro() + cls.missing() # [no-member]

from collections import namedtuple

Tuple = namedtuple("Tuple", "field other")
Tuple.field.__doc__ = "A doc for the field."
