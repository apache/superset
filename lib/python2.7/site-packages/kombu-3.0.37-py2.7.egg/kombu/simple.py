"""
kombu.simple
============

Simple interface.

"""
from __future__ import absolute_import

import socket

from collections import deque

from . import entity
from . import messaging
from .connection import maybe_channel
from .five import Empty, monotonic

__all__ = ['SimpleQueue', 'SimpleBuffer']


class SimpleBase(object):
    Empty = Empty
    _consuming = False

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.close()

    def __init__(self, channel, producer, consumer, no_ack=False):
        self.channel = maybe_channel(channel)
        self.producer = producer
        self.consumer = consumer
        self.no_ack = no_ack
        self.queue = self.consumer.queues[0]
        self.buffer = deque()
        self.consumer.register_callback(self._receive)

    def get(self, block=True, timeout=None):
        if not block:
            return self.get_nowait()
        self._consume()
        elapsed = 0.0
        remaining = timeout
        while True:
            time_start = monotonic()
            if self.buffer:
                return self.buffer.popleft()
            try:
                self.channel.connection.client.drain_events(
                    timeout=timeout and remaining)
            except socket.timeout:
                raise self.Empty()
            elapsed += monotonic() - time_start
            remaining = timeout and timeout - elapsed or None

    def get_nowait(self):
        m = self.queue.get(no_ack=self.no_ack)
        if not m:
            raise self.Empty()
        return m

    def put(self, message, serializer=None, headers=None, compression=None,
            routing_key=None, **kwargs):
        self.producer.publish(message,
                              serializer=serializer,
                              routing_key=routing_key,
                              headers=headers,
                              compression=compression,
                              **kwargs)

    def clear(self):
        return self.consumer.purge()

    def qsize(self):
        _, size, _ = self.queue.queue_declare(passive=True)
        return size

    def close(self):
        self.consumer.cancel()

    def _receive(self, message_data, message):
        self.buffer.append(message)

    def _consume(self):
        if not self._consuming:
            self.consumer.consume(no_ack=self.no_ack)
            self._consuming = True

    def __len__(self):
        """`len(self) -> self.qsize()`"""
        return self.qsize()

    def __bool__(self):
        return True
    __nonzero__ = __bool__


class SimpleQueue(SimpleBase):
    no_ack = False
    queue_opts = {}
    exchange_opts = {'type': 'direct'}

    def __init__(self, channel, name, no_ack=None, queue_opts=None,
                 exchange_opts=None, serializer=None,
                 compression=None, **kwargs):
        queue = name
        queue_opts = dict(self.queue_opts, **queue_opts or {})
        exchange_opts = dict(self.exchange_opts, **exchange_opts or {})
        if no_ack is None:
            no_ack = self.no_ack
        if not isinstance(queue, entity.Queue):
            exchange = entity.Exchange(name, **exchange_opts)
            queue = entity.Queue(name, exchange, name, **queue_opts)
            routing_key = name
        else:
            name = queue.name
            exchange = queue.exchange
            routing_key = queue.routing_key
        producer = messaging.Producer(channel, exchange,
                                      serializer=serializer,
                                      routing_key=routing_key,
                                      compression=compression)
        consumer = messaging.Consumer(channel, queue)
        super(SimpleQueue, self).__init__(channel, producer,
                                          consumer, no_ack, **kwargs)


class SimpleBuffer(SimpleQueue):
    no_ack = True
    queue_opts = dict(durable=False,
                      auto_delete=True)
    exchange_opts = dict(durable=False,
                         delivery_mode='transient',
                         auto_delete=True)
