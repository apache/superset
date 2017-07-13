"""
kombu.messaging
===============

Sending and receiving messages.

"""
from __future__ import absolute_import

import numbers

from itertools import count

from .common import maybe_declare
from .compression import compress
from .connection import maybe_channel, is_connection
from .entity import Exchange, Queue, DELIVERY_MODES
from .exceptions import ContentDisallowed
from .five import text_t, values
from .serialization import dumps, prepare_accept_content
from .utils import ChannelPromise, maybe_list

__all__ = ['Exchange', 'Queue', 'Producer', 'Consumer']


class Producer(object):
    """Message Producer.

    :param channel: Connection or channel.
    :keyword exchange: Optional default exchange.
    :keyword routing_key: Optional default routing key.
    :keyword serializer: Default serializer. Default is `"json"`.
    :keyword compression: Default compression method. Default is no
        compression.
    :keyword auto_declare: Automatically declare the default exchange
      at instantiation. Default is :const:`True`.
    :keyword on_return: Callback to call for undeliverable messages,
        when the `mandatory` or `immediate` arguments to
        :meth:`publish` is used. This callback needs the following
        signature: `(exception, exchange, routing_key, message)`.
        Note that the producer needs to drain events to use this feature.

    """

    #: Default exchange
    exchange = None

    #: Default routing key.
    routing_key = ''

    #: Default serializer to use. Default is JSON.
    serializer = None

    #: Default compression method.  Disabled by default.
    compression = None

    #: By default the exchange is declared at instantiation.
    #: If you want to declare manually then you can set this
    #: to :const:`False`.
    auto_declare = True

    #: Basic return callback.
    on_return = None

    #: Set if channel argument was a Connection instance (using
    #: default_channel).
    __connection__ = None

    def __init__(self, channel, exchange=None, routing_key=None,
                 serializer=None, auto_declare=None, compression=None,
                 on_return=None):
        self._channel = channel
        self.exchange = exchange
        self.routing_key = routing_key or self.routing_key
        self.serializer = serializer or self.serializer
        self.compression = compression or self.compression
        self.on_return = on_return or self.on_return
        self._channel_promise = None
        if self.exchange is None:
            self.exchange = Exchange('')
        if auto_declare is not None:
            self.auto_declare = auto_declare

        if self._channel:
            self.revive(self._channel)

    def __repr__(self):
        return '<Producer: {0._channel}>'.format(self)

    def __reduce__(self):
        return self.__class__, self.__reduce_args__()

    def __reduce_args__(self):
        return (None, self.exchange, self.routing_key, self.serializer,
                self.auto_declare, self.compression)

    def declare(self):
        """Declare the exchange.

        This happens automatically at instantiation if
        :attr:`auto_declare` is enabled.

        """
        if self.exchange.name:
            self.exchange.declare()

    def maybe_declare(self, entity, retry=False, **retry_policy):
        """Declare the exchange if it hasn't already been declared
        during this session."""
        if entity:
            return maybe_declare(entity, self.channel, retry, **retry_policy)

    def publish(self, body, routing_key=None, delivery_mode=None,
                mandatory=False, immediate=False, priority=0,
                content_type=None, content_encoding=None, serializer=None,
                headers=None, compression=None, exchange=None, retry=False,
                retry_policy=None, declare=[], expiration=None, **properties):
        """Publish message to the specified exchange.

        :param body: Message body.
        :keyword routing_key: Message routing key.
        :keyword delivery_mode: See :attr:`delivery_mode`.
        :keyword mandatory: Currently not supported.
        :keyword immediate: Currently not supported.
        :keyword priority: Message priority. A number between 0 and 9.
        :keyword content_type: Content type. Default is auto-detect.
        :keyword content_encoding: Content encoding. Default is auto-detect.
        :keyword serializer: Serializer to use. Default is auto-detect.
        :keyword compression: Compression method to use.  Default is none.
        :keyword headers: Mapping of arbitrary headers to pass along
          with the message body.
        :keyword exchange: Override the exchange.  Note that this exchange
          must have been declared.
        :keyword declare: Optional list of required entities that must
            have been declared before publishing the message.  The entities
            will be declared using :func:`~kombu.common.maybe_declare`.
        :keyword retry: Retry publishing, or declaring entities if the
            connection is lost.
        :keyword retry_policy: Retry configuration, this is the keywords
            supported by :meth:`~kombu.Connection.ensure`.
        :keyword expiration: A TTL in seconds can be specified per message.
            Default is no expiration.
        :keyword \*\*properties: Additional message properties, see AMQP spec.

        """
        headers = {} if headers is None else headers
        retry_policy = {} if retry_policy is None else retry_policy
        routing_key = self.routing_key if routing_key is None else routing_key
        compression = self.compression if compression is None else compression
        exchange = exchange or self.exchange

        if isinstance(exchange, Exchange):
            delivery_mode = delivery_mode or exchange.delivery_mode
            exchange = exchange.name
        else:
            delivery_mode = delivery_mode or self.exchange.delivery_mode
        if not isinstance(delivery_mode, numbers.Integral):
            delivery_mode = DELIVERY_MODES[delivery_mode]
        properties['delivery_mode'] = delivery_mode
        if expiration is not None:
            properties['expiration'] = str(int(expiration*1000))

        body, content_type, content_encoding = self._prepare(
            body, serializer, content_type, content_encoding,
            compression, headers)

        publish = self._publish
        if retry:
            publish = self.connection.ensure(self, publish, **retry_policy)
        return publish(body, priority, content_type,
                       content_encoding, headers, properties,
                       routing_key, mandatory, immediate, exchange, declare)

    def _publish(self, body, priority, content_type, content_encoding,
                 headers, properties, routing_key, mandatory,
                 immediate, exchange, declare):
        channel = self.channel
        message = channel.prepare_message(
            body, priority, content_type,
            content_encoding, headers, properties,
        )
        if declare:
            maybe_declare = self.maybe_declare
            [maybe_declare(entity) for entity in declare]
        return channel.basic_publish(
            message,
            exchange=exchange, routing_key=routing_key,
            mandatory=mandatory, immediate=immediate,
        )

    def _get_channel(self):
        channel = self._channel
        if isinstance(channel, ChannelPromise):
            channel = self._channel = channel()
            self.exchange.revive(channel)
            if self.on_return:
                channel.events['basic_return'].add(self.on_return)
        return channel

    def _set_channel(self, channel):
        self._channel = channel
    channel = property(_get_channel, _set_channel)

    def revive(self, channel):
        """Revive the producer after connection loss."""
        if is_connection(channel):
            connection = channel
            self.__connection__ = connection
            channel = ChannelPromise(lambda: connection.default_channel)
        if isinstance(channel, ChannelPromise):
            self._channel = channel
            self.exchange = self.exchange(channel)
        else:
            # Channel already concrete
            self._channel = channel
            if self.on_return:
                self._channel.events['basic_return'].add(self.on_return)
            self.exchange = self.exchange(channel)
        if self.auto_declare:
            # auto_decare is not recommended as this will force
            # evaluation of the channel.
            self.declare()

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.release()

    def release(self):
        pass
    close = release

    def _prepare(self, body, serializer=None, content_type=None,
                 content_encoding=None, compression=None, headers=None):

        # No content_type? Then we're serializing the data internally.
        if not content_type:
            serializer = serializer or self.serializer
            (content_type, content_encoding,
             body) = dumps(body, serializer=serializer)
        else:
            # If the programmer doesn't want us to serialize,
            # make sure content_encoding is set.
            if isinstance(body, text_t):
                if not content_encoding:
                    content_encoding = 'utf-8'
                body = body.encode(content_encoding)

            # If they passed in a string, we can't know anything
            # about it. So assume it's binary data.
            elif not content_encoding:
                content_encoding = 'binary'

        if compression:
            body, headers['compression'] = compress(body, compression)

        return body, content_type, content_encoding

    @property
    def connection(self):
        try:
            return self.__connection__ or self.channel.connection.client
        except AttributeError:
            pass


