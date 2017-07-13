#
# Module providing various facilities to other parts of the package
#
# billiard/util.py
#
# Copyright (c) 2006-2008, R Oudkerk --- see COPYING.txt
# Licensed to PSF under a Contributor Agreement.
#
from __future__ import absolute_import

import errno
import functools
import atexit

from multiprocessing.util import (  # noqa
    _afterfork_registry,
    _afterfork_counter,
    _exit_function,
    _finalizer_registry,
    _finalizer_counter,
    Finalize,
    ForkAwareLocal,
    ForkAwareThreadLock,
    get_temp_dir,
    is_exiting,
    register_after_fork,
    _run_after_forkers,
    _run_finalizers,
)

from .compat import get_errno

__all__ = [
    'sub_debug', 'debug', 'info', 'sub_warning', 'get_logger',
    'log_to_stderr', 'get_temp_dir', 'register_after_fork',
    'is_exiting', 'Finalize', 'ForkAwareThreadLock', 'ForkAwareLocal',
    'SUBDEBUG', 'SUBWARNING',
]

#
# Logging
#

NOTSET = 0
SUBDEBUG = 5
DEBUG = 10
INFO = 20
SUBWARNING = 25
ERROR = 40

LOGGER_NAME = 'multiprocessing'
DEFAULT_LOGGING_FORMAT = '[%(levelname)s/%(processName)s] %(message)s'

_logger = None
_log_to_stderr = False


def sub_debug(msg, *args, **kwargs):
    if _logger:
        _logger.log(SUBDEBUG, msg, *args, **kwargs)


def debug(msg, *args, **kwargs):
    if _logger:
        _logger.log(DEBUG, msg, *args, **kwargs)
        return True
    return False


def info(msg, *args, **kwargs):
    if _logger:
        _logger.log(INFO, msg, *args, **kwargs)
        return True
    return False


def sub_warning(msg, *args, **kwargs):
    if _logger:
        _logger.log(SUBWARNING, msg, *args, **kwargs)
        return True
    return False


def error(msg, *args, **kwargs):
    if _logger:
        _logger.log(ERROR, msg, *args, **kwargs)
        return True
    return False


def get_logger():
    '''
    Returns logger used by multiprocessing
    '''
    global _logger
    import logging

    logging._acquireLock()
    try:
        if not _logger:

            _logger = logging.getLogger(LOGGER_NAME)
            _logger.propagate = 0
            logging.addLevelName(SUBDEBUG, 'SUBDEBUG')
            logging.addLevelName(SUBWARNING, 'SUBWARNING')

            # XXX multiprocessing should cleanup before logging
            if hasattr(atexit, 'unregister'):
                atexit.unregister(_exit_function)
                atexit.register(_exit_function)
            else:
                atexit._exithandlers.remove((_exit_function, (), {}))
                atexit._exithandlers.append((_exit_function, (), {}))
    finally:
        logging._releaseLock()

    return _logger


def log_to_stderr(level=None):
    '''
    Turn on logging and add a handler which prints to stderr
    '''
    global _log_to_stderr
    import logging

    logger = get_logger()
    formatter = logging.Formatter(DEFAULT_LOGGING_FORMAT)
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    if level:
        logger.setLevel(level)
    _log_to_stderr = True
    return _logger


def _eintr_retry(func):
    '''
    Automatic retry after EINTR.
    '''

    @functools.wraps(func)
    def wrapped(*args, **kwargs):
        while 1:
            try:
                return func(*args, **kwargs)
            except OSError as exc:
                if get_errno(exc) != errno.EINTR:
                    raise
    return wrapped
