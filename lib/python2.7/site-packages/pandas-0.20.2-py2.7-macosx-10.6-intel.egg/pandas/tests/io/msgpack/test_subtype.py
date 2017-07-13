# coding: utf-8

from pandas.io.msgpack import packb
from collections import namedtuple


class MyList(list):
    pass


class MyDict(dict):
    pass


class MyTuple(tuple):
    pass


MyNamedTuple = namedtuple('MyNamedTuple', 'x y')


def test_types():
    assert packb(MyDict()) == packb(dict())
    assert packb(MyList()) == packb(list())
    assert packb(MyNamedTuple(1, 2)) == packb((1, 2))
