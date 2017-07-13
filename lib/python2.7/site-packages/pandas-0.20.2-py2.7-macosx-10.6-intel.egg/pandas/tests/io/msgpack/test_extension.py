from __future__ import print_function
import array

import pandas.io.msgpack as msgpack
from pandas.io.msgpack import ExtType
from .common import frombytes, tobytes


def test_pack_ext_type():
    def p(s):
        packer = msgpack.Packer()
        packer.pack_ext_type(0x42, s)
        return packer.bytes()

    assert p(b'A') == b'\xd4\x42A'  # fixext 1
    assert p(b'AB') == b'\xd5\x42AB'  # fixext 2
    assert p(b'ABCD') == b'\xd6\x42ABCD'  # fixext 4
    assert p(b'ABCDEFGH') == b'\xd7\x42ABCDEFGH'  # fixext 8
    assert p(b'A' * 16) == b'\xd8\x42' + b'A' * 16  # fixext 16
    assert p(b'ABC') == b'\xc7\x03\x42ABC'  # ext 8
    assert p(b'A' * 0x0123) == b'\xc8\x01\x23\x42' + b'A' * 0x0123  # ext 16
    assert (p(b'A' * 0x00012345) ==
            b'\xc9\x00\x01\x23\x45\x42' + b'A' * 0x00012345)  # ext 32


def test_unpack_ext_type():
    def check(b, expected):
        assert msgpack.unpackb(b) == expected

    check(b'\xd4\x42A', ExtType(0x42, b'A'))  # fixext 1
    check(b'\xd5\x42AB', ExtType(0x42, b'AB'))  # fixext 2
    check(b'\xd6\x42ABCD', ExtType(0x42, b'ABCD'))  # fixext 4
    check(b'\xd7\x42ABCDEFGH', ExtType(0x42, b'ABCDEFGH'))  # fixext 8
    check(b'\xd8\x42' + b'A' * 16, ExtType(0x42, b'A' * 16))  # fixext 16
    check(b'\xc7\x03\x42ABC', ExtType(0x42, b'ABC'))  # ext 8
    check(b'\xc8\x01\x23\x42' + b'A' * 0x0123,
          ExtType(0x42, b'A' * 0x0123))  # ext 16
    check(b'\xc9\x00\x01\x23\x45\x42' + b'A' * 0x00012345,
          ExtType(0x42, b'A' * 0x00012345))  # ext 32


def test_extension_type():
    def default(obj):
        print('default called', obj)
        if isinstance(obj, array.array):
            typecode = 123  # application specific typecode
            data = tobytes(obj)
            return ExtType(typecode, data)
        raise TypeError("Unknwon type object %r" % (obj, ))

    def ext_hook(code, data):
        print('ext_hook called', code, data)
        assert code == 123
        obj = array.array('d')
        frombytes(obj, data)
        return obj

    obj = [42, b'hello', array.array('d', [1.1, 2.2, 3.3])]
    s = msgpack.packb(obj, default=default)
    obj2 = msgpack.unpackb(s, ext_hook=ext_hook)
    assert obj == obj2
