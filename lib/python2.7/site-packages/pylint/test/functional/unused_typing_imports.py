# pylint: disable=missing-docstring, bad-whitespace
"""Regression test for https://github.com/PyCQA/pylint/issues/1168

The problem was that we weren't handling keyword-only arguments annotations,
which means we were never processing them.
"""


from typing import Optional, Callable, Iterable


def func1(arg: Optional[Callable]=None):
    return arg


def func2(*, arg: Optional[Iterable]=None):
    return arg
