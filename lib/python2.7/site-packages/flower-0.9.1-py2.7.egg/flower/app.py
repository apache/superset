from __future__ import absolute_import

import logging

from functools import partial
from concurrent.futures import ThreadPoolExecutor

import celery
import tornado.web

from tornado import ioloop
from tornado.httpserver import HTTPServer

from .api import control
from .urls import handlers
from .events import Events
from .options import default_options


logger = logging.getLogger(__name__)


class Flower(tornado.web.Application):
    pool_executor_cls = ThreadPoolExecutor
    max_workers = 4

    def __init__(self, options=None, capp=None, events=None,
                 io_loop=None, **kwargs):
        kwargs.update(handlers=handlers)
        super(Flower, self).__init__(**kwargs)
        self.options = options or default_options
        self.io_loop = io_loop or ioloop.IOLoop.instance()
        self.ssl_options = kwargs.get('ssl_options', None)

        self.capp = capp or celery.Celery()
        self.events = events or Events(
            self.capp, db=self.options.db,
            persistent=self.options.persistent,
            enable_events=self.options.enable_events,
            io_loop=self.io_loop,
            max_workers_in_memory=self.options.max_workers,
            max_tasks_in_memory=self.options.max_tasks)
        self.started = False

    def start(self):
        self.pool = self.pool_executor_cls(max_workers=self.max_workers)
        self.events.start()

        if not self.options.unix_socket:
            self.listen(self.options.port, address=self.options.address,
                        ssl_options=self.ssl_options,
                        xheaders=self.options.xheaders)
        else:
            from tornado.netutil import bind_unix_socket
            server = HTTPServer(self)
            socket = bind_unix_socket(self.options.unix_socket)
            server.add_socket(socket)

        self.io_loop.add_future(
            control.ControlHandler.update_workers(app=self),
            callback=lambda x: logger.debug(
                'Successfully updated worker cache'))
        self.started = True
        self.io_loop.start()

    def stop(self):
        if self.started:
            self.events.stop()
            self.pool.shutdown(wait=False)
            self.started = False

    def delay(self, method, *args, **kwargs):
        return self.pool.submit(partial(method, *args, **kwargs))

    @property
    def transport(self):
        return getattr(self.capp.connection().transport,
                       'driver_type', None)
