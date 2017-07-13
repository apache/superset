#
# Module implementing synchronization primitives
#
# multiprocessing/synchronize.py
#
# Copyright (c) 2006-2008, R Oudkerk
# Licensed to PSF under a Contributor Agreement.
#
from __future__ import absolute_import

import itertools
import os
import signal
import sys
import threading


from ._ext import _billiard, ensure_SemLock
from .five import range, monotonic
from .process import current_process
from .util import Finalize, register_after_fork, debug
from .forking import assert_spawning, Popen
from .compat import bytes, closerange

__all__ = [
    'Lock', 'RLock', 'Semaphore', 'BoundedSemaphore', 'Condition', 'Event',
]

# Try to import the mp.synchronize module cleanly, if it fails
# raise ImportError for platforms lacking a working sem_open implementation.
# See issue 3770
ensure_SemLock()

#
# Constants
#

RECURSIVE_MUTEX, SEMAPHORE = list(range(2))
SEM_VALUE_MAX = _billiard.SemLock.SEM_VALUE_MAX

try:
    sem_unlink = _billiard.SemLock.sem_unlink
except AttributeError:  # pragma: no cover
    try:
        # Py3.4+ implements sem_unlink and the semaphore must be named
        from _multiprocessing import sem_unlink  # noqa
    except ImportError:
        sem_unlink = None   # noqa

#
# Base class for semaphores and mutexes; wraps `_billiard.SemLock`
#


def _semname(sl):
    try:
        return sl.name
    except AttributeError:
        pass


class SemLock(object):
    _counter = itertools.count()

    def __init__(self, kind, value, maxvalue):
        from .forking import _forking_is_enabled
        unlink_immediately = _forking_is_enabled or sys.platform == 'win32'
        if sem_unlink:
            sl = self._semlock = _billiard.SemLock(
                kind, value, maxvalue, self._make_name(), unlink_immediately)
        else:
            sl = self._semlock = _billiard.SemLock(kind, value, maxvalue)

        debug('created semlock with handle %s', sl.handle)
        self._make_methods()

        if sem_unlink:

            if sys.platform != 'win32':
                def _after_fork(obj):
                    obj._semlock._after_fork()
                register_after_fork(self, _after_fork)

            if _semname(self._semlock) is not None:
                # We only get here if we are on Unix with forking
                # disabled.  When the object is garbage collected or the
                # process shuts down we unlink the semaphore name
                Finalize(self, sem_unlink, (self._semlock.name,),
                         exitpriority=0)
                # In case of abnormal termination unlink semaphore name
                _cleanup_semaphore_if_leaked(self._semlock.name)

    def _make_methods(self):
        self.acquire = self._semlock.acquire
        self.release = self._semlock.release

    def __enter__(self):
        return self._semlock.__enter__()

    def __exit__(self, *args):
        return self._semlock.__exit__(*args)

    def __getstate__(self):
        assert_spawning(self)
        sl = self._semlock
        state = (Popen.duplicate_for_child(sl.handle), sl.kind, sl.maxvalue)
        try:
            state += (sl.name, )
        except AttributeError:
            pass
        return state

    def __setstate__(self, state):
        self._semlock = _billiard.SemLock._rebuild(*state)
        debug('recreated blocker with handle %r', state[0])
        self._make_methods()

    @staticmethod
    def _make_name():
        return '/%s-%s-%s' % (current_process()._semprefix,
                              os.getpid(), next(SemLock._counter))


class Semaphore(SemLock):

    def __init__(self, value=1):
        SemLock.__init__(self, SEMAPHORE, value, SEM_VALUE_MAX)

    def get_value(self):
        return self._semlock._get_value()

    def __repr__(self):
        try:
            value = self._semlock._get_value()
        except Exception:
            value = 'unknown'
        return '<Semaphore(value=%s)>' % value


class BoundedSemaphore(Semaphore):

    def __init__(self, value=1):
        SemLock.__init__(self, SEMAPHORE, value, value)

    def __repr__(self):
        try:
            value = self._semlock._get_value()
        except Exception:
            value = 'unknown'
        return '<BoundedSemaphore(value=%s, maxvalue=%s)>' % \
               (value, self._semlock.maxvalue)


