from __future__ import absolute_import

import logging

from functools import partial
try:
    from collections import OrderedDict
except ImportError:
    from ordereddict import OrderedDict

from tornado import web
from tornado import gen
from tornado import websocket
from tornado.ioloop import PeriodicCallback

from ..views import BaseHandler
from ..api.workers import ListWorkers


logger = logging.getLogger(__name__)


class DashboardView(BaseHandler):
    @web.authenticated
    @gen.coroutine
    def get(self):
        refresh = self.get_argument('refresh', default=False, type=bool)

        app = self.application
        events = app.events.state
        broker = app.capp.connection().as_uri()

        if refresh:
            try:
                yield ListWorkers.update_workers(app=app)
            except Exception as e:
                logger.exception('Failed to update workers: %s', e)

        workers = {}
        for name, values in events.counter.items():
            if name not in events.workers:
                continue
            worker = events.workers[name]
            info = dict(values)
            info.update(self._as_dict(worker))
            info.update(status=worker.alive)
            workers[name] = info

        self.render("dashboard.html", workers=workers, broker=broker)

    @classmethod
    def _as_dict(cls, worker):
        if hasattr(worker, '_fields'):
            return dict((k, worker.__getattribute__(k)) for k in worker._fields)
        else:
            return cls._info(worker)

    @classmethod
    def _info(cls, worker):
        _fields = ('hostname', 'pid', 'freq', 'heartbeats', 'clock',
                   'active', 'processed', 'loadavg', 'sw_ident',
                   'sw_ver', 'sw_sys')

        def _keys():
            for key in _fields:
                value = getattr(worker, key, None)
                if value is not None:
                    yield key, value

        return dict(_keys())


class DashboardUpdateHandler(websocket.WebSocketHandler):
    listeners = []
    periodic_callback = None
    workers = None
    page_update_interval = 2000

    def open(self):
        app = self.application
        if not app.options.auto_refresh:
            self.write_message({})
            return

        if not self.listeners:
            if self.periodic_callback is None:
                cls = DashboardUpdateHandler
                cls.periodic_callback = PeriodicCallback(
                    partial(cls.on_update_time, app),
                    self.page_update_interval)
            if not self.periodic_callback._running:
                logger.debug('Starting a timer for dashboard updates')
                self.periodic_callback.start()
        self.listeners.append(self)

    def on_message(self, message):
        pass

    def on_close(self):
        if self in self.listeners:
            self.listeners.remove(self)
        if not self.listeners and self.periodic_callback:
            logger.debug('Stopping dashboard updates timer')
            self.periodic_callback.stop()

    @classmethod
    def on_update_time(cls, app):
        update = cls.dashboard_update(app)
        if update:
            for l in cls.listeners:
                l.write_message(update)

    @classmethod
    def dashboard_update(cls, app):
        state = app.events.state
        workers = OrderedDict()

        for name, worker in sorted(state.workers.items()):
            counter = state.counter[name]
            started = counter.get('task-started', 0)
            processed = counter.get('task-received', 0)
            failed = counter.get('task-failed', 0)
            succeeded = counter.get('task-succeeded', 0)
            retried = counter.get('task-retried', 0)
            active = started - succeeded - failed - retried
            if active < 0:
                active = 'N/A'

            workers[name] = dict(
                name=name,
                status=worker.alive,
                active=active,
                processed=processed,
                failed=failed,
                succeeded=succeeded,
                retried=retried,
                loadavg=getattr(worker, 'loadavg', None))
        return workers
