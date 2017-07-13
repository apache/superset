from __future__ import absolute_import

import sys

try:
    import fcntl
except ImportError:
    fcntl = None   # noqa


class promise(object):
    if not hasattr(sys, 'pypy_version_info'):
        __slots__ = tuple(
            'fun args kwargs value ready failed '
            ' on_success on_error calls'.split()
        )

    def __init__(self, fun, args=(), kwargs=(),
                 on_success=None, on_error=None):
        self.fun = fun
        self.args = args
        self.kwargs = kwargs
        self.ready = False
        self.failed = False
        self.on_success = on_success
        self.on_error = on_error
        self.value = None
        self.calls = 0

    def __repr__(self):
        return '<$: {0.fun.__name__}(*{0.args!r}, **{0.kwargs!r})'.format(
            self,
        )

    def __call__(self, *args, **kwargs):
        try:
            self.value = self.fun(
                *self.args + args if self.args else args,
                **dict(self.kwargs, **kwargs) if self.kwargs else kwargs
            )
        except Exception as exc:
            self.set_error_state(exc)
        else:
            if self.on_success:
                self.on_success(self.value)
        finally:
            self.ready = True
            self.calls += 1

    def then(self, callback=None, on_error=None):
        self.on_success = callback
        self.on_error = on_error
        return callback

    def set_error_state(self, exc):
        self.failed = True
        if self.on_error is None:
            raise
        self.on_error(exc)

    def throw(self, exc):
        try:
            raise exc
        except exc.__class__ as with_cause:
            self.set_error_state(with_cause)


def noop():
    return promise(lambda *a, **k: None)


try:
    from os import set_cloexec  # Python 3.4?
except ImportError:
    def set_cloexec(fd, cloexec):  # noqa
        try:
            FD_CLOEXEC = fcntl.FD_CLOEXEC
        except AttributeError:
            raise NotImplementedError(
                'close-on-exec flag not supported on this platform',
            )
        flags = fcntl.fcntl(fd, fcntl.F_GETFD)
        if cloexec:
            flags |= FD_CLOEXEC
        else:
            flags &= ~FD_CLOEXEC
        return fcntl.fcntl(fd, fcntl.F_SETFD, flags)


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
