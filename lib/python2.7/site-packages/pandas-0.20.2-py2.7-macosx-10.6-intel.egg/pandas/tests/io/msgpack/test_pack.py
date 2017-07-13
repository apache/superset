# coding: utf-8

import pytest

import struct

from pandas import compat
from pandas.compat import u, OrderedDict
from pandas.io.msgpack import packb, unpackb, Unpacker, Packer


class TestPack(object):

    def check(self, data, use_list=False):
        re = unpackb(packb(data), use_list=use_list)
        assert re == data

    def testPack(self):
        test_data = [
            0, 1, 127, 128, 255, 256, 65535, 65536,
            -1, -32, -33, -128, -129, -32768, -32769,
            1.0,
            b"", b"a", b"a" * 31, b"a" * 32,
            None, True, False,
            (), ((),), ((), None,),
            {None: 0},
            (1 << 23),
        ]
        for td in test_data:
            self.check(td)

    def testPackUnicode(self):
        test_data = [u(""), u("abcd"), [u("defgh")], u("Русский текст"), ]
        for td in test_data:
            re = unpackb(
                packb(td, encoding='utf-8'), use_list=1, encoding='utf-8')
            assert re == td
            packer = Packer(encoding='utf-8')
            data = packer.pack(td)
            re = Unpacker(
                compat.BytesIO(data), encoding='utf-8', use_list=1).unpack()
            assert re == td

    def testPackUTF32(self):
        test_data = [
            compat.u(""),
            compat.u("abcd"),
            [compat.u("defgh")],
            compat.u("Русский текст"),
        ]
        for td in test_data:
            re = unpackb(
                packb(td, encoding='utf-32'), use_list=1, encoding='utf-32')
            assert re == td

    def testPackBytes(self):
        test_data = [b"", b"abcd", (b"defgh", ), ]
        for td in test_data:
            self.check(td)

    def testIgnoreUnicodeErrors(self):
        re = unpackb(
            packb(b'abc\xeddef'), encoding='utf-8', unicode_errors='ignore',
            use_list=1)
        assert re == "abcdef"

    def testStrictUnicodeUnpack(self):
        pytest.raises(UnicodeDecodeError, unpackb, packb(b'abc\xeddef'),
                      encoding='utf-8', use_list=1)

    def testStrictUnicodePack(self):
        pytest.raises(UnicodeEncodeError, packb, compat.u("abc\xeddef"),
                      encoding='ascii', unicode_errors='strict')

    def testIgnoreErrorsPack(self):
        re = unpackb(
            packb(
                compat.u("abcФФФdef"), encoding='ascii',
                unicode_errors='ignore'), encoding='utf-8', use_list=1)
        assert re == compat.u("abcdef")

    def testNoEncoding(self):
        pytest.raises(TypeError, packb, compat.u("abc"), encoding=None)

    def testDecodeBinary(self):
        re = unpackb(packb("abc"), encoding=None, use_list=1)
        assert re == b"abc"

    def testPackFloat(self):
        assert packb(1.0,
                     use_single_float=True) == b'\xca' + struct.pack('>f', 1.0)
        assert packb(
            1.0, use_single_float=False) == b'\xcb' + struct.pack('>d', 1.0)

    def testArraySize(self, sizes=[0, 5, 50, 1000]):
        bio = compat.BytesIO()
        packer = Packer()
        for size in sizes:
            bio.write(packer.pack_array_header(size))
            for i in range(size):
                bio.write(packer.pack(i))

        bio.seek(0)
        unpacker = Unpacker(bio, use_list=1)
        for size in sizes:
            assert unpacker.unpack() == list(range(size))

    def test_manualreset(self, sizes=[0, 5, 50, 1000]):
        packer = Packer(autoreset=False)
        for size in sizes:
            packer.pack_array_header(size)
            for i in range(size):
                packer.pack(i)

        bio = compat.BytesIO(packer.bytes())
        unpacker = Unpacker(bio, use_list=1)
        for size in sizes:
            assert unpacker.unpack() == list(range(size))

        packer.reset()
        assert packer.bytes() == b''

    def testMapSize(self, sizes=[0, 5, 50, 1000]):
        bio = compat.BytesIO()
        packer = Packer()
        for size in sizes:
            bio.write(packer.pack_map_header(size))
            for i in range(size):
                bio.write(packer.pack(i))  # key
                bio.write(packer.pack(i * 2))  # value

        bio.seek(0)
        unpacker = Unpacker(bio)
        for size in sizes:
            assert unpacker.unpack() == dict((i, i * 2) for i in range(size))

    def test_odict(self):
        seq = [(b'one', 1), (b'two', 2), (b'three', 3), (b'four', 4)]
        od = OrderedDict(seq)
        assert unpackb(packb(od), use_list=1) == dict(seq)

        def pair_hook(seq):
            return list(seq)

        assert unpackb(
            packb(od), object_pairs_hook=pair_hook, use_list=1) == seq

    def test_pairlist(self):
        pairlist = [(b'a', 1), (2, b'b'), (b'foo', b'bar')]
        packer = Packer()
        packed = packer.pack_map_pairs(pairlist)
        unpacked = unpackb(packed, object_pairs_hook=list)
        assert pairlist == unpacked
