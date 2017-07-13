from __future__ import absolute_import

import errno
import os
import sys

from .five import range

if sys.platform == 'win32':
    try:
        import _winapi  # noqa
    except ImportError:                            # pragma: no cover
        try:
            from _billiard import win32 as _winapi  # noqa
        except (ImportError, AttributeError):
            from _multiprocessing import win32 as _winapi  # noqa
else:
    _winapi = None  # noqa


if sys.version_info > (2, 7, 5):
    buf_t, is_new_buffer = memoryview, True  # noqa
else:
    buf_t, is_new_buffer = buffer, False  # noqa

if hasattr(os, 'write'):
    __write__ = os.write

    if is_new_buffer:

        def send_offset(fd, buf, offset):
            return __write__(fd, buf[offset:])

    else:  # Py<2.7.6

        def send_offset(fd, buf, offset):  # noqa
            return __write__(fd, buf_t(buf, offset))

else:  # non-posix platform

    def send_offset(fd, buf, offset):  # noqa
        raise NotImplementedError('send_offset')


if sys.version_info[0] == 3:
    bytes = bytes
else:
    _bytes = bytes

    # the 'bytes' alias in Python2 does not support an encoding argument.

    class bytes(_bytes):  # noqa

        def __new__(cls, *args):
            if len(args) > 1:
                return _bytes(args[0]).encode(*args[1:])
            return _bytes(*args)

try:
    closerange = os.closerange
except AttributeError:

    def closerange(fd_low, fd_high):  # noqa
        for fd in reversed(range(fd_low, fd_high)):
            try:
                os.close(fd)
            except OSError as exc:
                if exc.errno != errno.EBADF:
                    raise


def get_errno(exc):
    """:exc:`socket.error` and :exc:`IOError` first got
    the ``.errno`` attribute in Py2.7"""
    try:
        return exc.errno
    except AttributeError:
        try:
            # e.args = (errno, reason)
            if isinstance(exc.args, tuple) and len(exc.args) == 2:
                return exc.args[0]
        except AttributeError:
            pass
    return 0


if sys.platform == 'win32':

    def setblocking(handle, blocking):
        raise NotImplementedError('setblocking not implemented on win32')

    def isblocking(handle):
        raise NotImplementedError('isblocking not implemented on win32')

else:
    from os import O_NONBLOCK
    from fcntl import fcntl, F_GETFL, F_SETFL

    def isblocking(handle):  # noqa
        return not (fcntl(handle, F_GETFL) & O_NONBLOCK)

    def setblocking(handle, blocking):  # noqa
        flags = fcntl(handle, F_GETFL, 0)
        fcntl(
            handle, F_SETFL,
            flags & (~O_NONBLOCK) if blocking else flags | O_NONBLOCK,
        )
