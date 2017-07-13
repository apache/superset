# coding: utf-8

import io
import pandas.io.msgpack as msgpack

binarydata = bytes(bytearray(range(256)))


def gen_binary_data(idx):
    return binarydata[:idx % 300]


def test_exceeding_unpacker_read_size():
    dumpf = io.BytesIO()

    packer = msgpack.Packer()

    NUMBER_OF_STRINGS = 6
    read_size = 16

    # 5 ok for read_size=16, while 6 glibc detected *** python: double free or
    # corruption (fasttop):

    # 20 ok for read_size=256, while 25 segfaults / glibc detected *** python:
    # double free or corruption (!prev)

    # 40 ok for read_size=1024, while 50 introduces errors
    # 7000 ok for read_size=1024*1024, while 8000 leads to  glibc detected ***
    # python: double free or corruption (!prev):

    for idx in range(NUMBER_OF_STRINGS):
        data = gen_binary_data(idx)
        dumpf.write(packer.pack(data))

    f = io.BytesIO(dumpf.getvalue())
    dumpf.close()

    unpacker = msgpack.Unpacker(f, read_size=read_size, use_list=1)

    read_count = 0
    for idx, o in enumerate(unpacker):
        assert type(o) == bytes
        assert o == gen_binary_data(idx)
        read_count += 1

    assert read_count == NUMBER_OF_STRINGS
