# -*- coding: utf-8 -*-
"""
    celery.apps.beat
    ~~~~~~~~~~~~~~~~

    This module is the 'program-version' of :mod:`celery.beat`.

    It does everything necessary to run that module
    as an actual application, like installing signal handlers
    and so on.

"""
from __future__ import absolute_import, unicode_literals

import numbers
import socket
import sys

from celery import VERSION_BANNER, platforms, beat
from celery.utils.imports import qualname
from celery.utils.log import LOG_LEVELS, get_logger
from celery.utils.timeutils import humanize_seconds

__all__ = ['Beat']

STARTUP_INFO_FMT = """
Configuration ->
    . broker -> {conninfo}
    . loader -> {loader}
    . scheduler -> {scheduler}
{scheduler_info}
    . logfile -> {logfile}@%{loglevel}
    . maxinterval -> {hmax_interval} ({max_interval}s)
""".strip()

logger = get_logger('celery.beat')


class Beat(object):
    Service = beat.Service
    app = None

    def __init__(self, max_interval=None, app=None,
                 socket_timeout=30, pidfile=None, no_color=None,
                 loglevel=None, logfile=None, schedule=None,
                 scheduler_cls=None, redirect_stdouts=None,
                 redirect_stdouts_level=None, **kwargs):
        """Starts the beat task scheduler."""
        self.app = app = app or self.app
        self.loglevel = self._getopt('log_level', loglevel)
        self.logfile = self._getopt('log_file', logfile)
        self.schedule = self._getopt('schedule_filename', schedule)
        self.scheduler_cls = self._getopt('scheduler', scheduler_cls)
        self.redirect_stdouts = self._getopt(
            'redirect_stdouts', redirect_stdouts,
        )
        self.redirect_stdouts_level = self._getopt(
            'redirect_stdouts_level', redirect_stdouts_level,
        )

        self.max_interval = max_interval
        self.socket_timeout = socket_timeout
        self.no_color = no_color
        self.colored = app.log.colored(
            self.logfile,
            enabled=not no_color if no_color is not None else no_color,
        )
        self.pidfile = pidfile

        if not isinstance(self.loglevel, numbers.Integral):
            self.loglevel = LOG_LEVELS[self.loglevel.upper()]

    def _getopt(self, key, value):
        if value is not None:
            return value
        return self.app.conf.find_value_for_key(key, namespace='celerybeat')

    def run(self):
        print(str(self.colored.cyan(
            'celery beat v{0} is starting.'.format(VERSION_BANNER))))
        self.init_loader()
        self.set_process_title()
        self.start_scheduler()

    def setup_logging(self, colorize=None):
        if colorize is None and self.no_color is not None:
            colorize = not self.no_color
        self.app.log.setup(self.loglevel, self.logfile,
                           self.redirect_stdouts, self.redirect_stdouts_level,
                           colorize=colorize)

    def start_scheduler(self):
        c = self.colored
        if self.pidfile:
            platforms.create_pidlock(self.pidfile)
        beat = self.Service(app=self.app,
                            max_interval=self.max_interval,
                            scheduler_cls=self.scheduler_cls,
                            schedule_filename=self.schedule)

        print(str(c.blue('__    ', c.magenta('-'),
                  c.blue('    ... __   '), c.magenta('-'),
                  c.blue('        _\n'),
                  c.reset(self.startup_info(beat)))))
        self.setup_logging()
        if self.socket_timeout:
            logger.debug('Setting default socket timeout to %r',
                         self.socket_timeout)
            socket.setdefaulttimeout(self.socket_timeout)
        try:
            self.install_sync_handler(beat)
            beat.start()
        except Exception as exc:
            logger.critical('beat raised exception %s: %r',
                            exc.__class__, exc,
                            exc_info=True)

    def init_loader(self):
        # Run the worker init handler.
        # (Usually imports task modules and such.)
        self.app.loader.init_worker()
        self.app.finalize()

    def startup_info(self, beat):
        scheduler = beat.get_scheduler(lazy=True)
        return STARTUP_INFO_FMT.format(
            conninfo=self.app.connection().as_uri(),
            logfile=self.logfile or '[stderr]',
            loglevel=LOG_LEVELS[self.loglevel],
            loader=qualname(self.app.loader),
            scheduler=qualname(scheduler),
            scheduler_info=scheduler.info,
            hmax_interval=humanize_seconds(beat.max_interval),
            max_interval=beat.max_interval,
        )

    def set_process_title(self):
        arg_start = 'manage' in sys.argv[0] and 2 or 1
        platforms.set_process_title(
            'celery beat', info=' '.join(sys.argv[arg_start:]),
        )

    def install_sync_handler(self, beat):
        """Install a `SIGTERM` + `SIGINT` handler that saves
        the beat schedule."""

        def _sync(signum, frame):
            beat.sync()
            raise SystemExit()

        platforms.signals.update(SIGTERM=_sync, SIGINT=_sync)
