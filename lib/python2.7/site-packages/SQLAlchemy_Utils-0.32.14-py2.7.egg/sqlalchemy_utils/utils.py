import sys
from collections import Iterable

import six


def str_coercible(cls):
    if sys.version_info[0] >= 3:  # Python 3
        def __str__(self):
            return self.__unicode__()
    else:  # Python 2
        def __str__(self):
            return self.__unicode__().encode('utf8')

    cls.__str__ = __str__
    return cls


def is_sequence(value):
    return (
        isinstance(value, Iterable) and not isinstance(value, six.string_types)
    )


def starts_with(iterable, prefix):
    """
    Returns whether or not given iterable starts with given prefix.
    """
    return list(iterable)[0:len(prefix)] == list(prefix)
