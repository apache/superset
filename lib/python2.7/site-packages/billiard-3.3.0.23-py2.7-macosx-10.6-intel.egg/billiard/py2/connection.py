#
# A higher level module for using sockets (or Windows named pipes)
#
# multiprocessing/connection.py
#
# Copyright (c) 2006-2008, R Oudkerk
# Licensed to PSF under a Contributor Agreement.
#

from __future__ import absolute_import

import os
import random
import sys
import socket
import string
import errno
import time
import tempfile
import itertools

from .. import AuthenticationError
from .. import reduction
from .._ext import _billiard, win32
from ..compat import get_errno, setblocking, bytes as cbytes
from ..five import monotonic
from ..forking import duplicate, close
from ..reduction import ForkingPickler
from ..util import get_temp_dir, Finalize, sub_debug, debug

try:
    WindowsError = WindowsError  # noqa
except NameError:
    WindowsError = None  # noqa

__all__ = ['Client', 'Listener', 'Pipe']

# global set later
xmlrpclib = None

Connection = getattr(_billiard, 'Connection', None)
PipeConnection = getattr(_billiard, 'PipeConnection', None)


#
#
#

BUFSIZE = 8192
# A very generous timeout when it comes to local connections...
CONNECTION_TIMEOUT = 20.

_mmap_counter = itertools.count()

default_family = 'AF_INET'
families = ['AF_INET']

if hasattr(socket, 'AF_UNIX'):
    default_family = 'AF_UNIX'
    families += ['AF_UNIX']

if sys.platform == 'win32':
    default_family = 'AF_PIPE'
    families += ['AF_PIPE']


def _init_timeout(timeout=CONNECTION_TIMEOUT):
    return monotonic() + timeout


def _check_timeout(t):
    return monotonic() > t

#
#
#


def arbitrary_address(family):
    '''
    Return an arbitrary free address for the given family
    '''
    if family == 'AF_INET':
        return ('localhost', 0)
    elif family == 'AF_UNIX':
        return tempfile.mktemp(prefix='listener-', dir=get_temp_dir())
    elif family == 'AF_PIPE':
        randomchars = ''.join(
            random.choice(string.ascii_lowercase + string.digits)
            for i in range(6)
        )
        return r'\\.\pipe\pyc-%d-%d-%s' % (
            os.getpid(), next(_mmap_counter), randomchars
        )
    else:
        raise ValueError('unrecognized family')


def address_type(address):
    '''
    Return the types of the address

    This can be 'AF_INET', 'AF_UNIX', or 'AF_PIPE'
    '''
    if type(address) == tuple:
        return 'AF_INET'
    elif type(address) is str and address.startswith('\\\\'):
        return 'AF_PIPE'
    elif type(address) is str:
        return 'AF_UNIX'
    else:
        raise ValueError('address type of %r unrecognized' % address)

#
# Public functions
#


class Listener(object):
    '''
    Returns a listener object.

    This is a wrapper for a bound socket which is 'listening' for
    connections, or for a Windows named pipe.
    '''
    def __init__(self, address=None, family=None, backlog=1, authkey=None):
        family = (family or
                  (address and address_type(address)) or
                  default_family)
        address = address or arbitrary_address(family)

        if family == 'AF_PIPE':
            self._listener = PipeListener(address, backlog)
        else:
            self._listener = SocketListener(address, family, backlog)

        if authkey is not None and not isinstance(authkey, bytes):
            raise TypeError('authkey should be a byte string')

        self._authkey = authkey

    def accept(self):
        '''
        Accept a connection on the bound socket or named pipe of `self`.

        Returns a `Connection` object.
        '''
        if self._listener is None:
            raise IOError('listener is closed')
        c = self._listener.accept()
        if self._authkey:
            deliver_challenge(c, self._authkey)
            answer_challenge(c, self._authkey)
        return c

    def close(self):
        '''
        Close the bound socket or named pipe of `self`.
        '''
        if self._listener is not None:
            self._listener.close()
            self._listener = None

    address = property(lambda self: self._listener._address)
    last_accepted = property(lambda self: self._listener._last_accepted)

    def __enter__(self):
        return self

    def __exit__(self, *exc_args):
        self.close()


def Client(address, family=None, authkey=None):
    '''
    Returns a connection to the address of a `Listener`
    '''
    family = family or address_type(address)
    if family == 'AF_PIPE':
        c = PipeClient(address)
    else:
        c = SocketClient(address)

    if authkey is not None and not isinstance(authkey, bytes):
        raise TypeError('authkey should be a byte string')

    if authkey is not None:
        answer_challenge(c, authkey)
        deliver_challenge(c, authkey)

    return c


