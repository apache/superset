# -*- coding: utf-8 -*-
"""
    celery.app.log
    ~~~~~~~~~~~~~~

    The Celery instances logging section: ``Celery.log``.

    Sets up logging for the worker and other programs,
    redirects stdouts, colors log output, patches logging
    related compatibility fixes, and so on.

"""
from __future__ import absolute_import

import logging
import os
import sys

from logging.handlers import WatchedFileHandler

from kombu.log import NullHandler
from kombu.utils.encoding import set_default_encoding_file

from celery import signals
from celery._state import get_current_task
from celery.five import class_property, string_t
from celery.utils import isatty, node_format
from celery.utils.log import (
    get_logger, mlevel,
    ColorFormatter, ensure_process_aware_logger,
    LoggingProxy, get_multiprocessing_logger,
    reset_multiprocessing_logger,
)
from celery.utils.term import colored

__all__ = ['TaskFormatter', 'Logging']

MP_LOG = os.environ.get('MP_LOG', False)


class TaskFormatter(ColorFormatter):

    def format(self, record):
        task = get_current_task()
        if task and task.request:
            record.__dict__.update(task_id=task.request.id,
                                   task_name=task.name)
        else:
            record.__dict__.setdefault('task_name', '???')
            record.__dict__.setdefault('task_id', '???')
        return ColorFormatter.format(self, record)


