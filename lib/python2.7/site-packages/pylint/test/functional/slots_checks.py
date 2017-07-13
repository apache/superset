""" Checks that classes uses valid __slots__ """

# pylint: disable=too-few-public-methods, missing-docstring, no-absolute-import
# pylint: disable=using-constant-test, wrong-import-position, no-else-return
from collections import deque

def func():
    if True:
        return ("a", "b", "c")
    else:
        return [str(var) for var in range(3)]


class NotIterable(object):
    def __iter_(self):
        """ do nothing """

class Good(object):
    __slots__ = ()

class SecondGood(object):
    __slots__ = []

class ThirdGood(object):
    __slots__ = ['a']

class FourthGood(object):
    __slots__ = ('a%s' % i for i in range(10))

class FifthGood(object):
    __slots__ = deque(["a", "b", "c"])

class SixthGood(object):
    __slots__ = {"a": "b", "c": "d"}

class Bad(object): # [invalid-slots]
    __slots__ = list

class SecondBad(object):  # [invalid-slots]
    __slots__ = 1

class ThirdBad(object):
    __slots__ = ('a', 2)  # [invalid-slots-object]

class FourthBad(object):  # [invalid-slots]
    __slots__ = NotIterable()

class FifthBad(object):
    __slots__ = ("a", "b", "")  # [invalid-slots-object]

class SixthBad(object):  # [single-string-used-for-slots]
    __slots__ = "a"

class SeventhBad(object):  # [single-string-used-for-slots]
    __slots__ = ('foo')

class EighthBad(object):  # [single-string-used-for-slots]
    __slots__ = deque.__name__

class PotentiallyGood(object):
    __slots__ = func()

class PotentiallySecondGood(object):
    __slots__ = ('a', deque.__name__)


import six


class Metaclass(type):

    def __iter__(cls):
        for value in range(10):
            yield str(value)


@six.add_metaclass(Metaclass)
class IterableClass(object):
    pass

class PotentiallyThirdGood(object):
    __slots__ = IterableClass

class PotentiallyFourthGood(object):
    __slots__ = Good.__slots__
