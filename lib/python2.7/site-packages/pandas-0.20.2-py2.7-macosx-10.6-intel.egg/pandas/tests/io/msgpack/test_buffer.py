# coding: utf-8

from pandas.io.msgpack import packb, unpackb
from .common import frombytes


def test_unpack_buffer():
    from array import array
    buf = array('b')
    frombytes(buf, packb((b'foo', b'bar')))
    obj = unpackb(buf, use_list=1)
    assert [b'foo', b'bar'] == obj


def test_unpack_bytearray():
    buf = bytearray(packb(('foo', 'bar')))
    obj = unpackb(buf, use_list=1)
    assert [b'foo', b'bar'] == obj
    expected_type = bytes
    assert all(type(s) == expected_type for s in obj)
