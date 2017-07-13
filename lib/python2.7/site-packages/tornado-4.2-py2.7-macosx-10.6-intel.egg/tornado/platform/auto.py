#!/usr/bin/env python
#
# Copyright 2011 Facebook
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may
# not use this file except in compliance with the License. You may obtain
# a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

"""Implementation of platform-specific functionality.

For each function or class described in `tornado.platform.interface`,
the appropriate platform-specific implementation exists in this module.
Most code that needs access to this functionality should do e.g.::

    from tornado.platform.auto import set_close_exec
"""

from __future__ import absolute_import, division, print_function, with_statement

import os

if 'APPENGINE_RUNTIME' in os.environ:
    from tornado.platform.common import Waker

    def set_close_exec(fd):
        pass
elif os.name == 'nt':
    from tornado.platform.common import Waker
    from tornado.platform.windows import set_close_exec
else:
    from tornado.platform.posix import set_close_exec, Waker

try:
    # monotime monkey-patches the time module to have a monotonic function
    # in versions of python before 3.3.
    import monotime
    # Silence pyflakes warning about this unused import
    monotime
except ImportError:
    pass
try:
    from time import monotonic as monotonic_time
except ImportError:
    monotonic_time = None

__all__ = ['Waker', 'set_close_exec', 'monotonic_time']
