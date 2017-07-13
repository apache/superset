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

"""TZlibTransport provides a compressed transport and transport factory
class, using the python standard library zlib module to implement
data compression.
"""

from __future__ import division
import zlib
from .TTransport import TTransportBase, CReadableTransport
from ..compat import BufferIO


class TZlibTransportFactory(object):
    """Factory transport that builds zlib compressed transports.

    This factory caches the last single client/transport that it was passed
    and returns the same TZlibTransport object that was created.

    This caching means the TServer class will get the _same_ transport
    object for both input and output transports from this factory.
    (For non-threaded scenarios only, since the cache only holds one object)

    The purpose of this caching is to allocate only one TZlibTransport where
    only one is really needed (since it must have separate read/write buffers),
    and makes the statistics from getCompSavings() and getCompRatio()
    easier to understand.
    """
    # class scoped cache of last transport given and zlibtransport returned
    _last_trans = None
    _last_z = None

    def getTransport(self, trans, compresslevel=9):
        """Wrap a transport, trans, with the TZlibTransport
        compressed transport class, returning a new
        transport to the caller.

        @param compresslevel: The zlib compression level, ranging
        from 0 (no compression) to 9 (best compression).  Defaults to 9.
        @type compresslevel: int

        This method returns a TZlibTransport which wraps the
        passed C{trans} TTransport derived instance.
        """
        if trans == self._last_trans:
            return self._last_z
        ztrans = TZlibTransport(trans, compresslevel)
        self._last_trans = trans
        self._last_z = ztrans
        return ztrans


class TZlibTransport(TTransportBase, CReadableTransport):
    """Class that wraps a transport with zlib, compressing writes
    and decompresses reads, using the python standard
    library zlib module.
    """
    # Read buffer size for the python fastbinary C extension,
    # the TBinaryProtocolAccelerated class.
    DEFAULT_BUFFSIZE = 4096

    def __init__(self, trans, compresslevel=9):
        """Create a new TZlibTransport, wrapping C{trans}, another
        TTransport derived object.

        @param trans: A thrift transport object, i.e. a TSocket() object.
        @type trans: TTransport
        @param compresslevel: The zlib compression level, ranging
        from 0 (no compression) to 9 (best compression).  Default is 9.
        @type compresslevel: int
        """
        self.__trans = trans
        self.compresslevel = compresslevel
        self.__rbuf = BufferIO()
        self.__wbuf = BufferIO()
        self._init_zlib()
        self._init_stats()

    def _reinit_buffers(self):
        """Internal method to initialize/reset the internal StringIO objects
        for read and write buffers.
        """
        self.__rbuf = BufferIO()
        self.__wbuf = BufferIO()

    def _init_stats(self):
        """Internal method to reset the internal statistics counters
        for compression ratios and bandwidth savings.
        """
        self.bytes_in = 0
        self.bytes_out = 0
        self.bytes_in_comp = 0
        self.bytes_out_comp = 0

    def _init_zlib(self):
        """Internal method for setting up the zlib compression and
        decompression objects.
        """
        self._zcomp_read = zlib.decompressobj()
        self._zcomp_write = zlib.compressobj(self.compresslevel)

    def getCompRatio(self):
        """Get the current measured compression ratios (in,out) from
        this transport.

        Returns a tuple of:
        (inbound_compression_ratio, outbound_compression_ratio)

        The compression ratios are computed as:
            compressed / uncompressed

        E.g., data that compresses by 10x will have a ratio of: 0.10
        and data that compresses to half of ts original size will
        have a ratio of 0.5

        None is returned if no bytes have yet been processed in
        a particular direction.
        """
        r_percent, w_percent = (None, None)
        if self.bytes_in > 0:
            r_percent = self.bytes_in_comp / self.bytes_in
        if self.bytes_out > 0:
            w_percent = self.bytes_out_comp / self.bytes_out
        return (r_percent, w_percent)

    def getCompSavings(self):
        """Get the current count of saved bytes due to data
        compression.

        Returns a tuple of:
        (inbound_saved_bytes, outbound_saved_bytes)

        Note: if compression is actually expanding your
        data (only likely with very tiny thrift objects), then
        the values returned will be negative.
        """
        r_saved = self.bytes_in - self.bytes_in_comp
        w_saved = self.bytes_out - self.bytes_out_comp
        return (r_saved, w_saved)

    def isOpen(self):
        """Return the underlying transport's open status"""
        return self.__trans.isOpen()

    def open(self):
        """Open the underlying transport"""
        self._init_stats()
        return self.__trans.open()

    def listen(self):
        """Invoke the underlying transport's listen() method"""
        self.__trans.listen()

    def accept(self):
        """Accept connections on the underlying transport"""
        return self.__trans.accept()

    def close(self):
        """Close the underlying transport,"""
        self._reinit_buffers()
        self._init_zlib()
        return self.__trans.close()

    def read(self, sz):
        """Read up to sz bytes from the decompressed bytes buffer, and
        read from the underlying transport if the decompression
        buffer is empty.
        """
        ret = self.__rbuf.read(sz)
        if len(ret) > 0:
            return ret
        # keep reading from transport until something comes back
        while True:
            if self.readComp(sz):
                break
        ret = self.__rbuf.read(sz)
        return ret

    def readComp(self, sz):
        """Read compressed data from the underlying transport, then
        decompress it and append it to the internal StringIO read buffer
        """
        zbuf = self.__trans.read(sz)
        zbuf = self._zcomp_read.unconsumed_tail + zbuf
        buf = self._zcomp_read.decompress(zbuf)
        self.bytes_in += len(zbuf)
        self.bytes_in_comp += len(buf)
        old = self.__rbuf.read()
        self.__rbuf = BufferIO(old + buf)
        if len(old) + len(buf) == 0:
            return False
        return True

    def write(self, buf):
        """Write some bytes, putting them into the internal write
        buffer for eventual compression.
        """
        self.__wbuf.write(buf)

    def flush(self):
        """Flush any queued up data in the write buffer and ensure the
        compression buffer is flushed out to the underlying transport
        """
        wout = self.__wbuf.getvalue()
        if len(wout) > 0:
            zbuf = self._zcomp_write.compress(wout)
            self.bytes_out += len(wout)
            self.bytes_out_comp += len(zbuf)
        else:
            zbuf = ''
        ztail = self._zcomp_write.flush(zlib.Z_SYNC_FLUSH)
        self.bytes_out_comp += len(ztail)
        if (len(zbuf) + len(ztail)) > 0:
            self.__wbuf = BufferIO()
            self.__trans.write(zbuf + ztail)
        self.__trans.flush()

    @property
    def cstringio_buf(self):
        """Implement the CReadableTransport interface"""
        return self.__rbuf

    def cstringio_refill(self, partialread, reqlen):
        """Implement the CReadableTransport interface for refill"""
        retstring = partialread
        if reqlen < self.DEFAULT_BUFFSIZE:
            retstring += self.read(self.DEFAULT_BUFFSIZE)
        while len(retstring) < reqlen:
            retstring += self.read(reqlen - len(retstring))
        self.__rbuf = BufferIO(retstring)
        return self.__rbuf
