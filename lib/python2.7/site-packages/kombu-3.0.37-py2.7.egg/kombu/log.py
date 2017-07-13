from __future__ import absolute_import

import logging
import numbers
import os
import sys

from logging.handlers import WatchedFileHandler

from .five import string_t
from .utils import cached_property
from .utils.encoding import safe_repr, safe_str
from .utils.functional import maybe_evaluate

__all__ = ['LogMixin', 'LOG_LEVELS', 'get_loglevel', 'setup_logging']

try:
    LOG_LEVELS = dict(logging._nameToLevel)
    LOG_LEVELS.update(logging._levelToName)
except AttributeError:
    LOG_LEVELS = dict(logging._levelNames)
LOG_LEVELS.setdefault('FATAL', logging.FATAL)
LOG_LEVELS.setdefault(logging.FATAL, 'FATAL')
DISABLE_TRACEBACKS = os.environ.get('DISABLE_TRACEBACKS')


class NullHandler(logging.Handler):

    def emit(self, record):
        pass


def get_logger(logger):
    if isinstance(logger, string_t):
        logger = logging.getLogger(logger)
    if not logger.handlers:
        logger.addHandler(NullHandler())
    return logger


def get_loglevel(level):
    if isinstance(level, string_t):
        return LOG_LEVELS[level]
    return level


def naive_format_parts(fmt):
    parts = fmt.split('%')
    for i, e in enumerate(parts[1:]):
        yield None if not e or not parts[i - 1] else e[0]


def safeify_format(fmt, args,
                   filters={'s': safe_str,
                            'r': safe_repr}):
    for index, type in enumerate(naive_format_parts(fmt)):
        filt = filters.get(type)
        yield filt(args[index]) if filt else args[index]


class LogMixin(object):

    def debug(self, *args, **kwargs):
        return self.log(logging.DEBUG, *args, **kwargs)

    def info(self, *args, **kwargs):
        return self.log(logging.INFO, *args, **kwargs)

    def warn(self, *args, **kwargs):
        return self.log(logging.WARN, *args, **kwargs)

    def error(self, *args, **kwargs):
        return self._error(logging.ERROR, *args, **kwargs)

    def critical(self, *args, **kwargs):
        return self._error(logging.CRITICAL, *args, **kwargs)

    def _error(self, severity, *args, **kwargs):
        kwargs.setdefault('exc_info', True)
        if DISABLE_TRACEBACKS:
            kwargs.pop('exc_info', None)
        return self.log(severity, *args, **kwargs)

    def annotate(self, text):
        return '%s - %s' % (self.logger_name, text)

    def log(self, severity, *args, **kwargs):
        if self.logger.isEnabledFor(severity):
            log = self.logger.log
            if len(args) > 1 and isinstance(args[0], string_t):
                expand = [maybe_evaluate(arg) for arg in args[1:]]
                return log(severity,
                           self.annotate(args[0].replace('%r', '%s')),
                           *list(safeify_format(args[0], expand)), **kwargs)
            else:
                return self.logger.log(
                    severity, self.annotate(' '.join(map(safe_str, args))),
                    **kwargs)

    def get_logger(self):
        return get_logger(self.logger_name)

    def is_enabled_for(self, level):
        return self.logger.isEnabledFor(self.get_loglevel(level))

    def get_loglevel(self, level):
        if not isinstance(level, numbers.Integral):
            return LOG_LEVELS[level]
        return level

    @cached_property
    def logger(self):
        return self.get_logger()

    @property
    def logger_name(self):
        return self.__class__.__name__


class Log(LogMixin):

    def __init__(self, name, logger=None):
        self._logger_name = name
        self._logger = logger

    def get_logger(self):
        if self._logger:
            return self._logger
        return LogMixin.get_logger(self)

    @property
    def logger_name(self):
        return self._logger_name


def setup_logging(loglevel=None, logfile=None):
    logger = logging.getLogger()
    loglevel = get_loglevel(loglevel or 'ERROR')
    logfile = logfile if logfile else sys.__stderr__
    if not logger.handlers:
        if hasattr(logfile, 'write'):
            handler = logging.StreamHandler(logfile)
        else:
            handler = WatchedFileHandler(logfile)
        logger.addHandler(handler)
        logger.setLevel(loglevel)
    return logger