class Consumer(object):
    """Message consumer.

    :param channel: see :attr:`channel`.
    :param queues: see :attr:`queues`.
    :keyword no_ack: see :attr:`no_ack`.
    :keyword auto_declare: see :attr:`auto_declare`
    :keyword callbacks: see :attr:`callbacks`.
    :keyword on_message: See :attr:`on_message`
    :keyword on_decode_error: see :attr:`on_decode_error`.

    """
    ContentDisallowed = ContentDisallowed

    #: The connection/channel to use for this consumer.
    channel = None

    #: A single :class:`~kombu.Queue`, or a list of queues to
    #: consume from.
    queues = None

    #: Flag for automatic message acknowledgment.
    #: If enabled the messages are automatically acknowledged by the
    #: broker.  This can increase performance but means that you
    #: have no control of when the message is removed.
    #:
    #: Disabled by default.
    no_ack = None

    #: By default all entities will be declared at instantiation, if you
    #: want to handle this manually you can set this to :const:`False`.
    auto_declare = True

    #: List of callbacks called in order when a message is received.
    #:
    #: The signature of the callbacks must take two arguments:
    #: `(body, message)`, which is the decoded message body and
    #: the `Message` instance (a subclass of
    #: :class:`~kombu.transport.base.Message`).
    callbacks = None

    #: Optional function called whenever a message is received.
    #:
    #: When defined this function will be called instead of the
    #: :meth:`receive` method, and :attr:`callbacks` will be disabled.
    #:
    #: So this can be used as an alternative to :attr:`callbacks` when
    #: you don't want the body to be automatically decoded.
    #: Note that the message will still be decompressed if the message
    #: has the ``compression`` header set.
    #:
    #: The signature of the callback must take a single argument,
    #: which is the raw message object (a subclass of
    #: :class:`~kombu.transport.base.Message`).
    #:
    #: Also note that the ``message.body`` attribute, which is the raw
    #: contents of the message body, may in some cases be a read-only
    #: :class:`buffer` object.
    on_message = None

    #: Callback called when a message can't be decoded.
    #:
    #: The signature of the callback must take two arguments: `(message,
    #: exc)`, which is the message that can't be decoded and the exception
    #: that occurred while trying to decode it.
    on_decode_error = None

    #: List of accepted content-types.
    #:
    #: An exception will be raised if the consumer receives
    #: a message with an untrusted content type.
    #: By default all content-types are accepted, but not if
    #: :func:`kombu.disable_untrusted_serializers` was called,
    #: in which case only json is allowed.
    accept = None

    _tags = count(1)   # global

    def __init__(self, channel, queues=None, no_ack=None, auto_declare=None,
                 callbacks=None, on_decode_error=None, on_message=None,
                 accept=None, tag_prefix=None):
        self.channel = channel
        self.queues = self.queues or [] if queues is None else queues
        self.no_ack = self.no_ack if no_ack is None else no_ack
        self.callbacks = (self.callbacks or [] if callbacks is None
                          else callbacks)
        self.on_message = on_message
        self.tag_prefix = tag_prefix
        self._active_tags = {}
        if auto_declare is not None:
            self.auto_declare = auto_declare
        if on_decode_error is not None:
            self.on_decode_error = on_decode_error
        self.accept = prepare_accept_content(accept)

        if self.channel:
            self.revive(self.channel)

    def revive(self, channel):
        """Revive consumer after connection loss."""
        self._active_tags.clear()
        channel = self.channel = maybe_channel(channel)
        self.queues = [queue(self.channel)
                       for queue in maybe_list(self.queues)]
        for queue in self.queues:
            queue.revive(channel)

        if self.auto_declare:
            self.declare()

    def declare(self):
        """Declare queues, exchanges and bindings.

        This is done automatically at instantiation if :attr:`auto_declare`
        is set.

        """
        for queue in self.queues:
            queue.declare()

    def register_callback(self, callback):
        """Register a new callback to be called when a message
        is received.

        The signature of the callback needs to accept two arguments:
        `(body, message)`, which is the decoded message body
        and the `Message` instance (a subclass of
        :class:`~kombu.transport.base.Message`.

        """
        self.callbacks.append(callback)

    def __enter__(self):
        self.consume()
        return self

    def __exit__(self, *exc_info):
        try:
            self.cancel()
        except Exception:
            pass

    def add_queue(self, queue):
        """Add a queue to the list of queues to consume from.

        This will not start consuming from the queue,
        for that you will have to call :meth:`consume` after.

        """
        queue = queue(self.channel)
        if self.auto_declare:
            queue.declare()
        self.queues.append(queue)
        return queue

    def add_queue_from_dict(self, queue, **options):
        """This method is deprecated.

        Instead please use::

            consumer.add_queue(Queue.from_dict(d))

        """
        return self.add_queue(Queue.from_dict(queue, **options))

    def consume(self, no_ack=None):
        """Start consuming messages.

        Can be called multiple times, but note that while it
        will consume from new queues added since the last call,
        it will not cancel consuming from removed queues (
        use :meth:`cancel_by_queue`).

        :param no_ack: See :attr:`no_ack`.

        """
        if self.queues:
            no_ack = self.no_ack if no_ack is None else no_ack

            H, T = self.queues[:-1], self.queues[-1]
            for queue in H:
                self._basic_consume(queue, no_ack=no_ack, nowait=True)
            self._basic_consume(T, no_ack=no_ack, nowait=False)

    def cancel(self):
        """End all active queue consumers.

        This does not affect already delivered messages, but it does
        mean the server will not send any more messages for this consumer.

        """
        cancel = self.channel.basic_cancel
        for tag in values(self._active_tags):
            cancel(tag)
        self._active_tags.clear()
    close = cancel

    def cancel_by_queue(self, queue):
        """Cancel consumer by queue name."""
        try:
            tag = self._active_tags.pop(queue)
        except KeyError:
            pass
        else:
            self.queues[:] = [q for q in self.queues if q.name != queue]
            self.channel.basic_cancel(tag)

    def consuming_from(self, queue):
        """Return :const:`True` if the consumer is currently
        consuming from queue'."""
        name = queue
        if isinstance(queue, Queue):
            name = queue.name
        return name in self._active_tags

    def purge(self):
        """Purge messages from all queues.

        .. warning::
            This will *delete all ready messages*, there is no
            undo operation.

        """
        return sum(queue.purge() for queue in self.queues)

    def flow(self, active):
        """Enable/disable flow from peer.

        This is a simple flow-control mechanism that a peer can use
        to avoid overflowing its queues or otherwise finding itself
        receiving more messages than it can process.

        The peer that receives a request to stop sending content
        will finish sending the current content (if any), and then wait
        until flow is reactivated.

        """
        self.channel.flow(active)

    def qos(self, prefetch_size=0, prefetch_count=0, apply_global=False):
        """Specify quality of service.

        The client can request that messages should be sent in
        advance so that when the client finishes processing a message,
        the following message is already held locally, rather than needing
        to be sent down the channel. Prefetching gives a performance
        improvement.

        The prefetch window is Ignored if the :attr:`no_ack` option is set.

        :param prefetch_size: Specify the prefetch window in octets.
          The server will send a message in advance if it is equal to
          or smaller in size than the available prefetch size (and
          also falls within other prefetch limits). May be set to zero,
          meaning "no specific limit", although other prefetch limits
          may still apply.

        :param prefetch_count: Specify the prefetch window in terms of
          whole messages.

        :param apply_global: Apply new settings globally on all channels.

        """
        return self.channel.basic_qos(prefetch_size,
                                      prefetch_count,
                                      apply_global)

    def recover(self, requeue=False):
        """Redeliver unacknowledged messages.

        Asks the broker to redeliver all unacknowledged messages
        on the specified channel.

        :keyword requeue: By default the messages will be redelivered
          to the original recipient. With `requeue` set to true, the
          server will attempt to requeue the message, potentially then
          delivering it to an alternative subscriber.

        """
        return self.channel.basic_recover(requeue=requeue)

    def receive(self, body, message):
        """Method called when a message is received.

        This dispatches to the registered :attr:`callbacks`.

        :param body: The decoded message body.
        :param message: The `Message` instance.

        :raises NotImplementedError: If no consumer callbacks have been
          registered.

        """
        callbacks = self.callbacks
        if not callbacks:
            raise NotImplementedError('Consumer does not have any callbacks')
        [callback(body, message) for callback in callbacks]

    def _basic_consume(self, queue, consumer_tag=None,
                       no_ack=no_ack, nowait=True):
        tag = self._active_tags.get(queue.name)
        if tag is None:
            tag = self._add_tag(queue, consumer_tag)
            queue.consume(tag, self._receive_callback,
                          no_ack=no_ack, nowait=nowait)
        return tag

    def _add_tag(self, queue, consumer_tag=None):
        tag = consumer_tag or '{0}{1}'.format(
            self.tag_prefix, next(self._tags))
        self._active_tags[queue.name] = tag
        return tag

    def _receive_callback(self, message):
        accept = self.accept
        on_m, channel, decoded = self.on_message, self.channel, None
        try:
            m2p = getattr(channel, 'message_to_python', None)
            if m2p:
                message = m2p(message)
            if accept is not None:
                message.accept = accept
            if message.errors:
                return message._reraise_error(self.on_decode_error)
            decoded = None if on_m else message.decode()
        except Exception as exc:
            if not self.on_decode_error:
                raise
            self.on_decode_error(message, exc)
        else:
            return on_m(message) if on_m else self.receive(decoded, message)

    def __repr__(self):
        return '<Consumer: {0.queues}>'.format(self)

    @property
    def connection(self):
        try:
            return self.channel.connection.client
        except AttributeError:
            pass