class Lock(SemLock):
    '''
    Non-recursive lock.
    '''

    def __init__(self):
        SemLock.__init__(self, SEMAPHORE, 1, 1)

    def __repr__(self):
        try:
            if self._semlock._is_mine():
                name = current_process().name
                if threading.currentThread().name != 'MainThread':
                    name += '|' + threading.currentThread().name
            elif self._semlock._get_value() == 1:
                name = 'None'
            elif self._semlock._count() > 0:
                name = 'SomeOtherThread'
            else:
                name = 'SomeOtherProcess'
        except Exception:
            name = 'unknown'
        return '<Lock(owner=%s)>' % name


class RLock(SemLock):
    '''
    Recursive lock
    '''

    def __init__(self):
        SemLock.__init__(self, RECURSIVE_MUTEX, 1, 1)

    def __repr__(self):
        try:
            if self._semlock._is_mine():
                name = current_process().name
                if threading.currentThread().name != 'MainThread':
                    name += '|' + threading.currentThread().name
                count = self._semlock._count()
            elif self._semlock._get_value() == 1:
                name, count = 'None', 0
            elif self._semlock._count() > 0:
                name, count = 'SomeOtherThread', 'nonzero'
            else:
                name, count = 'SomeOtherProcess', 'nonzero'
        except Exception:
            name, count = 'unknown', 'unknown'
        return '<RLock(%s, %s)>' % (name, count)


class Condition(object):
    '''
    Condition variable
    '''

    def __init__(self, lock=None):
        self._lock = lock or RLock()
        self._sleeping_count = Semaphore(0)
        self._woken_count = Semaphore(0)
        self._wait_semaphore = Semaphore(0)
        self._make_methods()

    def __getstate__(self):
        assert_spawning(self)
        return (self._lock, self._sleeping_count,
                self._woken_count, self._wait_semaphore)

    def __setstate__(self, state):
        (self._lock, self._sleeping_count,
         self._woken_count, self._wait_semaphore) = state
        self._make_methods()

    def __enter__(self):
        return self._lock.__enter__()

    def __exit__(self, *args):
        return self._lock.__exit__(*args)

    def _make_methods(self):
        self.acquire = self._lock.acquire
        self.release = self._lock.release

    def __repr__(self):
        try:
            num_waiters = (self._sleeping_count._semlock._get_value() -
                           self._woken_count._semlock._get_value())
        except Exception:
            num_waiters = 'unkown'
        return '<Condition(%s, %s)>' % (self._lock, num_waiters)

    def wait(self, timeout=None):
        assert self._lock._semlock._is_mine(), \
            'must acquire() condition before using wait()'

        # indicate that this thread is going to sleep
        self._sleeping_count.release()

        # release lock
        count = self._lock._semlock._count()
        for i in range(count):
            self._lock.release()

        try:
            # wait for notification or timeout
            ret = self._wait_semaphore.acquire(True, timeout)
        finally:
            # indicate that this thread has woken
            self._woken_count.release()

            # reacquire lock
            for i in range(count):
                self._lock.acquire()
            return ret

    def notify(self):
        assert self._lock._semlock._is_mine(), 'lock is not owned'
        assert not self._wait_semaphore.acquire(False)

        # to take account of timeouts since last notify() we subtract
        # woken_count from sleeping_count and rezero woken_count
        while self._woken_count.acquire(False):
            res = self._sleeping_count.acquire(False)
            assert res

        if self._sleeping_count.acquire(False):  # try grabbing a sleeper
            self._wait_semaphore.release()       # wake up one sleeper
            self._woken_count.acquire()          # wait for sleeper to wake

            # rezero _wait_semaphore in case a timeout just happened
            self._wait_semaphore.acquire(False)

    def notify_all(self):
        assert self._lock._semlock._is_mine(), 'lock is not owned'
        assert not self._wait_semaphore.acquire(False)

        # to take account of timeouts since last notify*() we subtract
        # woken_count from sleeping_count and rezero woken_count
        while self._woken_count.acquire(False):
            res = self._sleeping_count.acquire(False)
            assert res

        sleepers = 0
        while self._sleeping_count.acquire(False):
            self._wait_semaphore.release()        # wake up one sleeper
            sleepers += 1

        if sleepers:
            for i in range(sleepers):
                self._woken_count.acquire()       # wait for a sleeper to wake

            # rezero wait_semaphore in case some timeouts just happened
            while self._wait_semaphore.acquire(False):
                pass

    def wait_for(self, predicate, timeout=None):
        result = predicate()
        if result:
            return result
        if timeout is not None:
            endtime = monotonic() + timeout
        else:
            endtime = None
            waittime = None
        while not result:
            if endtime is not None:
                waittime = endtime - monotonic()
                if waittime <= 0:
                    break
            self.wait(waittime)
            result = predicate()
        return result


