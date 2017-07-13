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
"""Implementation of non-blocking server.

The main idea of the server is to receive and send requests
only from the main thread.

The thread poool should be sized for concurrent tasks, not
maximum connections
"""

import logging
import select
import socket
import struct
import threading

from six.moves import queue

from thrift.transport import TTransport
from thrift.protocol.TBinaryProtocol import TBinaryProtocolFactory

__all__ = ['TNonblockingServer']

logger = logging.getLogger(__name__)


class Worker(threading.Thread):
    """Worker is a small helper to process incoming connection."""

    def __init__(self, queue):
        threading.Thread.__init__(self)
        self.queue = queue

    def run(self):
        """Process queries from task queue, stop if processor is None."""
        while True:
            try:
                processor, iprot, oprot, otrans, callback = self.queue.get()
                if processor is None:
                    break
                processor.process(iprot, oprot)
                callback(True, otrans.getvalue())
            except Exception:
                logger.exception("Exception while processing request")
                callback(False, b'')

WAIT_LEN = 0
WAIT_MESSAGE = 1
WAIT_PROCESS = 2
SEND_ANSWER = 3
CLOSED = 4


def locked(func):
    """Decorator which locks self.lock."""
    def nested(self, *args, **kwargs):
        self.lock.acquire()
        try:
            return func(self, *args, **kwargs)
        finally:
            self.lock.release()
    return nested


def socket_exception(func):
    """Decorator close object on socket.error."""
    def read(self, *args, **kwargs):
        try:
            return func(self, *args, **kwargs)
        except socket.error:
            self.close()
    return read


class Connection(object):
    """Basic class is represented connection.

    It can be in state:
        WAIT_LEN --- connection is reading request len.
        WAIT_MESSAGE --- connection is reading request.
        WAIT_PROCESS --- connection has just read whole request and
                         waits for call ready routine.
        SEND_ANSWER --- connection is sending answer string (including length
                        of answer).
        CLOSED --- socket was closed and connection should be deleted.
    """
    def __init__(self, new_socket, wake_up):
        self.socket = new_socket
        self.socket.setblocking(False)
        self.status = WAIT_LEN
        self.len = 0
        self.message = b''
        self.lock = threading.Lock()
        self.wake_up = wake_up

    def _read_len(self):
        """Reads length of request.

        It's a safer alternative to self.socket.recv(4)
        """
        read = self.socket.recv(4 - len(self.message))
        if len(read) == 0:
            # if we read 0 bytes and self.message is empty, then
            # the client closed the connection
            if len(self.message) != 0:
                logger.error("can't read frame size from socket")
            self.close()
            return
        self.message += read
        if len(self.message) == 4:
            self.len, = struct.unpack('!i', self.message)
            if self.len < 0:
                logger.error("negative frame size, it seems client "
                             "doesn't use FramedTransport")
                self.close()
            elif self.len == 0:
                logger.error("empty frame, it's really strange")
                self.close()
            else:
                self.message = b''
                self.status = WAIT_MESSAGE

    @socket_exception
    def read(self):
        """Reads data from stream and switch state."""
        assert self.status in (WAIT_LEN, WAIT_MESSAGE)
        if self.status == WAIT_LEN:
            self._read_len()
            # go back to the main loop here for simplicity instead of
            # falling through, even though there is a good chance that
            # the message is already available
        elif self.status == WAIT_MESSAGE:
            read = self.socket.recv(self.len - len(self.message))
            if len(read) == 0:
                logger.error("can't read frame from socket (get %d of "
                             "%d bytes)" % (len(self.message), self.len))
                self.close()
                return
            self.message += read
            if len(self.message) == self.len:
                self.status = WAIT_PROCESS

    @socket_exception
    def write(self):
        """Writes data from socket and switch state."""
        assert self.status == SEND_ANSWER
        sent = self.socket.send(self.message)
        if sent == len(self.message):
            self.status = WAIT_LEN
            self.message = b''
            self.len = 0
        else:
            self.message = self.message[sent:]

    @locked
    def ready(self, all_ok, message):
        """Callback function for switching state and waking up main thread.

        This function is the only function witch can be called asynchronous.

        The ready can switch Connection to three states:
            WAIT_LEN if request was oneway.
            SEND_ANSWER if request was processed in normal way.
            CLOSED if request throws unexpected exception.

        The one wakes up main thread.
        """
        assert self.status == WAIT_PROCESS
        if not all_ok:
            self.close()
            self.wake_up()
            return
        self.len = 0
        if len(message) == 0:
            # it was a oneway request, do not write answer
            self.message = b''
            self.status = WAIT_LEN
        else:
            self.message = struct.pack('!i', len(message)) + message
            self.status = SEND_ANSWER
        self.wake_up()

    @locked
    def is_writeable(self):
        """Return True if connection should be added to write list of select"""
        return self.status == SEND_ANSWER

    # it's not necessary, but...
    @locked
    def is_readable(self):
        """Return True if connection should be added to read list of select"""
        return self.status in (WAIT_LEN, WAIT_MESSAGE)

    @locked
    def is_closed(self):
        """Returns True if connection is closed."""
        return self.status == CLOSED

    def fileno(self):
        """Returns the file descriptor of the associated socket."""
        return self.socket.fileno()

    def close(self):
        """Closes connection"""
        self.status = CLOSED
        self.socket.close()


