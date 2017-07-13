"""
kombu.transport.memory
======================

In-memory transport.

"""
from __future__ import absolute_import

from kombu.five import Queue, values

from . import virtual


class Channel(virtual.Channel):
    queues = {}
    do_restore = False
    supports_fanout = True

    def _has_queue(self, queue, **kwargs):
        return queue in self.queues

    def _new_queue(self, queue, **kwargs):
        if queue not in self.queues:
            self.queues[queue] = Queue()

    def _get(self, queue, timeout=None):
        return self._queue_for(queue).get(block=False)

    def _queue_for(self, queue):
        if queue not in self.queues:
            self.queues[queue] = Queue()
        return self.queues[queue]

    def _queue_bind(self, *args):
        pass

    def _put_fanout(self, exchange, message, routing_key=None, **kwargs):
        for queue in self._lookup(exchange, routing_key):
            self._queue_for(queue).put(message)

    def _put(self, queue, message, **kwargs):
        self._queue_for(queue).put(message)

    def _size(self, queue):
        return self._queue_for(queue).qsize()

    def _delete(self, queue, *args):
        self.queues.pop(queue, None)

    def _purge(self, queue):
        q = self._queue_for(queue)
        size = q.qsize()
        q.queue.clear()
        return size

    def close(self):
        super(Channel, self).close()
        for queue in values(self.queues):
            queue.empty()
        self.queues = {}

    def after_reply_message_received(self, queue):
        pass


class Transport(virtual.Transport):
    Channel = Channel

    #: memory backend state is global.
    state = virtual.BrokerState()

    driver_type = 'memory'
    driver_name = 'memory'

    def driver_version(self):
        return 'N/A'