class Event(object):

    def __init__(self):
        self._cond = Condition(Lock())
        self._flag = Semaphore(0)

    def is_set(self):
        self._cond.acquire()
        try:
            if self._flag.acquire(False):
                self._flag.release()
                return True
            return False
        finally:
            self._cond.release()

    def set(self):
        self._cond.acquire()
        try:
            self._flag.acquire(False)
            self._flag.release()
            self._cond.notify_all()
        finally:
            self._cond.release()

    def clear(self):
        self._cond.acquire()
        try:
            self._flag.acquire(False)
        finally:
            self._cond.release()

    def wait(self, timeout=None):
        self._cond.acquire()
        try:
            if self._flag.acquire(False):
                self._flag.release()
            else:
                self._cond.wait(timeout)

            if self._flag.acquire(False):
                self._flag.release()
                return True
            return False
        finally:
            self._cond.release()


if sys.platform != 'win32':
    #
    # Protection against unlinked semaphores if the program ends abnormally
    # and forking has been disabled.
    #

    def _cleanup_semaphore_if_leaked(name):
        name = name.encode('ascii') + bytes('\0', 'ascii')
        if len(name) > 512:
            # posix guarantees that writes to a pipe of less than PIPE_BUF
            # bytes are atomic, and that PIPE_BUF >= 512
            raise ValueError('name too long')
        fd = _get_unlinkfd()
        bits = os.write(fd, name)
        assert bits == len(name)

    def _get_unlinkfd():
        cp = current_process()
        if cp._unlinkfd is None:
            r, w = os.pipe()
            pid = os.fork()
            if pid == 0:
                try:
                    from setproctitle import setproctitle
                    setproctitle("[sem_cleanup for %r]" % cp.pid)
                except:
                    pass

                # Fork a process which will survive until all other processes
                # which have a copy of the write end of the pipe have exited.
                # The forked process just collects names of semaphores until
                # EOF is indicated.  Then it tries unlinking all the names it
                # has collected.
                _collect_names_then_unlink(r)
                os._exit(0)
            os.close(r)
            cp._unlinkfd = w
        return cp._unlinkfd

    def _collect_names_then_unlink(r):
        # protect the process from ^C and "killall python" etc
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGTERM, signal.SIG_IGN)

        # close all fds except r
        try:
            MAXFD = os.sysconf("SC_OPEN_MAX")
        except:
            MAXFD = 256
        closerange(0, r)
        closerange(r + 1, MAXFD)

        # collect data written to pipe
        data = []
        while 1:
            try:
                s = os.read(r, 512)
            except:
                # XXX IO lock might be held at fork, so don't try
                # printing unexpected exception - see issue 6721
                pass
            else:
                if not s:
                    break
                data.append(s)

        # attempt to unlink each collected name
        for name in bytes('', 'ascii').join(data).split(bytes('\0', 'ascii')):
            try:
                sem_unlink(name.decode('ascii'))
            except:
                # XXX IO lock might be held at fork, so don't try
                # printing unexpected exception - see issue 6721
                pass
