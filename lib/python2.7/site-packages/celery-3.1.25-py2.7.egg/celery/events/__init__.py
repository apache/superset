# -*- coding: utf-8 -*-
"""
    celery.events
    ~~~~~~~~~~~~~

    Events is a stream of messages sent for certain actions occurring
    in the worker (and clients if :setting:`CELERY_SEND_TASK_SENT_EVENT`
    is enabled), used for monitoring purposes.

"""
from __future__ import absolute_import

import os
import time
import threading
import warnings

from collections import deque
from contextlib import contextmanager
from copy import copy
from operator import itemgetter

from kombu import Exchange, Queue, Producer
from kombu.connection import maybe_channel
from kombu.mixins import ConsumerMixin
from kombu.utils import cached_property

from celery.app import app_or_default
from celery.utils import anon_nodename, uuid
from celery.utils.functional import dictfilter
from celery.utils.timeutils import adjust_timestamp, utcoffset, maybe_s_to_ms

__all__ = ['Events', 'Event', 'EventDispatcher', 'EventReceiver']

event_exchange = Exchange('celeryev', type='topic')

_TZGETTER = itemgetter('utcoffset', 'timestamp')

W_YAJL = """
anyjson is currently using the yajl library.
This json implementation is broken, it severely truncates floats
so timestamps will not work.

Please uninstall yajl or force anyjson to use a different library.
"""

CLIENT_CLOCK_SKEW = -1


def get_exchange(conn):
    ex = copy(event_exchange)
    if conn.transport.driver_type == 'redis':
        # quick hack for Issue #436
        ex.type = 'fanout'
    return ex


def Event(type, _fields=None, __dict__=dict, __now__=time.time, **fields):
    """Create an event.

    An event is a dictionary, the only required field is ``type``.
    A ``timestamp`` field will be set to the current time if not provided.

    """
    event = __dict__(_fields, **fields) if _fields else fields
    if 'timestamp' not in event:
        event.update(timestamp=__now__(), type=type)
    else:
        event['type'] = type
    return event


def group_from(type):
    """Get the group part of an event type name.

    E.g.::

        >>> group_from('task-sent')
        'task'

        >>> group_from('custom-my-event')
        'custom'

    """
    return type.split('-', 1)[0]