if sys.platform != 'win32':

    def Pipe(duplex=True, rnonblock=False, wnonblock=False):
        '''
        Returns pair of connection objects at either end of a pipe
        '''
        if duplex:
            s1, s2 = socket.socketpair()
            s1.setblocking(not rnonblock)
            s2.setblocking(not wnonblock)
            c1 = Connection(os.dup(s1.fileno()))
            c2 = Connection(os.dup(s2.fileno()))
            s1.close()
            s2.close()
        else:
            fd1, fd2 = os.pipe()
            if rnonblock:
                setblocking(fd1, 0)
            if wnonblock:
                setblocking(fd2, 0)
            c1 = Connection(fd1, writable=False)
            c2 = Connection(fd2, readable=False)

        return c1, c2

else:

    def Pipe(duplex=True, rnonblock=False, wnonblock=False):  # noqa
        '''
        Returns pair of connection objects at either end of a pipe
        '''
        address = arbitrary_address('AF_PIPE')
        if duplex:
            openmode = win32.PIPE_ACCESS_DUPLEX
            access = win32.GENERIC_READ | win32.GENERIC_WRITE
            obsize, ibsize = BUFSIZE, BUFSIZE
        else:
            openmode = win32.PIPE_ACCESS_INBOUND
            access = win32.GENERIC_WRITE
            obsize, ibsize = 0, BUFSIZE

        h1 = win32.CreateNamedPipe(
            address, openmode,
            win32.PIPE_TYPE_MESSAGE | win32.PIPE_READMODE_MESSAGE |
            win32.PIPE_WAIT,
            1, obsize, ibsize, win32.NMPWAIT_WAIT_FOREVER, win32.NULL
        )
        h2 = win32.CreateFile(
            address, access, 0, win32.NULL, win32.OPEN_EXISTING, 0, win32.NULL
        )
        win32.SetNamedPipeHandleState(
            h2, win32.PIPE_READMODE_MESSAGE, None, None
        )

        try:
            win32.ConnectNamedPipe(h1, win32.NULL)
        except WindowsError as exc:
            if exc.args[0] != win32.ERROR_PIPE_CONNECTED:
                raise

        c1 = PipeConnection(h1, writable=duplex)
        c2 = PipeConnection(h2, readable=duplex)

        return c1, c2

#
# Definitions for connections based on sockets
#


class SocketListener(object):
    '''
    Representation of a socket which is bound to an address and listening
    '''
    def __init__(self, address, family, backlog=1):
        self._socket = socket.socket(getattr(socket, family))
        try:
            # SO_REUSEADDR has different semantics on Windows (Issue #2550).
            if os.name == 'posix':
                self._socket.setsockopt(socket.SOL_SOCKET,
                                        socket.SO_REUSEADDR, 1)
            self._socket.bind(address)
            self._socket.listen(backlog)
            self._address = self._socket.getsockname()
        except OSError:
            self._socket.close()
            raise
        self._family = family
        self._last_accepted = None

        if family == 'AF_UNIX':
            self._unlink = Finalize(
                self, os.unlink, args=(address,), exitpriority=0
            )
        else:
            self._unlink = None

    def accept(self):
        s, self._last_accepted = self._socket.accept()
        fd = duplicate(s.fileno())
        conn = Connection(fd)
        s.close()
        return conn

    def close(self):
        self._socket.close()
        if self._unlink is not None:
            self._unlink()


def SocketClient(address):
    '''
    Return a connection object connected to the socket given by `address`
    '''
    family = address_type(address)
    s = socket.socket(getattr(socket, family))
    t = _init_timeout()

    while 1:
        try:
            s.connect(address)
        except socket.error as exc:
            if get_errno(exc) != errno.ECONNREFUSED or _check_timeout(t):
                debug('failed to connect to address %s', address)
                raise
            time.sleep(0.01)
        else:
            break
    else:
        raise

    fd = duplicate(s.fileno())
    conn = Connection(fd)
    s.close()
    return conn

#
# Definitions for connections based on named pipes
#

