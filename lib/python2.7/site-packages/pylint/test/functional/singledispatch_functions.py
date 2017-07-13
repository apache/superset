# pylint: disable=missing-docstring,import-error,unused-import,assignment-from-no-return
# pylint: disable=invalid-name, too-few-public-methods
from __future__ import print_function
from UNINFERABLE import uninferable_func

try:
    from functools import singledispatch
except ImportError:
    from singledispatch import singledispatch

my_single_dispatch = singledispatch


class FakeSingleDispatch(object):

    @staticmethod
    def register(function):
        return function

    def __call__(self, function):
        return function

fake_singledispatch_decorator = FakeSingleDispatch()

@singledispatch
def func(arg):
    return arg


@func.register(str)
def _(arg):
    return 42


@func.register(float)
@func.register(int)
def _(arg):
    return 42


@my_single_dispatch
def func2(arg):
    return arg


@func2.register(int)
def _(arg):
    return 42


@singledispatch
def with_extra_arg(arg, verbose=False):
    if verbose:
        print(arg)
    return arg


@with_extra_arg.register(str)
def _(arg, verbose=False):
    unused = 42 # [unused-variable]
    return arg[::-1]


@fake_singledispatch_decorator
def not_single_dispatch(arg): # [unused-argument]
    return 'not yet implemented'


@fake_singledispatch_decorator.register(str)
def bad_single_dispatch(arg): # [unused-argument]
    return 42


@fake_singledispatch_decorator.register(str)
def bad_single_dispatch(arg): # [unused-argument, function-redefined]
    return 24