class EventDispatcher(object):
    """Dispatches event messages.

    :param connection: Connection to the broker.

    :keyword hostname: Hostname to identify ourselves as,
        by default uses the hostname returned by
        :func:`~celery.utils.anon_nodename`.

    :keyword groups: List of groups to send events for.  :meth:`send` will
        ignore send requests to groups not in this list.
        If this is :const:`None`, all events will be sent. Example groups
        include ``"task"`` and ``"worker"``.

    :keyword enabled: Set to :const:`False` to not actually publish any events,
        making :meth:`send` a noop operation.

    :keyword channel: Can be used instead of `connection` to specify
        an exact channel to use when sending events.

    :keyword buffer_while_offline: If enabled events will be buffered
       while the connection is down. :meth:`flush` must be called
       as soon as the connection is re-established.

    You need to :meth:`close` this after use.

    """
    DISABLED_TRANSPORTS = set(['sql'])

    app = None

    # set of callbacks to be called when :meth:`enabled`.
    on_enabled = None

    # set of callbacks to be called when :meth:`disabled`.
    on_disabled = None

    def __init__(self, connection=None, hostname=None, enabled=True,
                 channel=None, buffer_while_offline=True, app=None,
                 serializer=None, groups=None):
        self.app = app_or_default(app or self.app)
        self.connection = connection
        self.channel = channel
        self.hostname = hostname or anon_nodename()
        self.buffer_while_offline = buffer_while_offline
        self.mutex = threading.Lock()
        self.producer = None
        self._outbound_buffer = deque()
        self.serializer = serializer or self.app.conf.CELERY_EVENT_SERIALIZER
        self.on_enabled = set()
        self.on_disabled = set()
        self.groups = set(groups or [])
        self.tzoffset = [-time.timezone, -time.altzone]
        self.clock = self.app.clock
        if not connection and channel:
            self.connection = channel.connection.client
        self.enabled = enabled
        conninfo = self.connection or self.app.connection()
        self.exchange = get_exchange(conninfo)
        if conninfo.transport.driver_type in self.DISABLED_TRANSPORTS:
            self.enabled = False
        if self.enabled:
            self.enable()
        self.headers = {'hostname': self.hostname}
        self.pid = os.getpid()
        self.warn_if_yajl()

    def warn_if_yajl(self):
        import anyjson
        if anyjson.implementation.name == 'yajl':
            warnings.warn(UserWarning(W_YAJL))

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.close()

    def enable(self):
        self.producer = Producer(self.channel or self.connection,
                                 exchange=self.exchange,
                                 serializer=self.serializer)
        self.enabled = True
        for callback in self.on_enabled:
            callback()

    def disable(self):
        if self.enabled:
            self.enabled = False
            self.close()
            for callback in self.on_disabled:
                callback()

    def publish(self, type, fields, producer, retry=False,
                retry_policy=None, blind=False, utcoffset=utcoffset,
                Event=Event):
        """Publish event using a custom :class:`~kombu.Producer`
        instance.

        :param type: Event type name, with group separated by dash (`-`).
        :param fields: Dictionary of event fields, must be json serializable.
        :param producer: :class:`~kombu.Producer` instance to use,
            only the ``publish`` method will be called.
        :keyword retry: Retry in the event of connection failure.
        :keyword retry_policy: Dict of custom retry policy, see
            :meth:`~kombu.Connection.ensure`.
        :keyword blind: Don't set logical clock value (also do not forward
            the internal logical clock).
        :keyword Event: Event type used to create event,
            defaults to :func:`Event`.
        :keyword utcoffset: Function returning the current utcoffset in hours.

        """

        with self.mutex:
            clock = None if blind else self.clock.forward()
            event = Event(type, hostname=self.hostname, utcoffset=utcoffset(),
                          pid=self.pid, clock=clock, **fields)
            exchange = self.exchange
            producer.publish(
                event,
                routing_key=type.replace('-', '.'),
                exchange=exchange.name,
                retry=retry,
                retry_policy=retry_policy,
                declare=[exchange],
                serializer=self.serializer,
                headers=self.headers,
            )

    def send(self, type, blind=False, **fields):
        """Send event.

        :param type: Event type name, with group separated by dash (`-`).
        :keyword retry: Retry in the event of connection failure.
        :keyword retry_policy: Dict of custom retry policy, see
            :meth:`~kombu.Connection.ensure`.
        :keyword blind: Don't set logical clock value (also do not forward
            the internal logical clock).
        :keyword Event: Event type used to create event,
            defaults to :func:`Event`.
        :keyword utcoffset: Function returning the current utcoffset in hours.
        :keyword \*\*fields: Event fields, must be json serializable.

        """
        if self.enabled:
            groups = self.groups
            if groups and group_from(type) not in groups:
                return
            try:
                self.publish(type, fields, self.producer, blind)
            except Exception as exc:
                if not self.buffer_while_offline:
                    raise
                self._outbound_buffer.append((type, fields, exc))

    def flush(self):
        """Flushes the outbound buffer."""
        while self._outbound_buffer:
            try:
                type, fields, _ = self._outbound_buffer.popleft()
            except IndexError:
                return
            self.send(type, **fields)

    def extend_buffer(self, other):
        """Copies the outbound buffer of another instance."""
        self._outbound_buffer.extend(other._outbound_buffer)

    def close(self):
        """Close the event dispatcher."""
        self.mutex.locked() and self.mutex.release()
        self.producer = None

    def _get_publisher(self):
        return self.producer

    def _set_publisher(self, producer):
        self.producer = producer
    publisher = property(_get_publisher, _set_publisher)  # XXX compat