class TNonblockingServer(object):
    """Non-blocking server."""

    def __init__(self,
                 processor,
                 lsocket,
                 inputProtocolFactory=None,
                 outputProtocolFactory=None,
                 threads=10):
        self.processor = processor
        self.socket = lsocket
        self.in_protocol = inputProtocolFactory or TBinaryProtocolFactory()
        self.out_protocol = outputProtocolFactory or self.in_protocol
        self.threads = int(threads)
        self.clients = {}
        self.tasks = queue.Queue()
        self._read, self._write = socket.socketpair()
        self.prepared = False
        self._stop = False

    def setNumThreads(self, num):
        """Set the number of worker threads that should be created."""
        # implement ThreadPool interface
        assert not self.prepared, "Can't change number of threads after start"
        self.threads = num

    def prepare(self):
        """Prepares server for serve requests."""
        if self.prepared:
            return
        self.socket.listen()
        for _ in range(self.threads):
            thread = Worker(self.tasks)
            thread.setDaemon(True)
            thread.start()
        self.prepared = True

    def wake_up(self):
        """Wake up main thread.

        The server usually waits in select call in we should terminate one.
        The simplest way is using socketpair.

        Select always wait to read from the first socket of socketpair.

        In this case, we can just write anything to the second socket from
        socketpair.
        """
        self._write.send(b'1')

    def stop(self):
        """Stop the server.

        This method causes the serve() method to return.  stop() may be invoked
        from within your handler, or from another thread.

        After stop() is called, serve() will return but the server will still
        be listening on the socket.  serve() may then be called again to resume
        processing requests.  Alternatively, close() may be called after
        serve() returns to close the server socket and shutdown all worker
        threads.
        """
        self._stop = True
        self.wake_up()

    def _select(self):
        """Does select on open connections."""
        readable = [self.socket.handle.fileno(), self._read.fileno()]
        writable = []
        for i, connection in list(self.clients.items()):
            if connection.is_readable():
                readable.append(connection.fileno())
            if connection.is_writeable():
                writable.append(connection.fileno())
            if connection.is_closed():
                del self.clients[i]
        return select.select(readable, writable, readable)

    def handle(self):
        """Handle requests.

        WARNING! You must call prepare() BEFORE calling handle()
        """
        assert self.prepared, "You have to call prepare before handle"
        rset, wset, xset = self._select()
        for readable in rset:
            if readable == self._read.fileno():
                # don't care i just need to clean readable flag
                self._read.recv(1024)
            elif readable == self.socket.handle.fileno():
                client = self.socket.accept().handle
                self.clients[client.fileno()] = Connection(client,
                                                           self.wake_up)
            else:
                connection = self.clients[readable]
                connection.read()
                if connection.status == WAIT_PROCESS:
                    itransport = TTransport.TMemoryBuffer(connection.message)
                    otransport = TTransport.TMemoryBuffer()
                    iprot = self.in_protocol.getProtocol(itransport)
                    oprot = self.out_protocol.getProtocol(otransport)
                    self.tasks.put([self.processor, iprot, oprot,
                                    otransport, connection.ready])
        for writeable in wset:
            self.clients[writeable].write()
        for oob in xset:
            self.clients[oob].close()
            del self.clients[oob]

    def close(self):
        """Closes the server."""
        for _ in range(self.threads):
            self.tasks.put([None, None, None, None, None])
        self.socket.close()
        self.prepared = False

    def serve(self):
        """Serve requests.

        Serve requests forever, or until stop() is called.
        """
        self._stop = False
        self.prepare()
        while not self._stop:
            self.handle()
