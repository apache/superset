# coding: utf-8

from pandas.io.msgpack import packb, unpackb, ExtType


def test_str8():
    header = b'\xd9'
    data = b'x' * 32
    b = packb(data.decode(), use_bin_type=True)
    assert len(b) == len(data) + 2
    assert b[0:2] == header + b'\x20'
    assert b[2:] == data
    assert unpackb(b) == data

    data = b'x' * 255
    b = packb(data.decode(), use_bin_type=True)
    assert len(b) == len(data) + 2
    assert b[0:2] == header + b'\xff'
    assert b[2:] == data
    assert unpackb(b) == data


def test_bin8():
    header = b'\xc4'
    data = b''
    b = packb(data, use_bin_type=True)
    assert len(b) == len(data) + 2
    assert b[0:2] == header + b'\x00'
    assert b[2:] == data
    assert unpackb(b) == data

    data = b'x' * 255
    b = packb(data, use_bin_type=True)
    assert len(b) == len(data) + 2
    assert b[0:2] == header + b'\xff'
    assert b[2:] == data
    assert unpackb(b) == data


def test_bin16():
    header = b'\xc5'
    data = b'x' * 256
    b = packb(data, use_bin_type=True)
    assert len(b) == len(data) + 3
    assert b[0:1] == header
    assert b[1:3] == b'\x01\x00'
    assert b[3:] == data
    assert unpackb(b) == data

    data = b'x' * 65535
    b = packb(data, use_bin_type=True)
    assert len(b) == len(data) + 3
    assert b[0:1] == header
    assert b[1:3] == b'\xff\xff'
    assert b[3:] == data
    assert unpackb(b) == data


def test_bin32():
    header = b'\xc6'
    data = b'x' * 65536
    b = packb(data, use_bin_type=True)
    assert len(b) == len(data) + 5
    assert b[0:1] == header
    assert b[1:5] == b'\x00\x01\x00\x00'
    assert b[5:] == data
    assert unpackb(b) == data


def test_ext():
    def check(ext, packed):
        assert packb(ext) == packed
        assert unpackb(packed) == ext

    check(ExtType(0x42, b'Z'), b'\xd4\x42Z')  # fixext 1
    check(ExtType(0x42, b'ZZ'), b'\xd5\x42ZZ')  # fixext 2
    check(ExtType(0x42, b'Z' * 4), b'\xd6\x42' + b'Z' * 4)  # fixext 4
    check(ExtType(0x42, b'Z' * 8), b'\xd7\x42' + b'Z' * 8)  # fixext 8
    check(ExtType(0x42, b'Z' * 16), b'\xd8\x42' + b'Z' * 16)  # fixext 16
    # ext 8
    check(ExtType(0x42, b''), b'\xc7\x00\x42')
    check(ExtType(0x42, b'Z' * 255), b'\xc7\xff\x42' + b'Z' * 255)
    # ext 16
    check(ExtType(0x42, b'Z' * 256), b'\xc8\x01\x00\x42' + b'Z' * 256)
    check(ExtType(0x42, b'Z' * 0xffff), b'\xc8\xff\xff\x42' + b'Z' * 0xffff)
    # ext 32
    check(
        ExtType(0x42, b'Z' *
                0x10000), b'\xc9\x00\x01\x00\x00\x42' + b'Z' * 0x10000)
    # needs large memory
    # check(ExtType(0x42, b'Z'*0xffffffff),
    #              b'\xc9\xff\xff\xff\xff\x42' + b'Z'*0xffffffff)
