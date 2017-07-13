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

"""Interfaces for platform-specific functionality.

This module exists primarily for documentation purposes and as base classes
for other tornado.platform modules.  Most code should import the appropriate
implementation from `tornado.platform.auto`.
"""

from __future__ import absolute_import, division, print_function, with_statement


def set_close_exec(fd):
    """Sets the close-on-exec bit (``FD_CLOEXEC``)for a file descriptor."""
    raise NotImplementedError()


class Waker(object):
    """A socket-like object that can wake another thread from ``select()``.

    The `~tornado.ioloop.IOLoop` will add the Waker's `fileno()` to
    its ``select`` (or ``epoll`` or ``kqueue``) calls.  When another
    thread wants to wake up the loop, it calls `wake`.  Once it has woken
    up, it will call `consume` to do any necessary per-wake cleanup.  When
    the ``IOLoop`` is closed, it closes its waker too.
    """
    def fileno(self):
        """Returns the read file descriptor for this waker.

        Must be suitable for use with ``select()`` or equivalent on the
        local platform.
        """
        raise NotImplementedError()

    def write_fileno(self):
        """Returns the write file descriptor for this waker."""
        raise NotImplementedError()

    def wake(self):
        """Triggers activity on the waker's file descriptor."""
        raise NotImplementedError()

    def consume(self):
        """Called after the listen has woken up to do any necessary cleanup."""
        raise NotImplementedError()

    def close(self):
        """Closes the waker's file descriptor(s)."""
        raise NotImplementedError()