class Logging(object):
    #: The logging subsystem is only configured once per process.
    #: setup_logging_subsystem sets this flag, and subsequent calls
    #: will do nothing.
    _setup = False

    def __init__(self, app):
        self.app = app
        self.loglevel = mlevel(self.app.conf.CELERYD_LOG_LEVEL)
        self.format = self.app.conf.CELERYD_LOG_FORMAT
        self.task_format = self.app.conf.CELERYD_TASK_LOG_FORMAT
        self.colorize = self.app.conf.CELERYD_LOG_COLOR

    def setup(self, loglevel=None, logfile=None, redirect_stdouts=False,
              redirect_level='WARNING', colorize=None, hostname=None):
        handled = self.setup_logging_subsystem(
            loglevel, logfile, colorize=colorize, hostname=hostname,
        )
        if not handled:
            if redirect_stdouts:
                self.redirect_stdouts(redirect_level)
        os.environ.update(
            CELERY_LOG_LEVEL=str(loglevel) if loglevel else '',
            CELERY_LOG_FILE=str(logfile) if logfile else '',
        )
        return handled

    def redirect_stdouts(self, loglevel=None, name='celery.redirected'):
        self.redirect_stdouts_to_logger(
            get_logger(name), loglevel=loglevel
        )
        os.environ.update(
            CELERY_LOG_REDIRECT='1',
            CELERY_LOG_REDIRECT_LEVEL=str(loglevel or ''),
        )

    def setup_logging_subsystem(self, loglevel=None, logfile=None, format=None,
                                colorize=None, hostname=None, **kwargs):
        if self.already_setup:
            return
        if logfile and hostname:
            logfile = node_format(logfile, hostname)
        self.already_setup = True
        loglevel = mlevel(loglevel or self.loglevel)
        format = format or self.format
        colorize = self.supports_color(colorize, logfile)
        reset_multiprocessing_logger()
        ensure_process_aware_logger()
        receivers = signals.setup_logging.send(
            sender=None, loglevel=loglevel, logfile=logfile,
            format=format, colorize=colorize,
        )

        if not receivers:
            root = logging.getLogger()

            if self.app.conf.CELERYD_HIJACK_ROOT_LOGGER:
                root.handlers = []
                get_logger('celery').handlers = []
                get_logger('celery.task').handlers = []
                get_logger('celery.redirected').handlers = []

            # Configure root logger
            self._configure_logger(
                root, logfile, loglevel, format, colorize, **kwargs
            )

            # Configure the multiprocessing logger
            self._configure_logger(
                get_multiprocessing_logger(),
                logfile, loglevel if MP_LOG else logging.ERROR,
                format, colorize, **kwargs
            )

            signals.after_setup_logger.send(
                sender=None, logger=root,
                loglevel=loglevel, logfile=logfile,
                format=format, colorize=colorize,
            )

            # then setup the root task logger.
            self.setup_task_loggers(loglevel, logfile, colorize=colorize)

        try:
            stream = logging.getLogger().handlers[0].stream
        except (AttributeError, IndexError):
            pass
        else:
            set_default_encoding_file(stream)

        # This is a hack for multiprocessing's fork+exec, so that
        # logging before Process.run works.
        logfile_name = logfile if isinstance(logfile, string_t) else ''
        os.environ.update(_MP_FORK_LOGLEVEL_=str(loglevel),
                          _MP_FORK_LOGFILE_=logfile_name,
                          _MP_FORK_LOGFORMAT_=format)
        return receivers

    def _configure_logger(self, logger, logfile, loglevel,
                          format, colorize, **kwargs):
        if logger is not None:
            self.setup_handlers(logger, logfile, format,
                                colorize, **kwargs)
            if loglevel:
                logger.setLevel(loglevel)

    def setup_task_loggers(self, loglevel=None, logfile=None, format=None,
                           colorize=None, propagate=False, **kwargs):
        """Setup the task logger.

        If `logfile` is not specified, then `sys.stderr` is used.

        Will return the base task logger object.

        """
        loglevel = mlevel(loglevel or self.loglevel)
        format = format or self.task_format
        colorize = self.supports_color(colorize, logfile)

        logger = self.setup_handlers(
            get_logger('celery.task'),
            logfile, format, colorize,
            formatter=TaskFormatter, **kwargs
        )
        logger.setLevel(loglevel)
        # this is an int for some reason, better not question why.
        logger.propagate = int(propagate)
        signals.after_setup_task_logger.send(
            sender=None, logger=logger,
            loglevel=loglevel, logfile=logfile,
            format=format, colorize=colorize,
        )
        return logger

    def redirect_stdouts_to_logger(self, logger, loglevel=None,
                                   stdout=True, stderr=True):
        """Redirect :class:`sys.stdout` and :class:`sys.stderr` to a
        logging instance.

        :param logger: The :class:`logging.Logger` instance to redirect to.
        :param loglevel: The loglevel redirected messages will be logged as.

        """
        proxy = LoggingProxy(logger, loglevel)
        if stdout:
            sys.stdout = proxy
        if stderr:
            sys.stderr = proxy
        return proxy

    def supports_color(self, colorize=None, logfile=None):
        colorize = self.colorize if colorize is None else colorize
        if self.app.IS_WINDOWS:
            # Windows does not support ANSI color codes.
            return False
        if colorize or colorize is None:
            # Only use color if there is no active log file
            # and stderr is an actual terminal.
            return logfile is None and isatty(sys.stderr)
        return colorize

    def colored(self, logfile=None, enabled=None):
        return colored(enabled=self.supports_color(enabled, logfile))

    def setup_handlers(self, logger, logfile, format, colorize,
                       formatter=ColorFormatter, **kwargs):
        if self._is_configured(logger):
            return logger
        handler = self._detect_handler(logfile)
        handler.setFormatter(formatter(format, use_color=colorize))
        logger.addHandler(handler)
        return logger

    def _detect_handler(self, logfile=None):
        """Create log handler with either a filename, an open stream
        or :const:`None` (stderr)."""
        logfile = sys.__stderr__ if logfile is None else logfile
        if hasattr(logfile, 'write'):
            return logging.StreamHandler(logfile)
        return WatchedFileHandler(logfile)

    def _has_handler(self, logger):
        if logger.handlers:
            return any(not isinstance(h, NullHandler) for h in logger.handlers)

    def _is_configured(self, logger):
        return self._has_handler(logger) and not getattr(
            logger, '_rudimentary_setup', False)

    def setup_logger(self, name='celery', *args, **kwargs):
        """Deprecated: No longer used."""
        self.setup_logging_subsystem(*args, **kwargs)
        return logging.root

    def get_default_logger(self, name='celery', **kwargs):
        return get_logger(name)

    @class_property
    def already_setup(cls):
        return cls._setup

    @already_setup.setter  # noqa
    def already_setup(cls, was_setup):
        cls._setup = was_setup
