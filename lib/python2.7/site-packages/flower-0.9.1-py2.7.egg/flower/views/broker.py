from __future__ import absolute_import

import logging

from tornado import web
from tornado import gen

from ..views import BaseHandler
from ..utils.broker import Broker
from ..api.control import ControlHandler


logger = logging.getLogger(__name__)


class BrokerView(BaseHandler):
    @web.authenticated
    @gen.coroutine
    def get(self):
        app = self.application
        broker_options = self.capp.conf.BROKER_TRANSPORT_OPTIONS

        http_api = None
        if app.transport == 'amqp' and app.options.broker_api:
            http_api = app.options.broker_api

        try:
            broker = Broker(app.capp.connection().as_uri(include_password=True),
                            http_api=http_api, broker_options=broker_options)
        except NotImplementedError:
            raise web.HTTPError(
                404, "'%s' broker is not supported" % app.transport)

        try:
            queue_names = ControlHandler.get_active_queue_names()
            if not queue_names:
                queue_names = set([self.capp.conf.CELERY_DEFAULT_QUEUE])

            queues = yield broker.queues(sorted(queue_names))
        except Exception as e:
            raise web.HTTPError(404, "Unable to get queues: '%s'" % e)

        self.render("broker.html",
                    broker_url=app.capp.connection().as_uri(),
                    queues=queues)
