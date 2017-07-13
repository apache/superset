"""Check that instantiating a class with
`abc.ABCMeta` as metaclass fails if it defines
abstract methods.
"""

# pylint: disable=too-few-public-methods, missing-docstring
# pylint: disable=no-absolute-import, metaclass-assignment
# pylint: disable=abstract-method, import-error, wildcard-import

import abc
from abc import ABCMeta
from lala import Bala


class GoodClass(object):
    __metaclass__ = abc.ABCMeta

class SecondGoodClass(object):
    __metaclass__ = abc.ABCMeta

    def test(self):
        """ do nothing. """

class ThirdGoodClass(object):
    __metaclass__ = abc.ABCMeta

    def test(self):
        raise NotImplementedError()

class FourthGoodClass(object):
    __metaclass__ = ABCMeta

class BadClass(object):
    __metaclass__ = abc.ABCMeta

    @abc.abstractmethod
    def test(self):
        """ do nothing. """

class SecondBadClass(object):
    __metaclass__ = abc.ABCMeta

    @property
    @abc.abstractmethod
    def test(self):
        """ do nothing. """

class ThirdBadClass(object):
    __metaclass__ = ABCMeta

    @abc.abstractmethod
    def test(self):
        pass

class FourthBadClass(ThirdBadClass):
    pass


class SomeMetaclass(object):
    __metaclass__ = ABCMeta

    @abc.abstractmethod
    def prop(self):
        pass

class FifthGoodClass(SomeMetaclass):
    """Don't consider this abstract if some attributes are
    there, but can't be inferred.
    """
    prop = Bala # missing


def main():
    """ do nothing """
    GoodClass()
    SecondGoodClass()
    ThirdGoodClass()
    FourthGoodClass()
    BadClass() # [abstract-class-instantiated]
    SecondBadClass() # [abstract-class-instantiated]
    ThirdBadClass() # [abstract-class-instantiated]
    FourthBadClass() # [abstract-class-instantiated]
