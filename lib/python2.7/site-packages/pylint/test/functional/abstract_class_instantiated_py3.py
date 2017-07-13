"""Check that instantiating a class with
`abc.ABCMeta` as metaclass fails if it defines
abstract methods.
"""

# pylint: disable=too-few-public-methods, missing-docstring
# pylint: disable=abstract-method, import-error

import abc
import weakref
from lala import Bala


class GoodClass(object, metaclass=abc.ABCMeta):
    pass

class SecondGoodClass(object, metaclass=abc.ABCMeta):
    def test(self):
        """ do nothing. """

class ThirdGoodClass(object, metaclass=abc.ABCMeta):
    """ This should not raise the warning. """
    def test(self):
        raise NotImplementedError()

class BadClass(object, metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def test(self):
        """ do nothing. """

class SecondBadClass(object, metaclass=abc.ABCMeta):
    @property
    @abc.abstractmethod
    def test(self):
        """ do nothing. """

class ThirdBadClass(SecondBadClass):
    pass


class Structure(object, metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def __iter__(self):
        pass
    @abc.abstractmethod
    def __len__(self):
        pass
    @abc.abstractmethod
    def __contains__(self, _):
        pass
    @abc.abstractmethod
    def __hash__(self):
        pass

class Container(Structure):
    def __contains__(self, _):
        pass

class Sizable(Structure):
    def __len__(self):
        pass

class Hashable(Structure):
    __hash__ = 42


class Iterator(Structure):
    def keys(self): # pylint: disable=no-self-use
        return iter([1, 2, 3])

    __iter__ = keys

class AbstractSizable(Structure):
    @abc.abstractmethod
    def length(self):
        pass
    __len__ = length

class NoMroAbstractMethods(Container, Iterator, Sizable, Hashable):
    pass

class BadMroAbstractMethods(Container, Iterator, AbstractSizable):
    pass

class SomeMetaclass(metaclass=abc.ABCMeta):

    @abc.abstractmethod
    def prop(self):
        pass

class FourthGoodClass(SomeMetaclass):
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
    weakref.WeakKeyDictionary()
    weakref.WeakValueDictionary()
    NoMroAbstractMethods()

    BadMroAbstractMethods() # [abstract-class-instantiated]
    BadClass() # [abstract-class-instantiated]
    SecondBadClass() # [abstract-class-instantiated]
    ThirdBadClass() # [abstract-class-instantiated]
