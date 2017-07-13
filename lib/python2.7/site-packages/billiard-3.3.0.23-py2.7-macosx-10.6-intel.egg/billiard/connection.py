from __future__ import absolute_import

import sys

is_pypy = hasattr(sys, 'pypy_version_info')

if sys.version_info[0] == 3:
    from .py3 import connection
else:
    from .py2 import connection  # noqa


if is_pypy:
    import _multiprocessing
    from .compat import setblocking, send_offset

    class Connection(_multiprocessing.Connection):

        def send_offset(self, buf, offset):
            return send_offset(self.fileno(), buf, offset)

        def setblocking(self, blocking):
            setblocking(self.fileno(), blocking)
    _multiprocessing.Connection = Connection


sys.modules[__name__] = connection
