"""
kombu.transport.pyro
======================

Pyro transport.

Requires the :mod:`Pyro4` library to be installed.

"""
from __future__ import absolute_import

import sys

from kombu.five import reraise
from kombu.utils import cached_property

from . import virtual

try:
    import Pyro4 as pyro
    from Pyro4.errors import NamingError
except ImportError:          # pragma: no cover
    pyro = NamingError = None  # noqa

DEFAULT_PORT = 9090
E_LOOKUP = """\
Unable to locate pyro nameserver {0.virtual_host} on host {0.hostname}\
"""


class Channel(virtual.Channel):

    def queues(self):
        return self.shared_queues.get_queue_names()

    def _new_queue(self, queue, **kwargs):
        if queue not in self.queues():
            self.shared_queues.new_queue(queue)

    def _get(self, queue, timeout=None):
        queue = self._queue_for(queue)
        msg = self.shared_queues._get(queue)
        return msg

    def _queue_for(self, queue):
        if queue not in self.queues():
            self.shared_queues.new_queue(queue)
        return queue

    def _put(self, queue, message, **kwargs):
        queue = self._queue_for(queue)
        self.shared_queues._put(queue, message)

    def _size(self, queue):
        return self.shared_queues._size(queue)

    def _delete(self, queue, *args):
        self.shared_queues._delete(queue)

    def _purge(self, queue):
        return self.shared_queues._purge(queue)

    def after_reply_message_received(self, queue):
        pass

    @cached_property
    def shared_queues(self):
        return self.connection.shared_queues


class Transport(virtual.Transport):
    Channel = Channel

    #: memory backend state is global.
    state = virtual.BrokerState()

    default_port = DEFAULT_PORT

    driver_type = driver_name = 'pyro'

    def _open(self):
        conninfo = self.client
        pyro.config.HMAC_KEY = conninfo.virtual_host
        try:
            nameserver = pyro.locateNS(host=conninfo.hostname,
                                       port=self.default_port)
            # name of registered pyro object
            uri = nameserver.lookup(conninfo.virtual_host)
            return pyro.Proxy(uri)
        except NamingError:
            reraise(NamingError, NamingError(E_LOOKUP.format(conninfo)),
                    sys.exc_info()[2])

    def driver_version(self):
        return pyro.__version__

    @cached_property
    def shared_queues(self):
        return self._open()
