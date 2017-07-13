"""
kombu.common
============

Common Utilities.

"""
from __future__ import absolute_import

import os
import socket
import threading

from collections import deque
from contextlib import contextmanager
from functools import partial
from itertools import count
from uuid import uuid4, uuid3, NAMESPACE_OID

from amqp import RecoverableConnectionError

from .entity import Exchange, Queue
from .five import range
from .log import get_logger
from .serialization import registry as serializers
from .utils import uuid

try:
    from _thread import get_ident
except ImportError:                             # pragma: no cover
    try:                                        # noqa
        from thread import get_ident            # noqa
    except ImportError:                         # pragma: no cover
        from dummy_thread import get_ident      # noqa

__all__ = ['Broadcast', 'maybe_declare', 'uuid',
           'itermessages', 'send_reply',
           'collect_replies', 'insured', 'drain_consumer',
           'eventloop']

#: Prefetch count can't exceed short.
PREFETCH_COUNT_MAX = 0xFFFF

logger = get_logger(__name__)

_node_id = None


def get_node_id():
    global _node_id
    if _node_id is None:
        _node_id = uuid4().int
    return _node_id


def generate_oid(node_id, process_id, thread_id, instance):
    ent = '%x-%x-%x-%x' % (node_id, process_id, thread_id, id(instance))
    return str(uuid3(NAMESPACE_OID, ent))


def oid_from(instance):
    return generate_oid(get_node_id(), os.getpid(), get_ident(), instance)


class Broadcast(Queue):
    """Convenience class used to define broadcast queues.

    Every queue instance will have a unique name,
    and both the queue and exchange is configured with auto deletion.

    :keyword name: This is used as the name of the exchange.
    :keyword queue: By default a unique id is used for the queue
       name for every consumer.  You can specify a custom queue
       name here.
    :keyword \*\*kwargs: See :class:`~kombu.Queue` for a list
        of additional keyword arguments supported.

    """
    attrs = Queue.attrs + (('queue', None),)

    def __init__(self, name=None, queue=None, auto_delete=True,
                 exchange=None, alias=None, **kwargs):
        queue = queue or 'bcast.%s' % (uuid(),)
        return super(Broadcast, self).__init__(
            alias=alias or name,
            queue=queue,
            name=queue,
            auto_delete=auto_delete,
            exchange=(exchange if exchange is not None
                      else Exchange(name, type='fanout')),
            **kwargs
        )


def declaration_cached(entity, channel):
    return entity in channel.connection.client.declared_entities


def maybe_declare(entity, channel=None, retry=False, **retry_policy):
    is_bound = entity.is_bound

    if not is_bound:
        assert channel
        entity = entity.bind(channel)

    if channel is None:
        assert is_bound
        channel = entity.channel

    declared = ident = None
    if channel.connection and entity.can_cache_declaration:
        declared = channel.connection.client.declared_entities
        ident = hash(entity)
        if ident in declared:
            return False

    if retry:
        return _imaybe_declare(entity, declared, ident,
                               channel, **retry_policy)
    return _maybe_declare(entity, declared, ident, channel)


def _maybe_declare(entity, declared, ident, channel):
    channel = channel or entity.channel
    if not channel.connection:
        raise RecoverableConnectionError('channel disconnected')
    entity.declare()
    if declared is not None and ident:
        declared.add(ident)
    return True


def _imaybe_declare(entity, declared, ident, channel, **retry_policy):
    return entity.channel.connection.client.ensure(
        entity, _maybe_declare, **retry_policy)(
            entity, declared, ident, channel)


def drain_consumer(consumer, limit=1, timeout=None, callbacks=None):
    acc = deque()

    def on_message(body, message):
        acc.append((body, message))

    consumer.callbacks = [on_message] + (callbacks or [])

    with consumer:
        for _ in eventloop(consumer.channel.connection.client,
                           limit=limit, timeout=timeout, ignore_timeouts=True):
            try:
                yield acc.popleft()
            except IndexError:
                pass


def itermessages(conn, channel, queue, limit=1, timeout=None,
                 callbacks=None, **kwargs):
    return drain_consumer(
        conn.Consumer(queues=[queue], channel=channel, **kwargs),
        limit=limit, timeout=timeout, callbacks=callbacks,
    )


def eventloop(conn, limit=None, timeout=None, ignore_timeouts=False):
    """Best practice generator wrapper around ``Connection.drain_events``.

    Able to drain events forever, with a limit, and optionally ignoring
    timeout errors (a timeout of 1 is often used in environments where
    the socket can get "stuck", and is a best practice for Kombu consumers).

    **Examples**

    ``eventloop`` is a generator::

        from kombu.common import eventloop

        def run(connection):
            it = eventloop(connection, timeout=1, ignore_timeouts=True)
            next(it)   # one event consumed, or timed out.

            for _ in eventloop(connection, timeout=1, ignore_timeouts=True):
                pass  # loop forever.

    It also takes an optional limit parameter, and timeout errors
    are propagated by default::

        for _ in eventloop(connection, limit=1, timeout=1):
            pass

    .. seealso::

        :func:`itermessages`, which is an event loop bound to one or more
        consumers, that yields any messages received.

    """
    for i in limit and range(limit) or count():
        try:
            yield conn.drain_events(timeout=timeout)
        except socket.timeout:
            if timeout and not ignore_timeouts:  # pragma: no cover
                raise


