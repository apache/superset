# coding: utf-8

from pandas.io.msgpack import unpackb


def check(src, should, use_list=0):
    assert unpackb(src, use_list=use_list) == should


def testSimpleValue():
    check(b"\x93\xc0\xc2\xc3", (None, False, True, ))


def testFixnum():
    check(b"\x92\x93\x00\x40\x7f\x93\xe0\xf0\xff", ((0,
                                                     64,
                                                     127, ),
                                                    (-32,
                                                     -16,
                                                     -1, ), ))


def testFixArray():
    check(b"\x92\x90\x91\x91\xc0", ((), ((None, ), ), ), )


def testFixRaw():
    check(b"\x94\xa0\xa1a\xa2bc\xa3def", (b"", b"a", b"bc", b"def", ), )


def testFixMap():
    check(b"\x82\xc2\x81\xc0\xc0\xc3\x81\xc0\x80",
          {False: {None: None},
           True: {None: {}}}, )


def testUnsignedInt():
    check(b"\x99\xcc\x00\xcc\x80\xcc\xff\xcd\x00\x00\xcd\x80\x00"
          b"\xcd\xff\xff\xce\x00\x00\x00\x00\xce\x80\x00\x00\x00"
          b"\xce\xff\xff\xff\xff",
          (0,
           128,
           255,
           0,
           32768,
           65535,
           0,
           2147483648,
           4294967295, ), )


def testSignedInt():
    check(b"\x99\xd0\x00\xd0\x80\xd0\xff\xd1\x00\x00\xd1\x80\x00"
          b"\xd1\xff\xff\xd2\x00\x00\x00\x00\xd2\x80\x00\x00\x00"
          b"\xd2\xff\xff\xff\xff", (0,
                                    -128,
                                    -1,
                                    0,
                                    -32768,
                                    -1,
                                    0,
                                    -2147483648,
                                    -1, ))


def testRaw():
    check(b"\x96\xda\x00\x00\xda\x00\x01a\xda\x00\x02ab\xdb\x00\x00"
          b"\x00\x00\xdb\x00\x00\x00\x01a\xdb\x00\x00\x00\x02ab",
          (b"", b"a", b"ab", b"", b"a", b"ab"))


def testArray():
    check(b"\x96\xdc\x00\x00\xdc\x00\x01\xc0\xdc\x00\x02\xc2\xc3\xdd\x00"
          b"\x00\x00\x00\xdd\x00\x00\x00\x01\xc0\xdd\x00\x00\x00\x02"
          b"\xc2\xc3", ((), (None, ), (False, True), (), (None, ),
                        (False, True)))


def testMap():
    check(b"\x96"
          b"\xde\x00\x00"
          b"\xde\x00\x01\xc0\xc2"
          b"\xde\x00\x02\xc0\xc2\xc3\xc2"
          b"\xdf\x00\x00\x00\x00"
          b"\xdf\x00\x00\x00\x01\xc0\xc2"
          b"\xdf\x00\x00\x00\x02\xc0\xc2\xc3\xc2", ({}, {None: False},
                                                    {True: False,
                                                     None: False}, {},
                                                    {None: False},
                                                    {True: False,
                                                     None: False}))