class EventReceiver(ConsumerMixin):
    """Capture events.

    :param connection: Connection to the broker.
    :keyword handlers: Event handlers.

    :attr:`handlers` is a dict of event types and their handlers,
    the special handler `"*"` captures all events that doesn't have a
    handler.

    """
    app = None

    def __init__(self, channel, handlers=None, routing_key='#',
                 node_id=None, app=None, queue_prefix='celeryev',
                 accept=None):
        self.app = app_or_default(app or self.app)
        self.channel = maybe_channel(channel)
        self.handlers = {} if handlers is None else handlers
        self.routing_key = routing_key
        self.node_id = node_id or uuid()
        self.queue_prefix = queue_prefix
        self.exchange = get_exchange(self.connection or self.app.connection())
        self.queue = Queue('.'.join([self.queue_prefix, self.node_id]),
                           exchange=self.exchange,
                           routing_key=self.routing_key,
                           auto_delete=True,
                           durable=False,
                           queue_arguments=self._get_queue_arguments())
        self.clock = self.app.clock
        self.adjust_clock = self.clock.adjust
        self.forward_clock = self.clock.forward
        if accept is None:
            accept = set([self.app.conf.CELERY_EVENT_SERIALIZER, 'json'])
        self.accept = accept

    def _get_queue_arguments(self):
        conf = self.app.conf
        return dictfilter({
            'x-message-ttl': maybe_s_to_ms(conf.CELERY_EVENT_QUEUE_TTL),
            'x-expires': maybe_s_to_ms(conf.CELERY_EVENT_QUEUE_EXPIRES),
        })

    def process(self, type, event):
        """Process the received event by dispatching it to the appropriate
        handler."""
        handler = self.handlers.get(type) or self.handlers.get('*')
        handler and handler(event)

    def get_consumers(self, Consumer, channel):
        return [Consumer(queues=[self.queue],
                         callbacks=[self._receive], no_ack=True,
                         accept=self.accept)]

    def on_consume_ready(self, connection, channel, consumers,
                         wakeup=True, **kwargs):
        if wakeup:
            self.wakeup_workers(channel=channel)

    def itercapture(self, limit=None, timeout=None, wakeup=True):
        return self.consume(limit=limit, timeout=timeout, wakeup=wakeup)

    def capture(self, limit=None, timeout=None, wakeup=True):
        """Open up a consumer capturing events.

        This has to run in the main process, and it will never stop
        unless :attr:`EventDispatcher.should_stop` is set to True, or
        forced via :exc:`KeyboardInterrupt` or :exc:`SystemExit`.

        """
        return list(self.consume(limit=limit, timeout=timeout, wakeup=wakeup))

    def wakeup_workers(self, channel=None):
        self.app.control.broadcast('heartbeat',
                                   connection=self.connection,
                                   channel=channel)

    def event_from_message(self, body, localize=True,
                           now=time.time, tzfields=_TZGETTER,
                           adjust_timestamp=adjust_timestamp,
                           CLIENT_CLOCK_SKEW=CLIENT_CLOCK_SKEW):
        type = body['type']
        if type == 'task-sent':
            # clients never sync so cannot use their clock value
            _c = body['clock'] = (self.clock.value or 1) + CLIENT_CLOCK_SKEW
            self.adjust_clock(_c)
        else:
            try:
                clock = body['clock']
            except KeyError:
                body['clock'] = self.forward_clock()
            else:
                self.adjust_clock(clock)

        if localize:
            try:
                offset, timestamp = tzfields(body)
            except KeyError:
                pass
            else:
                body['timestamp'] = adjust_timestamp(timestamp, offset)
        body['local_received'] = now()
        return type, body

    def _receive(self, body, message):
        self.process(*self.event_from_message(body))

    @property
    def connection(self):
        return self.channel.connection.client if self.channel else None


class Events(object):

    def __init__(self, app=None):
        self.app = app

    @cached_property
    def Receiver(self):
        return self.app.subclass_with_self(EventReceiver,
                                           reverse='events.Receiver')

    @cached_property
    def Dispatcher(self):
        return self.app.subclass_with_self(EventDispatcher,
                                           reverse='events.Dispatcher')

    @cached_property
    def State(self):
        return self.app.subclass_with_self('celery.events.state:State',
                                           reverse='events.State')

    @contextmanager
    def default_dispatcher(self, hostname=None, enabled=True,
                           buffer_while_offline=False):
        with self.app.amqp.producer_pool.acquire(block=True) as prod:
            with self.Dispatcher(prod.connection, hostname, enabled,
                                 prod.channel, buffer_while_offline) as d:
                yield d
