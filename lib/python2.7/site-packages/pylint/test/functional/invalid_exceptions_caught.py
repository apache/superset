# pylint: disable=missing-docstring, too-few-public-methods
# pylint: disable=too-many-ancestors, no-absolute-import, import-error, multiple-imports,wrong-import-position
from __future__ import print_function

import socket, binascii, abc, six

class MyException(object):
    """Custom 'exception'."""

class MySecondException(object):
    """Custom 'exception'."""

class MyGoodException(Exception):
    """Custom exception."""

class MySecondGoodException(MyGoodException):
    """Custom exception."""

class SkipException(socket.error):
    """Not an exception for Python 2, but one in 3."""

class SecondSkipException(SkipException):
    """Also a good exception."""

try:
    1 + 1
except MyException:  # [catching-non-exception]
    print("caught")

try:
    1 + 2
# +1:[catching-non-exception,catching-non-exception]
except (MyException, MySecondException):
    print("caught")

try:
    1 + 3
except MyGoodException:
    print("caught")

try:
    1 + 3
except (MyGoodException, MySecondGoodException):
    print("caught")

try:
    1 + 3
except (SkipException, SecondSkipException):
    print("caught")

try:
    1 + 42
# +1:[catching-non-exception,catching-non-exception]
except (None, list()):
    print("caught")

try:
    1 + 24
except None: # [catching-non-exception]
    print("caught")

EXCEPTION = None
EXCEPTION = ZeroDivisionError
try:
    1 + 46
except EXCEPTION:
    print("caught")

try:
    1 + 42
# +1:[catching-non-exception,catching-non-exception,catching-non-exception]
except (list([4, 5, 6]), None, ZeroDivisionError, 4):
    print("caught")

EXCEPTION_TUPLE = (ZeroDivisionError, OSError)
NON_EXCEPTION_TUPLE = (ZeroDivisionError, OSError, 4)

try:
    1 + 42
except EXCEPTION_TUPLE:
    print("caught")

try:
    1 + 42
except NON_EXCEPTION_TUPLE: # [catching-non-exception]
    print("caught")

from missing_import import UnknownError
UNKNOWN_COMPONENTS = (ZeroDivisionError, UnknownError)

try:
    1 + 42
except UNKNOWN_COMPONENTS:
    print("caught")

try:
    1 + 42
except binascii.Error:
    print('builtin and detected')

try:
    1 + 45
except object: # [catching-non-exception]
    print('caught')

try:
    1 + 42
except range: # [catching-non-exception]
    print('caught')


class HasErrorInMRO(six.with_metaclass(abc.ABCMeta, Exception)):
    pass


class Second(HasErrorInMRO):
    pass


try:
    raise Second
except Second:
    pass