def send_reply(exchange, req, msg,
               producer=None, retry=False, retry_policy=None, **props):
    """Send reply for request.

    :param exchange: Reply exchange
    :param req: Original request, a message with a ``reply_to`` property.
    :param producer: Producer instance
    :param retry: If true must retry according to ``reply_policy`` argument.
    :param retry_policy: Retry settings.
    :param props: Extra properties

    """

    producer.publish(
        msg, exchange=exchange,
        retry=retry, retry_policy=retry_policy,
        **dict({'routing_key': req.properties['reply_to'],
                'correlation_id': req.properties.get('correlation_id'),
                'serializer': serializers.type_to_name[req.content_type],
                'content_encoding': req.content_encoding}, **props)
    )


def collect_replies(conn, channel, queue, *args, **kwargs):
    """Generator collecting replies from ``queue``"""
    no_ack = kwargs.setdefault('no_ack', True)
    received = False
    try:
        for body, message in itermessages(conn, channel, queue,
                                          *args, **kwargs):
            if not no_ack:
                message.ack()
            received = True
            yield body
    finally:
        if received:
            channel.after_reply_message_received(queue.name)


def _ensure_errback(exc, interval):
    logger.error(
        'Connection error: %r. Retry in %ss\n', exc, interval,
        exc_info=True,
    )


@contextmanager
def _ignore_errors(conn):
    try:
        yield
    except conn.connection_errors + conn.channel_errors:
        pass


def ignore_errors(conn, fun=None, *args, **kwargs):
    """Ignore connection and channel errors.

    The first argument must be a connection object, or any other object
    with ``connection_error`` and ``channel_error`` attributes.

    Can be used as a function:

    .. code-block:: python

        def example(connection):
            ignore_errors(connection, consumer.channel.close)

    or as a context manager:

    .. code-block:: python

        def example(connection):
            with ignore_errors(connection):
                consumer.channel.close()


    .. note::

        Connection and channel errors should be properly handled,
        and not ignored.  Using this function is only acceptable in a cleanup
        phase, like when a connection is lost or at shutdown.

    """
    if fun:
        with _ignore_errors(conn):
            return fun(*args, **kwargs)
    return _ignore_errors(conn)


def revive_connection(connection, channel, on_revive=None):
    if on_revive:
        on_revive(channel)


def insured(pool, fun, args, kwargs, errback=None, on_revive=None, **opts):
    """Ensures function performing broker commands completes
    despite intermittent connection failures."""
    errback = errback or _ensure_errback

    with pool.acquire(block=True) as conn:
        conn.ensure_connection(errback=errback)
        # we cache the channel for subsequent calls, this has to be
        # reset on revival.
        channel = conn.default_channel
        revive = partial(revive_connection, conn, on_revive=on_revive)
        insured = conn.autoretry(fun, channel, errback=errback,
                                 on_revive=revive, **opts)
        retval, _ = insured(*args, **dict(kwargs, connection=conn))
        return retval


class QoS(object):
    """Thread safe increment/decrement of a channels prefetch_count.

    :param callback: Function used to set new prefetch count,
        e.g. ``consumer.qos`` or ``channel.basic_qos``.  Will be called
        with a single ``prefetch_count`` keyword argument.
    :param initial_value: Initial prefetch count value.

    **Example usage**

    .. code-block:: python

        >>> from kombu import Consumer, Connection
        >>> connection = Connection('amqp://')
        >>> consumer = Consumer(connection)
        >>> qos = QoS(consumer.qos, initial_prefetch_count=2)
        >>> qos.update()  # set initial

        >>> qos.value
        2

        >>> def in_some_thread():
        ...     qos.increment_eventually()

        >>> def in_some_other_thread():
        ...     qos.decrement_eventually()

        >>> while 1:
        ...    if qos.prev != qos.value:
        ...        qos.update()  # prefetch changed so update.

    It can be used with any function supporting a ``prefetch_count`` keyword
    argument::

        >>> channel = connection.channel()
        >>> QoS(channel.basic_qos, 10)


        >>> def set_qos(prefetch_count):
        ...     print('prefetch count now: %r' % (prefetch_count, ))
        >>> QoS(set_qos, 10)

    """
    prev = None

    def __init__(self, callback, initial_value):
        self.callback = callback
        self._mutex = threading.RLock()
        self.value = initial_value or 0

    def increment_eventually(self, n=1):
        """Increment the value, but do not update the channels QoS.

        The MainThread will be responsible for calling :meth:`update`
        when necessary.

        """
        with self._mutex:
            if self.value:
                self.value = self.value + max(n, 0)
        return self.value

    def decrement_eventually(self, n=1):
        """Decrement the value, but do not update the channels QoS.

        The MainThread will be responsible for calling :meth:`update`
        when necessary.

        """
        with self._mutex:
            if self.value:
                self.value -= n
                if self.value < 1:
                    self.value = 1
        return self.value

    def set(self, pcount):
        """Set channel prefetch_count setting."""
        if pcount != self.prev:
            new_value = pcount
            if pcount > PREFETCH_COUNT_MAX:
                logger.warn('QoS: Disabled: prefetch_count exceeds %r',
                            PREFETCH_COUNT_MAX)
                new_value = 0
            logger.debug('basic.qos: prefetch_count->%s', new_value)
            self.callback(prefetch_count=new_value)
            self.prev = pcount
        return pcount

    def update(self):
        """Update prefetch count with current value."""
        with self._mutex:
            return self.set(self.value)
