# -*- coding: utf-8 -*-
"""
    celery.utils.log
    ~~~~~~~~~~~~~~~~

    Logging utilities.

"""
from __future__ import absolute_import, print_function

import logging
import numbers
import os
import sys
import threading
import traceback

from contextlib import contextmanager
from billiard import current_process, util as mputil
from kombu.five import values
from kombu.log import get_logger as _get_logger, LOG_LEVELS
from kombu.utils.encoding import safe_str

from celery.five import string_t, text_t

from .term import colored

__all__ = ['ColorFormatter', 'LoggingProxy', 'base_logger',
           'set_in_sighandler', 'in_sighandler', 'get_logger',
           'get_task_logger', 'mlevel', 'ensure_process_aware_logger',
           'get_multiprocessing_logger', 'reset_multiprocessing_logger']

_process_aware = False
PY3 = sys.version_info[0] == 3

MP_LOG = os.environ.get('MP_LOG', False)


# Sets up our logging hierarchy.
#
# Every logger in the celery package inherits from the "celery"
# logger, and every task logger inherits from the "celery.task"
# logger.
base_logger = logger = _get_logger('celery')
mp_logger = _get_logger('multiprocessing')

_in_sighandler = False


def set_in_sighandler(value):
    global _in_sighandler
    _in_sighandler = value


def iter_open_logger_fds():
    seen = set()
    loggers = (list(values(logging.Logger.manager.loggerDict)) +
               [logging.getLogger(None)])
    for logger in loggers:
        try:
            for handler in logger.handlers:
                try:
                    if handler not in seen:
                        yield handler.stream
                        seen.add(handler)
                except AttributeError:
                    pass
        except AttributeError:  # PlaceHolder does not have handlers
            pass


@contextmanager
def in_sighandler():
    set_in_sighandler(True)
    try:
        yield
    finally:
        set_in_sighandler(False)


def logger_isa(l, p, max=1000):
    this, seen = l, set()
    for _ in range(max):
        if this == p:
            return True
        else:
            if this in seen:
                raise RuntimeError(
                    'Logger {0!r} parents recursive'.format(l),
                )
            seen.add(this)
            this = this.parent
            if not this:
                break
    else:
        raise RuntimeError('Logger hierarchy exceeds {0}'.format(max))
    return False


def get_logger(name):
    l = _get_logger(name)
    if logging.root not in (l, l.parent) and l is not base_logger:
        if not logger_isa(l, base_logger):
            l.parent = base_logger
    return l
task_logger = get_logger('celery.task')
worker_logger = get_logger('celery.worker')


def get_task_logger(name):
    logger = get_logger(name)
    if not logger_isa(logger, task_logger):
        logger.parent = task_logger
    return logger


def mlevel(level):
    if level and not isinstance(level, numbers.Integral):
        return LOG_LEVELS[level.upper()]
    return level


class ColorFormatter(logging.Formatter):
    #: Loglevel -> Color mapping.
    COLORS = colored().names
    colors = {'DEBUG': COLORS['blue'], 'WARNING': COLORS['yellow'],
              'ERROR': COLORS['red'], 'CRITICAL': COLORS['magenta']}

    def __init__(self, fmt=None, use_color=True):
        logging.Formatter.__init__(self, fmt)
        self.use_color = use_color

    def formatException(self, ei):
        if ei and not isinstance(ei, tuple):
            ei = sys.exc_info()
        r = logging.Formatter.formatException(self, ei)
        if isinstance(r, str) and not PY3:
            return safe_str(r)
        return r

    def format(self, record):
        msg = logging.Formatter.format(self, record)
        color = self.colors.get(record.levelname)

        # reset exception info later for other handlers...
        einfo = sys.exc_info() if record.exc_info == 1 else record.exc_info

        if color and self.use_color:
            try:
                # safe_str will repr the color object
                # and color will break on non-string objects
                # so need to reorder calls based on type.
                # Issue #427
                try:
                    if isinstance(msg, string_t):
                        return text_t(color(safe_str(msg)))
                    return safe_str(color(msg))
                except UnicodeDecodeError:
                    return safe_str(msg)  # skip colors
            except Exception as exc:
                prev_msg, record.exc_info, record.msg = (
                    record.msg, 1, '<Unrepresentable {0!r}: {1!r}>'.format(
                        type(msg), exc
                    ),
                )
                try:
                    return logging.Formatter.format(self, record)
                finally:
                    record.msg, record.exc_info = prev_msg, einfo
        else:
            return safe_str(msg)