if sys.platform == 'win32':

    class PipeListener(object):
        '''
        Representation of a named pipe
        '''
        def __init__(self, address, backlog=None):
            self._address = address
            handle = win32.CreateNamedPipe(
                address, win32.PIPE_ACCESS_DUPLEX,
                win32.PIPE_TYPE_MESSAGE | win32.PIPE_READMODE_MESSAGE |
                win32.PIPE_WAIT,
                win32.PIPE_UNLIMITED_INSTANCES, BUFSIZE, BUFSIZE,
                win32.NMPWAIT_WAIT_FOREVER, win32.NULL
            )
            self._handle_queue = [handle]
            self._last_accepted = None

            sub_debug('listener created with address=%r', self._address)

            self.close = Finalize(
                self, PipeListener._finalize_pipe_listener,
                args=(self._handle_queue, self._address), exitpriority=0
            )

        def accept(self):
            newhandle = win32.CreateNamedPipe(
                self._address, win32.PIPE_ACCESS_DUPLEX,
                win32.PIPE_TYPE_MESSAGE | win32.PIPE_READMODE_MESSAGE |
                win32.PIPE_WAIT,
                win32.PIPE_UNLIMITED_INSTANCES, BUFSIZE, BUFSIZE,
                win32.NMPWAIT_WAIT_FOREVER, win32.NULL
            )
            self._handle_queue.append(newhandle)
            handle = self._handle_queue.pop(0)
            try:
                win32.ConnectNamedPipe(handle, win32.NULL)
            except WindowsError as exc:
                if exc.args[0] != win32.ERROR_PIPE_CONNECTED:
                    raise
            return PipeConnection(handle)

        @staticmethod
        def _finalize_pipe_listener(queue, address):
            sub_debug('closing listener with address=%r', address)
            for handle in queue:
                close(handle)

    def PipeClient(address):
        '''
        Return a connection object connected to the pipe given by `address`
        '''
        t = _init_timeout()
        while 1:
            try:
                win32.WaitNamedPipe(address, 1000)
                h = win32.CreateFile(
                    address, win32.GENERIC_READ | win32.GENERIC_WRITE,
                    0, win32.NULL, win32.OPEN_EXISTING, 0, win32.NULL,
                )
            except WindowsError as exc:
                if exc.args[0] not in (
                        win32.ERROR_SEM_TIMEOUT,
                        win32.ERROR_PIPE_BUSY) or _check_timeout(t):
                    raise
            else:
                break
        else:
            raise

        win32.SetNamedPipeHandleState(
            h, win32.PIPE_READMODE_MESSAGE, None, None
        )
        return PipeConnection(h)

#
# Authentication stuff
#

MESSAGE_LENGTH = 20

CHALLENGE = cbytes('#CHALLENGE#', 'ascii')
WELCOME = cbytes('#WELCOME#', 'ascii')
FAILURE = cbytes('#FAILURE#', 'ascii')


def deliver_challenge(connection, authkey):
    import hmac
    assert isinstance(authkey, bytes)
    message = os.urandom(MESSAGE_LENGTH)
    connection.send_bytes(CHALLENGE + message)
    digest = hmac.new(authkey, message).digest()
    response = connection.recv_bytes(256)        # reject large message
    if response == digest:
        connection.send_bytes(WELCOME)
    else:
        connection.send_bytes(FAILURE)
        raise AuthenticationError('digest received was wrong')


def answer_challenge(connection, authkey):
    import hmac
    assert isinstance(authkey, bytes)
    message = connection.recv_bytes(256)         # reject large message
    assert message[:len(CHALLENGE)] == CHALLENGE, 'message = %r' % message
    message = message[len(CHALLENGE):]
    digest = hmac.new(authkey, message).digest()
    connection.send_bytes(digest)
    response = connection.recv_bytes(256)        # reject large message
    if response != WELCOME:
        raise AuthenticationError('digest sent was rejected')

#
# Support for using xmlrpclib for serialization
#


class ConnectionWrapper(object):
    def __init__(self, conn, dumps, loads):
        self._conn = conn
        self._dumps = dumps
        self._loads = loads
        for attr in ('fileno', 'close', 'poll', 'recv_bytes', 'send_bytes'):
            obj = getattr(conn, attr)
            setattr(self, attr, obj)

    def send(self, obj):
        s = self._dumps(obj)
        self._conn.send_bytes(s)

    def recv(self):
        s = self._conn.recv_bytes()
        return self._loads(s)


def _xml_dumps(obj):
    return xmlrpclib.dumps((obj,), None, None, None, 1).encode('utf8')


def _xml_loads(s):
    (obj,), method = xmlrpclib.loads(s.decode('utf8'))
    return obj


class XmlListener(Listener):
    def accept(self):
        global xmlrpclib
        import xmlrpclib  # noqa
        obj = Listener.accept(self)
        return ConnectionWrapper(obj, _xml_dumps, _xml_loads)


def XmlClient(*args, **kwds):
    global xmlrpclib
    import xmlrpclib  # noqa
    return ConnectionWrapper(Client(*args, **kwds), _xml_dumps, _xml_loads)


if sys.platform == 'win32':
    ForkingPickler.register(socket.socket, reduction.reduce_socket)
    ForkingPickler.register(Connection, reduction.reduce_connection)
    ForkingPickler.register(PipeConnection, reduction.reduce_pipe_connection)
else:
    ForkingPickler.register(socket.socket, reduction.reduce_socket)
    ForkingPickler.register(Connection, reduction.reduce_connection)
