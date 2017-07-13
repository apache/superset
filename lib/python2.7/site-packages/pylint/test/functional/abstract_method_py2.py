"""Test abstract-method warning."""
from __future__ import print_function

# pylint: disable=missing-docstring, no-init, no-self-use
# pylint: disable=too-few-public-methods
import abc

class Abstract(object):
    def aaaa(self):
        """should be overridden in concrete class"""
        raise NotImplementedError()

    def bbbb(self):
        """should be overridden in concrete class"""
        raise NotImplementedError()


class AbstractB(Abstract):
    """Abstract class.

    this class is checking that it does not output an error msg for
    unimplemeted methods in abstract classes
    """
    def cccc(self):
        """should be overridden in concrete class"""
        raise NotImplementedError()

class Concret(Abstract): # [abstract-method]
    """Concrete class"""

    def aaaa(self):
        """overidden form Abstract"""


class Structure(object):
    __metaclass__ = abc.ABCMeta

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


# +1: [abstract-method, abstract-method, abstract-method]
class Container(Structure):
    def __contains__(self, _):
        pass


# +1: [abstract-method, abstract-method, abstract-method]
class Sizable(Structure):
    def __len__(self):
        pass


# +1: [abstract-method, abstract-method, abstract-method]
class Hashable(Structure):
    __hash__ = 42


# +1: [abstract-method, abstract-method, abstract-method]
class Iterator(Structure):
    def keys(self):
        return iter([1, 2, 3])

    __iter__ = keys


class AbstractSizable(Structure):
    @abc.abstractmethod
    def length(self):
        pass
    __len__ = length


class GoodComplexMRO(Container, Iterator, Sizable, Hashable):
    pass


# +1: [abstract-method, abstract-method, abstract-method]
class BadComplexMro(Container, Iterator, AbstractSizable):
    pass
