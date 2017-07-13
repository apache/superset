#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

from .TProtocol import TType, TProtocolBase, TProtocolException, checkIntegerLimits
from struct import pack, unpack

from ..compat import binary_to_str, str_to_binary

__all__ = ['TCompactProtocol', 'TCompactProtocolFactory']

CLEAR = 0
FIELD_WRITE = 1
VALUE_WRITE = 2
CONTAINER_WRITE = 3
BOOL_WRITE = 4
FIELD_READ = 5
CONTAINER_READ = 6
VALUE_READ = 7
BOOL_READ = 8


def make_helper(v_from, container):
    def helper(func):
        def nested(self, *args, **kwargs):
            assert self.state in (v_from, container), (self.state, v_from, container)
            return func(self, *args, **kwargs)
        return nested
    return helper
writer = make_helper(VALUE_WRITE, CONTAINER_WRITE)
reader = make_helper(VALUE_READ, CONTAINER_READ)


def makeZigZag(n, bits):
    checkIntegerLimits(n, bits)
    return (n << 1) ^ (n >> (bits - 1))


def fromZigZag(n):
    return (n >> 1) ^ -(n & 1)


def writeVarint(trans, n):
    out = bytearray()
    while True:
        if n & ~0x7f == 0:
            out.append(n)
            break
        else:
            out.append((n & 0xff) | 0x80)
            n = n >> 7
    trans.write(bytes(out))


def readVarint(trans):
    result = 0
    shift = 0
    while True:
        x = trans.readAll(1)
        byte = ord(x)
        result |= (byte & 0x7f) << shift
        if byte >> 7 == 0:
            return result
        shift += 7


class CompactType(object):
    STOP = 0x00
    TRUE = 0x01
    FALSE = 0x02
    BYTE = 0x03
    I16 = 0x04
    I32 = 0x05
    I64 = 0x06
    DOUBLE = 0x07
    BINARY = 0x08
    LIST = 0x09
    SET = 0x0A
    MAP = 0x0B
    STRUCT = 0x0C

CTYPES = {
    TType.STOP: CompactType.STOP,
    TType.BOOL: CompactType.TRUE,  # used for collection
    TType.BYTE: CompactType.BYTE,
    TType.I16: CompactType.I16,
    TType.I32: CompactType.I32,
    TType.I64: CompactType.I64,
    TType.DOUBLE: CompactType.DOUBLE,
    TType.STRING: CompactType.BINARY,
    TType.STRUCT: CompactType.STRUCT,
    TType.LIST: CompactType.LIST,
    TType.SET: CompactType.SET,
    TType.MAP: CompactType.MAP,
}

TTYPES = {}
for k, v in CTYPES.items():
    TTYPES[v] = k
TTYPES[CompactType.FALSE] = TType.BOOL
del k
del v


