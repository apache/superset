"""Check invalid value returned by __len__ """

# pylint: disable=too-few-public-methods,missing-docstring,no-self-use,import-error
import sys

import six

from missing import Missing


class FirstGoodLen(object):
    """__len__ returns <type 'int'>"""

    def __len__(self):
        return 0


class SecondGoodLen(object):
    """__len__ returns <type 'long'>"""

    def __len__(self):
        return sys.maxsize + 1


class LenMetaclass(type):
    def __len__(cls):
        return 1


@six.add_metaclass(LenMetaclass)
class ThirdGoodLen(object):
    """Length through the metaclass."""


class FirstBadLen(object):
    """ __len__ returns a negative integer """

    def __len__(self):  # [invalid-length-returned]
        return -1


class SecondBadLen(object):
    """ __len__ returns non-int """

    def __len__(self):  # [invalid-length-returned]
        return 3.0


class ThirdBadLen(object):
    """ __len__ returns node which does not have 'value' in AST """

    def __len__(self):  # [invalid-length-returned]
        return lambda: 3


class AmbigousLen(object):
    """ Uninferable return value """
    __len__ = lambda self: Missing
