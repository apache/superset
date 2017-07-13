# -*- coding: utf-8 -*-
"""
    celery.utils.debug
    ~~~~~~~~~~~~~~~~~~

    Utilities for debugging memory usage.

"""
from __future__ import absolute_import, print_function, unicode_literals

import os

from contextlib import contextmanager
from functools import partial

from celery.five import range
from celery.platforms import signals

try:
    from psutil import Process
except ImportError:
    Process = None  # noqa

__all__ = [
    'blockdetection', 'sample_mem', 'memdump', 'sample',
    'humanbytes', 'mem_rss', 'ps',
]

UNITS = (
    (2 ** 40.0, 'TB'),
    (2 ** 30.0, 'GB'),
    (2 ** 20.0, 'MB'),
    (2 ** 10.0, 'kB'),
    (0.0, '{0!d}b'),
)

_process = None
_mem_sample = []


def _on_blocking(signum, frame):
    import inspect
    raise RuntimeError(
        'Blocking detection timed-out at: {0}'.format(
            inspect.getframeinfo(frame)
        )
    )


@contextmanager
def blockdetection(timeout):
    """A timeout context using ``SIGALRM`` that can be used to detect blocking
    functions."""
    if not timeout:
        yield
    else:
        old_handler = signals['ALRM']
        old_handler = None if old_handler == _on_blocking else old_handler

        signals['ALRM'] = _on_blocking

        try:
            yield signals.arm_alarm(timeout)
        finally:
            if old_handler:
                signals['ALRM'] = old_handler
            signals.reset_alarm()


def sample_mem():
    """Sample RSS memory usage.

    Statistics can then be output by calling :func:`memdump`.

    """
    current_rss = mem_rss()
    _mem_sample.append(current_rss)
    return current_rss


def _memdump(samples=10):
    S = _mem_sample
    prev = list(S) if len(S) <= samples else sample(S, samples)
    _mem_sample[:] = []
    import gc
    gc.collect()
    after_collect = mem_rss()
    return prev, after_collect


def memdump(samples=10, file=None):
    """Dump memory statistics.

    Will print a sample of all RSS memory samples added by
    calling :func:`sample_mem`, and in addition print
    used RSS memory after :func:`gc.collect`.

    """
    say = partial(print, file=file)
    if ps() is None:
        say('- rss: (psutil not installed).')
        return
    prev, after_collect = _memdump(samples)
    if prev:
        say('- rss (sample):')
        for mem in prev:
            say('-    > {0},'.format(mem))
    say('- rss (end): {0}.'.format(after_collect))


def sample(x, n, k=0):
    """Given a list `x` a sample of length ``n`` of that list is returned.

    E.g. if `n` is 10, and `x` has 100 items, a list of every 10th
    item is returned.

    ``k`` can be used as offset.

    """
    j = len(x) // n
    for _ in range(n):
        try:
            yield x[k]
        except IndexError:
            break
        k += j


def hfloat(f, p=5):
    """Convert float to value suitable for humans.

    :keyword p: Float precision.

    """
    i = int(f)
    return i if i == f else '{0:.{p}}'.format(f, p=p)


def humanbytes(s):
    """Convert bytes to human-readable form (e.g. kB, MB)."""
    return next(
        '{0}{1}'.format(hfloat(s / div if div else s), unit)
        for div, unit in UNITS if s >= div
    )


def mem_rss():
    """Return RSS memory usage as a humanized string."""
    p = ps()
    if p is not None:
        return humanbytes(_process_memory_info(p).rss)


def ps():
    """Return the global :class:`psutil.Process` instance,
    or :const:`None` if :mod:`psutil` is not installed."""
    global _process
    if _process is None and Process is not None:
        _process = Process(os.getpid())
    return _process


def _process_memory_info(process):
    try:
        return process.memory_info()
    except AttributeError:
        return process.get_memory_info()