class TCompactProtocol(TProtocolBase):
    """Compact implementation of the Thrift protocol driver."""

    PROTOCOL_ID = 0x82
    VERSION = 1
    VERSION_MASK = 0x1f
    TYPE_MASK = 0xe0
    TYPE_BITS = 0x07
    TYPE_SHIFT_AMOUNT = 5

    def __init__(self, trans,
                 string_length_limit=None,
                 container_length_limit=None):
        TProtocolBase.__init__(self, trans)
        self.state = CLEAR
        self.__last_fid = 0
        self.__bool_fid = None
        self.__bool_value = None
        self.__structs = []
        self.__containers = []
        self.string_length_limit = string_length_limit
        self.container_length_limit = container_length_limit

    def _check_string_length(self, length):
        self._check_length(self.string_length_limit, length)

    def _check_container_length(self, length):
        self._check_length(self.container_length_limit, length)

    def __writeVarint(self, n):
        writeVarint(self.trans, n)

    def writeMessageBegin(self, name, type, seqid):
        assert self.state == CLEAR
        self.__writeUByte(self.PROTOCOL_ID)
        self.__writeUByte(self.VERSION | (type << self.TYPE_SHIFT_AMOUNT))
        self.__writeVarint(seqid)
        self.__writeBinary(str_to_binary(name))
        self.state = VALUE_WRITE

    def writeMessageEnd(self):
        assert self.state == VALUE_WRITE
        self.state = CLEAR

    def writeStructBegin(self, name):
        assert self.state in (CLEAR, CONTAINER_WRITE, VALUE_WRITE), self.state
        self.__structs.append((self.state, self.__last_fid))
        self.state = FIELD_WRITE
        self.__last_fid = 0

    def writeStructEnd(self):
        assert self.state == FIELD_WRITE
        self.state, self.__last_fid = self.__structs.pop()

    def writeFieldStop(self):
        self.__writeByte(0)

    def __writeFieldHeader(self, type, fid):
        delta = fid - self.__last_fid
        if 0 < delta <= 15:
            self.__writeUByte(delta << 4 | type)
        else:
            self.__writeByte(type)
            self.__writeI16(fid)
        self.__last_fid = fid

    def writeFieldBegin(self, name, type, fid):
        assert self.state == FIELD_WRITE, self.state
        if type == TType.BOOL:
            self.state = BOOL_WRITE
            self.__bool_fid = fid
        else:
            self.state = VALUE_WRITE
            self.__writeFieldHeader(CTYPES[type], fid)

    def writeFieldEnd(self):
        assert self.state in (VALUE_WRITE, BOOL_WRITE), self.state
        self.state = FIELD_WRITE

    def __writeUByte(self, byte):
        self.trans.write(pack('!B', byte))

    def __writeByte(self, byte):
        self.trans.write(pack('!b', byte))

    def __writeI16(self, i16):
        self.__writeVarint(makeZigZag(i16, 16))

    def __writeSize(self, i32):
        self.__writeVarint(i32)

    def writeCollectionBegin(self, etype, size):
        assert self.state in (VALUE_WRITE, CONTAINER_WRITE), self.state
        if size <= 14:
            self.__writeUByte(size << 4 | CTYPES[etype])
        else:
            self.__writeUByte(0xf0 | CTYPES[etype])
            self.__writeSize(size)
        self.__containers.append(self.state)
        self.state = CONTAINER_WRITE
    writeSetBegin = writeCollectionBegin
    writeListBegin = writeCollectionBegin

    def writeMapBegin(self, ktype, vtype, size):
        assert self.state in (VALUE_WRITE, CONTAINER_WRITE), self.state
        if size == 0:
            self.__writeByte(0)
        else:
            self.__writeSize(size)
            self.__writeUByte(CTYPES[ktype] << 4 | CTYPES[vtype])
        self.__containers.append(self.state)
        self.state = CONTAINER_WRITE

    def writeCollectionEnd(self):
        assert self.state == CONTAINER_WRITE, self.state
        self.state = self.__containers.pop()
    writeMapEnd = writeCollectionEnd
    writeSetEnd = writeCollectionEnd
    writeListEnd = writeCollectionEnd

    def writeBool(self, bool):
        if self.state == BOOL_WRITE:
            if bool:
                ctype = CompactType.TRUE
            else:
                ctype = CompactType.FALSE
            self.__writeFieldHeader(ctype, self.__bool_fid)
        elif self.state == CONTAINER_WRITE:
            if bool:
                self.__writeByte(CompactType.TRUE)
            else:
                self.__writeByte(CompactType.FALSE)
        else:
            raise AssertionError("Invalid state in compact protocol")

    writeByte = writer(__writeByte)
    writeI16 = writer(__writeI16)

    @writer
    def writeI32(self, i32):
        self.__writeVarint(makeZigZag(i32, 32))

    @writer
    def writeI64(self, i64):
        self.__writeVarint(makeZigZag(i64, 64))

    @writer
    def writeDouble(self, dub):
        self.trans.write(pack('<d', dub))

    def __writeBinary(self, s):
        self.__writeSize(len(s))
        self.trans.write(s)
    writeBinary = writer(__writeBinary)

    def readFieldBegin(self):
        assert self.state == FIELD_READ, self.state
        type = self.__readUByte()
        if type & 0x0f == TType.STOP:
            return (None, 0, 0)
        delta = type >> 4
        if delta == 0:
            fid = self.__readI16()
        else:
            fid = self.__last_fid + delta
        self.__last_fid = fid
        type = type & 0x0f
        if type == CompactType.TRUE:
            self.state = BOOL_READ
            self.__bool_value = True
        elif type == CompactType.FALSE:
            self.state = BOOL_READ
            self.__bool_value = False
        else:
            self.state = VALUE_READ
        return (None, self.__getTType(type), fid)

    def readFieldEnd(self):
        assert self.state in (VALUE_READ, BOOL_READ), self.state
        self.state = FIELD_READ

    def __readUByte(self):
        result, = unpack('!B', self.trans.readAll(1))
        return result

    def __readByte(self):
        result, = unpack('!b', self.trans.readAll(1))
        return result

    def __readVarint(self):
        return readVarint(self.trans)

    def __readZigZag(self):
        return fromZigZag(self.__readVarint())

    def __readSize(self):
        result = self.__readVarint()
        if result < 0:
            raise TProtocolException("Length < 0")
        return result

    def readMessageBegin(self):
        assert self.state == CLEAR
        proto_id = self.__readUByte()
        if proto_id != self.PROTOCOL_ID:
            raise TProtocolException(TProtocolException.BAD_VERSION,
                                     'Bad protocol id in the message: %d' % proto_id)
        ver_type = self.__readUByte()
        type = (ver_type >> self.TYPE_SHIFT_AMOUNT) & self.TYPE_BITS
        version = ver_type & self.VERSION_MASK
        if version != self.VERSION:
            raise TProtocolException(TProtocolException.BAD_VERSION,
                                     'Bad version: %d (expect %d)' % (version, self.VERSION))
        seqid = self.__readVarint()
        name = binary_to_str(self.__readBinary())
        return (name, type, seqid)

    def readMessageEnd(self):
        assert self.state == CLEAR
        assert len(self.__structs) == 0

    def readStructBegin(self):
        assert self.state in (CLEAR, CONTAINER_READ, VALUE_READ), self.state
        self.__structs.append((self.state, self.__last_fid))
        self.state = FIELD_READ
        self.__last_fid = 0

    def readStructEnd(self):
        assert self.state == FIELD_READ
        self.state, self.__last_fid = self.__structs.pop()

    def readCollectionBegin(self):
        assert self.state in (VALUE_READ, CONTAINER_READ), self.state
        size_type = self.__readUByte()
        size = size_type >> 4
        type = self.__getTType(size_type)
        if size == 15:
            size = self.__readSize()
        self._check_container_length(size)
        self.__containers.append(self.state)
        self.state = CONTAINER_READ
        return type, size
    readSetBegin = readCollectionBegin
    readListBegin = readCollectionBegin

    def readMapBegin(self):
        assert self.state in (VALUE_READ, CONTAINER_READ), self.state
        size = self.__readSize()
        self._check_container_length(size)
        types = 0
        if size > 0:
            types = self.__readUByte()
        vtype = self.__getTType(types)
        ktype = self.__getTType(types >> 4)
        self.__containers.append(self.state)
        self.state = CONTAINER_READ
        return (ktype, vtype, size)

    def readCollectionEnd(self):
        assert self.state == CONTAINER_READ, self.state
        self.state = self.__containers.pop()
    readSetEnd = readCollectionEnd
    readListEnd = readCollectionEnd
    readMapEnd = readCollectionEnd

    def readBool(self):
        if self.state == BOOL_READ:
            return self.__bool_value == CompactType.TRUE
        elif self.state == CONTAINER_READ:
            return self.__readByte() == CompactType.TRUE
        else:
            raise AssertionError("Invalid state in compact protocol: %d" %
                                 self.state)

    readByte = reader(__readByte)
    __readI16 = __readZigZag
    readI16 = reader(__readZigZag)
    readI32 = reader(__readZigZag)
    readI64 = reader(__readZigZag)

    @reader
    def readDouble(self):
        buff = self.trans.readAll(8)
        val, = unpack('<d', buff)
        return val

    def __readBinary(self):
        size = self.__readSize()
        self._check_string_length(size)
        return self.trans.readAll(size)
    readBinary = reader(__readBinary)

    def __getTType(self, byte):
        return TTYPES[byte & 0x0f]


