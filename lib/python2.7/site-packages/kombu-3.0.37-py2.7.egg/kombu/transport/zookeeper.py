"""
kombu.transport.zookeeper
=========================

Zookeeper transport.

:copyright: (c) 2010 - 2013 by Mahendra M.
:license: BSD, see LICENSE for more details.

**Synopsis**

Connects to a zookeeper node as <server>:<port>/<vhost>
The <vhost> becomes the base for all the other znodes. So we can use
it like a vhost.

This uses the built-in kazoo recipe for queues

**References**

- https://zookeeper.apache.org/doc/trunk/recipes.html#sc_recipes_Queues
- https://kazoo.readthedocs.io/en/latest/api/recipe/queue.html

**Limitations**
This queue does not offer reliable consumption. An entry is removed from
the queue prior to being processed. So if an error occurs, the consumer
has to re-queue the item or it will be lost.
"""
from __future__ import absolute_import

import os
import socket

from anyjson import loads, dumps

from kombu.five import Empty
from kombu.utils.encoding import bytes_to_str

from . import virtual

MAX_PRIORITY = 9

try:
    import kazoo
    from kazoo.client import KazooClient
    from kazoo.recipe.queue import Queue

    KZ_CONNECTION_ERRORS = (
        kazoo.exceptions.SystemErrorException,
        kazoo.exceptions.ConnectionLossException,
        kazoo.exceptions.MarshallingErrorException,
        kazoo.exceptions.UnimplementedException,
        kazoo.exceptions.OperationTimeoutException,
        kazoo.exceptions.NoAuthException,
        kazoo.exceptions.InvalidACLException,
        kazoo.exceptions.AuthFailedException,
        kazoo.exceptions.SessionExpiredException,
    )

    KZ_CHANNEL_ERRORS = (
        kazoo.exceptions.RuntimeInconsistencyException,
        kazoo.exceptions.DataInconsistencyException,
        kazoo.exceptions.BadArgumentsException,
        kazoo.exceptions.MarshallingErrorException,
        kazoo.exceptions.UnimplementedException,
        kazoo.exceptions.OperationTimeoutException,
        kazoo.exceptions.ApiErrorException,
        kazoo.exceptions.NoNodeException,
        kazoo.exceptions.NoAuthException,
        kazoo.exceptions.NodeExistsException,
        kazoo.exceptions.NoChildrenForEphemeralsException,
        kazoo.exceptions.NotEmptyException,
        kazoo.exceptions.SessionExpiredException,
        kazoo.exceptions.InvalidCallbackException,
        socket.error,
    )
except ImportError:
    kazoo = None                                    # noqa
    KZ_CONNECTION_ERRORS = KZ_CHANNEL_ERRORS = ()   # noqa

DEFAULT_PORT = 2181

__author__ = 'Mahendra M <mahendra.m@gmail.com>'


class Channel(virtual.Channel):

    _client = None
    _queues = {}

    def _get_path(self, queue_name):
        return os.path.join(self.vhost, queue_name)

    def _get_queue(self, queue_name):
        queue = self._queues.get(queue_name, None)

        if queue is None:
            queue = Queue(self.client, self._get_path(queue_name))
            self._queues[queue_name] = queue

            # Ensure that the queue is created
            len(queue)

        return queue

    def _put(self, queue, message, **kwargs):
        try:
            priority = message['properties']['delivery_info']['priority']
        except KeyError:
            priority = 0

        queue = self._get_queue(queue)
        queue.put(dumps(message), priority=(MAX_PRIORITY - priority))

    def _get(self, queue):
        queue = self._get_queue(queue)
        msg = queue.get()

        if msg is None:
            raise Empty()

        return loads(bytes_to_str(msg))

    def _purge(self, queue):
        count = 0
        queue = self._get_queue(queue)

        while True:
            msg = queue.get()
            if msg is None:
                break
            count += 1

        return count

    def _delete(self, queue, *args, **kwargs):
        if self._has_queue(queue):
            self._purge(queue)
            self.client.delete(self._get_path(queue))

    def _size(self, queue):
        queue = self._get_queue(queue)
        return len(queue)

    def _new_queue(self, queue, **kwargs):
        if not self._has_queue(queue):
            queue = self._get_queue(queue)

    def _has_queue(self, queue):
        return self.client.exists(self._get_path(queue)) is not None

    def _open(self):
        conninfo = self.connection.client
        port = conninfo.port or DEFAULT_PORT
        conn_str = '%s:%s' % (conninfo.hostname, port)
        self.vhost = os.path.join('/', conninfo.virtual_host[0:-1])

        conn = KazooClient(conn_str)
        conn.start()
        return conn

    @property
    def client(self):
        if self._client is None:
            self._client = self._open()
        return self._client


class Transport(virtual.Transport):
    Channel = Channel
    polling_interval = 1
    default_port = DEFAULT_PORT
    connection_errors = (
        virtual.Transport.connection_errors + KZ_CONNECTION_ERRORS
    )
    channel_errors = (
        virtual.Transport.channel_errors + KZ_CHANNEL_ERRORS
    )
    driver_type = 'zookeeper'
    driver_name = 'kazoo'

    def __init__(self, *args, **kwargs):
        if kazoo is None:
            raise ImportError('The kazoo library is not installed')

        super(Transport, self).__init__(*args, **kwargs)

    def driver_version(self):
        return kazoo.__version__