class LoggingProxy(object):
    """Forward file object to :class:`logging.Logger` instance.

    :param logger: The :class:`logging.Logger` instance to forward to.
    :param loglevel: Loglevel to use when writing messages.

    """
    mode = 'w'
    name = None
    closed = False
    loglevel = logging.ERROR
    _thread = threading.local()

    def __init__(self, logger, loglevel=None):
        self.logger = logger
        self.loglevel = mlevel(loglevel or self.logger.level or self.loglevel)
        self._safewrap_handlers()

    def _safewrap_handlers(self):
        """Make the logger handlers dump internal errors to
        `sys.__stderr__` instead of `sys.stderr` to circumvent
        infinite loops."""

        def wrap_handler(handler):                  # pragma: no cover

            class WithSafeHandleError(logging.Handler):

                def handleError(self, record):
                    exc_info = sys.exc_info()
                    try:
                        try:
                            traceback.print_exception(exc_info[0],
                                                      exc_info[1],
                                                      exc_info[2],
                                                      None, sys.__stderr__)
                        except IOError:
                            pass    # see python issue 5971
                    finally:
                        del(exc_info)

            handler.handleError = WithSafeHandleError().handleError
        return [wrap_handler(h) for h in self.logger.handlers]

    def write(self, data):
        """Write message to logging object."""
        if _in_sighandler:
            return print(safe_str(data), file=sys.__stderr__)
        if getattr(self._thread, 'recurse_protection', False):
            # Logger is logging back to this file, so stop recursing.
            return
        data = data.strip()
        if data and not self.closed:
            self._thread.recurse_protection = True
            try:
                self.logger.log(self.loglevel, safe_str(data))
            finally:
                self._thread.recurse_protection = False

    def writelines(self, sequence):
        """`writelines(sequence_of_strings) -> None`.

        Write the strings to the file.

        The sequence can be any iterable object producing strings.
        This is equivalent to calling :meth:`write` for each string.

        """
        for part in sequence:
            self.write(part)

    def flush(self):
        """This object is not buffered so any :meth:`flush` requests
        are ignored."""
        pass

    def close(self):
        """When the object is closed, no write requests are forwarded to
        the logging object anymore."""
        self.closed = True

    def isatty(self):
        """Always return :const:`False`. Just here for file support."""
        return False


def ensure_process_aware_logger(force=False):
    """Make sure process name is recorded when loggers are used."""
    global _process_aware
    if force or not _process_aware:
        logging._acquireLock()
        try:
            _process_aware = True
            Logger = logging.getLoggerClass()
            if getattr(Logger, '_process_aware', False):  # pragma: no cover
                return

            class ProcessAwareLogger(Logger):
                _signal_safe = True
                _process_aware = True

                def makeRecord(self, *args, **kwds):
                    record = Logger.makeRecord(self, *args, **kwds)
                    record.processName = current_process()._name
                    return record

                def log(self, *args, **kwargs):
                    if _in_sighandler:
                        return
                    return Logger.log(self, *args, **kwargs)
            logging.setLoggerClass(ProcessAwareLogger)
        finally:
            logging._releaseLock()


def get_multiprocessing_logger():
    return mputil.get_logger() if mputil else None


def reset_multiprocessing_logger():
    if mputil and hasattr(mputil, '_logger'):
        mputil._logger = None


def current_process_index(base=1):
    if current_process:
        index = getattr(current_process(), 'index', None)
        return index + base if index is not None else index
ensure_process_aware_logger()