class TCompactProtocolFactory(object):
    def __init__(self,
                 string_length_limit=None,
                 container_length_limit=None):
        self.string_length_limit = string_length_limit
        self.container_length_limit = container_length_limit

    def getProtocol(self, trans):
        return TCompactProtocol(trans,
                                self.string_length_limit,
                                self.container_length_limit)


class TCompactProtocolAccelerated(TCompactProtocol):
    """C-Accelerated version of TCompactProtocol.

    This class does not override any of TCompactProtocol's methods,
    but the generated code recognizes it directly and will call into
    our C module to do the encoding, bypassing this object entirely.
    We inherit from TCompactProtocol so that the normal TCompactProtocol
    encoding can happen if the fastbinary module doesn't work for some
    reason.
    To disable this behavior, pass fallback=False constructor argument.

    In order to take advantage of the C module, just use
    TCompactProtocolAccelerated instead of TCompactProtocol.
    """
    pass

    def __init__(self, *args, **kwargs):
        fallback = kwargs.pop('fallback', True)
        super(TCompactProtocolAccelerated, self).__init__(*args, **kwargs)
        try:
            from thrift.protocol import fastbinary
        except ImportError:
            if not fallback:
                raise
        else:
            self._fast_decode = fastbinary.decode_compact
            self._fast_encode = fastbinary.encode_compact


class TCompactProtocolAcceleratedFactory(object):
    def __init__(self,
                 string_length_limit=None,
                 container_length_limit=None,
                 fallback=True):
        self.string_length_limit = string_length_limit
        self.container_length_limit = container_length_limit
        self._fallback = fallback

    def getProtocol(self, trans):
        return TCompactProtocolAccelerated(
            trans,
            string_length_limit=self.string_length_limit,
            container_length_limit=self.container_length_limit,
            fallback=self._fallback)
