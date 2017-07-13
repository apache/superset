# -*- coding: utf-8 -*-
"""
This module contains utilities added by billiard, to keep
"non-core" functionality out of ``.util``."""
from __future__ import absolute_import

import os
import signal
import sys

import pickle as pypickle
try:
    import cPickle as cpickle
except ImportError:  # pragma: no cover
    cpickle = None   # noqa

from .exceptions import RestartFreqExceeded
from .five import monotonic

if sys.version_info < (2, 6):  # pragma: no cover
    # cPickle does not use absolute_imports
    pickle = pypickle
    pickle_load = pypickle.load
    pickle_loads = pypickle.loads
else:
    pickle = cpickle or pypickle
    pickle_load = pickle.load
    pickle_loads = pickle.loads

# cPickle.loads does not support buffer() objects,
# but we can just create a StringIO and use load.
if sys.version_info[0] == 3:
    from io import BytesIO
else:
    try:
        from cStringIO import StringIO as BytesIO  # noqa
    except ImportError:
        from StringIO import StringIO as BytesIO  # noqa

EX_SOFTWARE = 70

TERMSIGS_DEFAULT = (
    'SIGHUP',
    'SIGQUIT',
    'SIGTERM',
    'SIGUSR1',
    'SIGUSR2'
)

TERMSIGS_FULL = (
    'SIGHUP',
    'SIGQUIT',
    'SIGTRAP',
    'SIGABRT',
    'SIGEMT',
    'SIGSYS',
    'SIGPIPE',
    'SIGALRM',
    'SIGTERM',
    'SIGXCPU',
    'SIGXFSZ',
    'SIGVTALRM',
    'SIGPROF',
    'SIGUSR1',
    'SIGUSR2',
)

#: set by signal handlers just before calling exit.
#: if this is true after the sighandler returns it means that something
#: went wrong while terminating the process, and :func:`os._exit`
#: must be called ASAP.
_should_have_exited = [False]


def pickle_loads(s, load=pickle_load):
    # used to support buffer objects
    return load(BytesIO(s))


def maybe_setsignal(signum, handler):
    try:
        signal.signal(signum, handler)
    except (OSError, AttributeError, ValueError, RuntimeError):
        pass


def _shutdown_cleanup(signum, frame):
    # we will exit here so if the signal is received a second time
    # we can be sure that something is very wrong and we may be in
    # a crashing loop.
    if _should_have_exited[0]:
        os._exit(EX_SOFTWARE)
    maybe_setsignal(signum, signal.SIG_DFL)
    _should_have_exited[0] = True
    sys.exit(-(256 - signum))


def reset_signals(handler=_shutdown_cleanup, full=False):
    for sig in TERMSIGS_FULL if full else TERMSIGS_DEFAULT:
        try:
            signum = getattr(signal, sig)
        except AttributeError:
            pass
        else:
            current = signal.getsignal(signum)
            if current is not None and current != signal.SIG_IGN:
                maybe_setsignal(signum, handler)


class restart_state(object):
    RestartFreqExceeded = RestartFreqExceeded

    def __init__(self, maxR, maxT):
        self.maxR, self.maxT = maxR, maxT
        self.R, self.T = 0, None

    def step(self, now=None):
        now = monotonic() if now is None else now
        R = self.R
        if self.T and now - self.T >= self.maxT:
            # maxT passed, reset counter and time passed.
            self.T, self.R = now, 0
        elif self.maxR and self.R >= self.maxR:
            # verify that R has a value as the result handler
            # resets this when a job is accepted. If a job is accepted
            # the startup probably went fine (startup restart burst
            # protection)
            if self.R:  # pragma: no cover
                self.R = 0  # reset in case someone catches the error
                raise self.RestartFreqExceeded("%r in %rs" % (R, self.maxT))
        # first run sets T
        if self.T is None:
            self.T = now
        self.R += 1
