# pylint:disable=too-few-public-methods,old-style-class,no-init,import-error,missing-docstring, not-callable
"""test pb with exceptions and old/new style classes"""


class ValidException(Exception):
    """Valid Exception."""

class OldStyleClass:
    """Not an exception."""

class NewStyleClass(object):
    """Not an exception."""


def good_case():
    """raise"""
    raise ValidException('hop')

def good_case1():
    """zlib.error is defined in C module."""
    import zlib
    raise zlib.error(4)

def good_case2():
    """decimal.DivisionByZero is defined in C on Python 3."""
    import decimal
    raise decimal.DivisionByZero(4)

def good_case3():
    """io.BlockingIOError is defined in C."""
    import io
    raise io.BlockingIOError

def bad_case0():
    """raise"""
    # +2:<3.0:[nonstandard-exception]
    # +1:>=3.0:[raising-non-exception]
    raise OldStyleClass('hop')

def bad_case1():
    """raise"""
    raise NewStyleClass()  # [raising-non-exception]

def bad_case2():
    """raise"""
    # +2:<3.0:[nonstandard-exception]
    # +1:>=3.0:[raising-non-exception]
    raise OldStyleClass('hop')

def bad_case3():
    """raise"""
    raise NewStyleClass  # [raising-non-exception]

def bad_case4():
    """raise"""
    raise NotImplemented('hop')  # [notimplemented-raised]

def bad_case5():
    """raise"""
    raise 1  # [raising-bad-type]

def bad_case6():
    """raise"""
    raise None  # [raising-bad-type]

def bad_case7():
    """raise list"""
    raise list # [raising-non-exception]

def bad_case8():
    """raise tuple"""
    raise tuple # [raising-non-exception]

def bad_case9():
    """raise dict"""
    raise dict # [raising-non-exception]

def unknown_bases():
    """Don't emit when we don't know the bases."""
    from lala import bala
    class MyException(bala):
        pass
    raise MyException


def exception_instance_regression():
    """Exceptions have a particular class type"""
    try:
        int("9a")
    except ValueError as exc:
        raise exc
