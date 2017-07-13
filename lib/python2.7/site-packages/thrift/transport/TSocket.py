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

import errno
import logging
import os
import socket
import sys

from .TTransport import TTransportBase, TTransportException, TServerTransportBase

logger = logging.getLogger(__name__)


class TSocketBase(TTransportBase):
    def _resolveAddr(self):
        if self._unix_socket is not None:
            return [(socket.AF_UNIX, socket.SOCK_STREAM, None, None,
                     self._unix_socket)]
        else:
            return socket.getaddrinfo(self.host,
                                      self.port,
                                      self._socket_family,
                                      socket.SOCK_STREAM,
                                      0,
                                      socket.AI_PASSIVE | socket.AI_ADDRCONFIG)

    def close(self):
        if self.handle:
            self.handle.close()
            self.handle = None


class TSocket(TSocketBase):
    """Socket implementation of TTransport base."""

    def __init__(self, host='localhost', port=9090, unix_socket=None, socket_family=socket.AF_UNSPEC):
        """Initialize a TSocket

        @param host(str)  The host to connect to.
        @param port(int)  The (TCP) port to connect to.
        @param unix_socket(str)  The filename of a unix socket to connect to.
                                 (host and port will be ignored.)
        @param socket_family(int)  The socket family to use with this socket.
        """
        self.host = host
        self.port = port
        self.handle = None
        self._unix_socket = unix_socket
        self._timeout = None
        self._socket_family = socket_family

    def setHandle(self, h):
        self.handle = h

    def isOpen(self):
        return self.handle is not None

    def setTimeout(self, ms):
        if ms is None:
            self._timeout = None
        else:
            self._timeout = ms / 1000.0

        if self.handle is not None:
            self.handle.settimeout(self._timeout)

    def _do_open(self, family, socktype):
        return socket.socket(family, socktype)

    @property
    def _address(self):
        return self._unix_socket if self._unix_socket else '%s:%d' % (self.host, self.port)

    def open(self):
        if self.handle:
            raise TTransportException(TTransportException.ALREADY_OPEN)
        try:
            addrs = self._resolveAddr()
        except socket.gaierror:
            msg = 'failed to resolve sockaddr for ' + str(self._address)
            logger.exception(msg)
            raise TTransportException(TTransportException.NOT_OPEN, msg)
        for family, socktype, _, _, sockaddr in addrs:
            handle = self._do_open(family, socktype)
            handle.settimeout(self._timeout)
            try:
                handle.connect(sockaddr)
                self.handle = handle
                return
            except socket.error:
                handle.close()
                logger.info('Could not connect to %s', sockaddr, exc_info=True)
        msg = 'Could not connect to any of %s' % list(map(lambda a: a[4],
                                                          addrs))
        logger.error(msg)
        raise TTransportException(TTransportException.NOT_OPEN, msg)

    def read(self, sz):
        try:
            buff = self.handle.recv(sz)
        except socket.error as e:
            if (e.args[0] == errno.ECONNRESET and
                    (sys.platform == 'darwin' or sys.platform.startswith('freebsd'))):
                # freebsd and Mach don't follow POSIX semantic of recv
                # and fail with ECONNRESET if peer performed shutdown.
                # See corresponding comment and code in TSocket::read()
                # in lib/cpp/src/transport/TSocket.cpp.
                self.close()
                # Trigger the check to raise the END_OF_FILE exception below.
                buff = ''
            else:
                raise
        if len(buff) == 0:
            raise TTransportException(type=TTransportException.END_OF_FILE,
                                      message='TSocket read 0 bytes')
        return buff

    def write(self, buff):
        if not self.handle:
            raise TTransportException(type=TTransportException.NOT_OPEN,
                                      message='Transport not open')
        sent = 0
        have = len(buff)
        while sent < have:
            plus = self.handle.send(buff)
            if plus == 0:
                raise TTransportException(type=TTransportException.END_OF_FILE,
                                          message='TSocket sent 0 bytes')
            sent += plus
            buff = buff[plus:]

    def flush(self):
        pass


class TServerSocket(TSocketBase, TServerTransportBase):
    """Socket implementation of TServerTransport base."""

    def __init__(self, host=None, port=9090, unix_socket=None, socket_family=socket.AF_UNSPEC):
        self.host = host
        self.port = port
        self._unix_socket = unix_socket
        self._socket_family = socket_family
        self.handle = None

    def listen(self):
        res0 = self._resolveAddr()
        socket_family = self._socket_family == socket.AF_UNSPEC and socket.AF_INET6 or self._socket_family
        for res in res0:
            if res[0] is socket_family or res is res0[-1]:
                break

        # We need remove the old unix socket if the file exists and
        # nobody is listening on it.
        if self._unix_socket:
            tmp = socket.socket(res[0], res[1])
            try:
                tmp.connect(res[4])
            except socket.error as err:
                eno, message = err.args
                if eno == errno.ECONNREFUSED:
                    os.unlink(res[4])

        self.handle = socket.socket(res[0], res[1])
        self.handle.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        if hasattr(self.handle, 'settimeout'):
            self.handle.settimeout(None)
        self.handle.bind(res[4])
        self.handle.listen(128)

    def accept(self):
        client, addr = self.handle.accept()
        result = TSocket()
        result.setHandle(client)
        return result
