"""
kombu.entity
================

Exchange and Queue declarations.

"""
from __future__ import absolute_import

from .abstract import MaybeChannelBound, Object
from .exceptions import ContentDisallowed
from .five import string_t
from .serialization import prepare_accept_content

TRANSIENT_DELIVERY_MODE = 1
PERSISTENT_DELIVERY_MODE = 2
DELIVERY_MODES = {'transient': TRANSIENT_DELIVERY_MODE,
                  'persistent': PERSISTENT_DELIVERY_MODE}

__all__ = ['Exchange', 'Queue', 'binding']


def _reprstr(s):
    s = repr(s)
    if isinstance(s, string_t) and s.startswith("u'"):
        return s[2:-1]
    return s[1:-1]


def pretty_bindings(bindings):
    return '[%s]' % (', '.join(map(str, bindings)))


class Exchange(MaybeChannelBound):
    """An Exchange declaration.

    :keyword name: See :attr:`name`.
    :keyword type: See :attr:`type`.
    :keyword channel: See :attr:`channel`.
    :keyword durable: See :attr:`durable`.
    :keyword auto_delete: See :attr:`auto_delete`.
    :keyword delivery_mode: See :attr:`delivery_mode`.
    :keyword arguments: See :attr:`arguments`.

    .. attribute:: name

        Name of the exchange. Default is no name (the default exchange).

    .. attribute:: type

        *This description of AMQP exchange types was shamelessly stolen
        from the blog post `AMQP in 10 minutes: Part 4`_ by
        Rajith Attapattu. Reading this article is recommended if you're
        new to amqp.*

        "AMQP defines four default exchange types (routing algorithms) that
        covers most of the common messaging use cases. An AMQP broker can
        also define additional exchange types, so see your broker
        manual for more information about available exchange types.

            * `direct` (*default*)

                Direct match between the routing key in the message, and the
                routing criteria used when a queue is bound to this exchange.

            * `topic`

                Wildcard match between the routing key and the routing pattern
                specified in the exchange/queue binding. The routing key is
                treated as zero or more words delimited by `"."` and
                supports special wildcard characters. `"*"` matches a
                single word and `"#"` matches zero or more words.

            * `fanout`

                Queues are bound to this exchange with no arguments. Hence any
                message sent to this exchange will be forwarded to all queues
                bound to this exchange.

            * `headers`

                Queues are bound to this exchange with a table of arguments
                containing headers and values (optional). A special argument
                named "x-match" determines the matching algorithm, where
                `"all"` implies an `AND` (all pairs must match) and
                `"any"` implies `OR` (at least one pair must match).

                :attr:`arguments` is used to specify the arguments.


            .. _`AMQP in 10 minutes: Part 4`:
                http://bit.ly/amqp-exchange-types

    .. attribute:: channel

        The channel the exchange is bound to (if bound).

    .. attribute:: durable

        Durable exchanges remain active when a server restarts. Non-durable
        exchanges (transient exchanges) are purged when a server restarts.
        Default is :const:`True`.

    .. attribute:: auto_delete

        If set, the exchange is deleted when all queues have finished
        using it. Default is :const:`False`.

    .. attribute:: delivery_mode

        The default delivery mode used for messages. The value is an integer,
        or alias string.

            * 1 or `"transient"`

                The message is transient. Which means it is stored in
                memory only, and is lost if the server dies or restarts.

            * 2 or "persistent" (*default*)
                The message is persistent. Which means the message is
                stored both in-memory, and on disk, and therefore
                preserved if the server dies or restarts.

        The default value is 2 (persistent).

    .. attribute:: arguments

        Additional arguments to specify when the exchange is declared.

    """
    TRANSIENT_DELIVERY_MODE = TRANSIENT_DELIVERY_MODE
    PERSISTENT_DELIVERY_MODE = PERSISTENT_DELIVERY_MODE

    name = ''
    type = 'direct'
    durable = True
    auto_delete = False
    passive = False
    delivery_mode = PERSISTENT_DELIVERY_MODE

    attrs = (
        ('name', None),
        ('type', None),
        ('arguments', None),
        ('durable', bool),
        ('passive', bool),
        ('auto_delete', bool),
        ('delivery_mode', lambda m: DELIVERY_MODES.get(m) or m),
    )

    def __init__(self, name='', type='', channel=None, **kwargs):
        super(Exchange, self).__init__(**kwargs)
        self.name = name or self.name
        self.type = type or self.type
        self.maybe_bind(channel)

    def __hash__(self):
        return hash('E|%s' % (self.name, ))

    def declare(self, nowait=False, passive=None):
        """Declare the exchange.

        Creates the exchange on the broker.

        :keyword nowait: If set the server will not respond, and a
            response will not be waited for. Default is :const:`False`.

        """
        passive = self.passive if passive is None else passive
        if self.name:
            return self.channel.exchange_declare(
                exchange=self.name, type=self.type, durable=self.durable,
                auto_delete=self.auto_delete, arguments=self.arguments,
                nowait=nowait, passive=passive,
            )

    def bind_to(self, exchange='', routing_key='',
                arguments=None, nowait=False, **kwargs):
        """Binds the exchange to another exchange.

        :keyword nowait: If set the server will not respond, and the call
            will not block waiting for a response.  Default is :const:`False`.

        """
        if isinstance(exchange, Exchange):
            exchange = exchange.name
        return self.channel.exchange_bind(destination=self.name,
                                          source=exchange,
                                          routing_key=routing_key,
                                          nowait=nowait,
                                          arguments=arguments)

    def unbind_from(self, source='', routing_key='',
                    nowait=False, arguments=None):
        """Delete previously created exchange binding from the server."""
        if isinstance(source, Exchange):
            source = source.name
        return self.channel.exchange_unbind(destination=self.name,
                                            source=source,
                                            routing_key=routing_key,
                                            nowait=nowait,
                                            arguments=arguments)

    def Message(self, body, delivery_mode=None, priority=None,
                content_type=None, content_encoding=None,
                properties=None, headers=None):
        """Create message instance to be sent with :meth:`publish`.

        :param body: Message body.

        :keyword delivery_mode: Set custom delivery mode. Defaults
            to :attr:`delivery_mode`.

        :keyword priority: Message priority, 0 to 9. (currently not
            supported by RabbitMQ).

        :keyword content_type: The messages content_type. If content_type
            is set, no serialization occurs as it is assumed this is either
            a binary object, or you've done your own serialization.
            Leave blank if using built-in serialization as our library
            properly sets content_type.

        :keyword content_encoding: The character set in which this object
            is encoded. Use "binary" if sending in raw binary objects.
            Leave blank if using built-in serialization as our library
            properly sets content_encoding.

        :keyword properties: Message properties.

        :keyword headers: Message headers.

        """
        properties = {} if properties is None else properties
        dm = delivery_mode or self.delivery_mode
        properties['delivery_mode'] = \
            DELIVERY_MODES[dm] if (dm != 2 and dm != 1) else dm
        return self.channel.prepare_message(body,
                                            properties=properties,
                                            priority=priority,
                                            content_type=content_type,
                                            content_encoding=content_encoding,
                                            headers=headers)

    def publish(self, message, routing_key=None, mandatory=False,
                immediate=False, exchange=None):
        """Publish message.

        :param message: :meth:`Message` instance to publish.
        :param routing_key: Routing key.
        :param mandatory: Currently not supported.
        :param immediate: Currently not supported.

        """
        exchange = exchange or self.name
        return self.channel.basic_publish(message,
                                          exchange=exchange,
                                          routing_key=routing_key,
                                          mandatory=mandatory,
                                          immediate=immediate)

    def delete(self, if_unused=False, nowait=False):
        """Delete the exchange declaration on server.

        :keyword if_unused: Delete only if the exchange has no bindings.
            Default is :const:`False`.

        :keyword nowait: If set the server will not respond, and a
            response will not be waited for. Default is :const:`False`.

        """
        return self.channel.exchange_delete(exchange=self.name,
                                            if_unused=if_unused,
                                            nowait=nowait)

    def binding(self, routing_key='', arguments=None, unbind_arguments=None):
        return binding(self, routing_key, arguments, unbind_arguments)

    def __eq__(self, other):
        if isinstance(other, Exchange):
            return (self.name == other.name and
                    self.type == other.type and
                    self.arguments == other.arguments and
                    self.durable == other.durable and
                    self.auto_delete == other.auto_delete and
                    self.delivery_mode == other.delivery_mode)
        return NotImplemented

    def __ne__(self, other):
        return not self.__eq__(other)

    def __repr__(self):
        return super(Exchange, self).__repr__(str(self))

    def __str__(self):
        return 'Exchange %s(%s)' % (_reprstr(self.name) or repr(''), self.type)

    @property
    def can_cache_declaration(self):
        return not self.auto_delete


class binding(Object):
    """Represents a queue or exchange binding.

    :keyword exchange: Exchange to bind to.
    :keyword routing_key: Routing key used as binding key.
    :keyword arguments: Arguments for bind operation.
    :keyword unbind_arguments: Arguments for unbind operation.

    """

    attrs = (
        ('exchange', None),
        ('routing_key', None),
        ('arguments', None),
        ('unbind_arguments', None)
    )

    def __init__(self, exchange=None, routing_key='',
                 arguments=None, unbind_arguments=None):
        self.exchange = exchange
        self.routing_key = routing_key
        self.arguments = arguments
        self.unbind_arguments = unbind_arguments

    def declare(self, channel, nowait=False):
        """Declare destination exchange."""
        if self.exchange and self.exchange.name:
            ex = self.exchange(channel)
            ex.declare(nowait=nowait)

    def bind(self, entity, nowait=False):
        """Bind entity to this binding."""
        entity.bind_to(exchange=self.exchange,
                       routing_key=self.routing_key,
                       arguments=self.arguments,
                       nowait=nowait)

    def unbind(self, entity, nowait=False):
        """Unbind entity from this binding."""
        entity.unbind_from(self.exchange,
                           routing_key=self.routing_key,
                           arguments=self.unbind_arguments,
                           nowait=nowait)

    def __repr__(self):
        return '<binding: %s>' % (self, )

    def __str__(self):
        return '%s->%s' % (
            _reprstr(self.exchange.name), _reprstr(self.routing_key),
        )


class Queue(MaybeChannelBound):
    """A Queue declaration.

    :keyword name: See :attr:`name`.
    :keyword exchange: See :attr:`exchange`.
    :keyword routing_key: See :attr:`routing_key`.
    :keyword channel: See :attr:`channel`.
    :keyword durable: See :attr:`durable`.
    :keyword exclusive: See :attr:`exclusive`.
    :keyword auto_delete: See :attr:`auto_delete`.
    :keyword queue_arguments: See :attr:`queue_arguments`.
    :keyword binding_arguments: See :attr:`binding_arguments`.
    :keyword on_declared: See :attr:`on_declared`

    .. attribute:: name

        Name of the queue. Default is no name (default queue destination).

    .. attribute:: exchange

        The :class:`Exchange` the queue binds to.

    .. attribute:: routing_key

        The routing key (if any), also called *binding key*.

        The interpretation of the routing key depends on
        the :attr:`Exchange.type`.

            * direct exchange

                Matches if the routing key property of the message and
                the :attr:`routing_key` attribute are identical.

            * fanout exchange

                Always matches, even if the binding does not have a key.

            * topic exchange

                Matches the routing key property of the message by a primitive
                pattern matching scheme. The message routing key then consists
                of words separated by dots (`"."`, like domain names), and
                two special characters are available; star (`"*"`) and hash
                (`"#"`). The star matches any word, and the hash matches
                zero or more words. For example `"*.stock.#"` matches the
                routing keys `"usd.stock"` and `"eur.stock.db"` but not
                `"stock.nasdaq"`.

    .. attribute:: channel

        The channel the Queue is bound to (if bound).

    .. attribute:: durable

        Durable queues remain active when a server restarts.
        Non-durable queues (transient queues) are purged if/when
        a server restarts.
        Note that durable queues do not necessarily hold persistent
        messages, although it does not make sense to send
        persistent messages to a transient queue.

        Default is :const:`True`.

    .. attribute:: exclusive

        Exclusive queues may only be consumed from by the
        current connection. Setting the 'exclusive' flag
        always implies 'auto-delete'.

        Default is :const:`False`.

    .. attribute:: auto_delete

        If set, the queue is deleted when all consumers have
        finished using it. Last consumer can be cancelled
        either explicitly or because its channel is closed. If
        there was no consumer ever on the queue, it won't be
        deleted.

    .. attribute:: queue_arguments

        Additional arguments used when declaring the queue.

    .. attribute:: binding_arguments

        Additional arguments used when binding the queue.

    .. attribute:: alias

        Unused in Kombu, but applications can take advantage of this.
        For example to give alternate names to queues with automatically
        generated queue names.

    .. attribute:: on_declared

        Optional callback to be applied when the queue has been
        declared (the ``queue_declare`` operation is complete).
        This must be a function with a signature that accepts at least 3
        positional arguments: ``(name, messages, consumers)``.

    """
    ContentDisallowed = ContentDisallowed

    name = ''
    exchange = Exchange('')
    routing_key = ''

    durable = True
    exclusive = False
    auto_delete = False
    no_ack = False

    attrs = (
        ('name', None),
        ('exchange', None),
        ('routing_key', None),
        ('queue_arguments', None),
        ('binding_arguments', None),
        ('durable', bool),
        ('exclusive', bool),
        ('auto_delete', bool),
        ('no_ack', None),
        ('alias', None),
        ('bindings', list),
    )

    def __init__(self, name='', exchange=None, routing_key='',
                 channel=None, bindings=None, on_declared=None,
                 **kwargs):
        super(Queue, self).__init__(**kwargs)
        self.name = name or self.name
        self.exchange = exchange or self.exchange
        self.routing_key = routing_key or self.routing_key
        self.bindings = set(bindings or [])
        self.on_declared = on_declared

        # allows Queue('name', [binding(...), binding(...), ...])
        if isinstance(exchange, (list, tuple, set)):
            self.bindings |= set(exchange)
        if self.bindings:
            self.exchange = None

        # exclusive implies auto-delete.
        if self.exclusive:
            self.auto_delete = True
        self.maybe_bind(channel)

    def bind(self, channel):
        on_declared = self.on_declared
        bound = super(Queue, self).bind(channel)
        bound.on_declared = on_declared
        return bound

    def __hash__(self):
        return hash('Q|%s' % (self.name, ))

    def when_bound(self):
        if self.exchange:
            self.exchange = self.exchange(self.channel)

    def declare(self, nowait=False):
        """Declares the queue, the exchange and binds the queue to
        the exchange."""
        # - declare main binding.
        if self.exchange:
            self.exchange.declare(nowait)
        self.queue_declare(nowait, passive=False)

        if self.exchange and self.exchange.name:
            self.queue_bind(nowait)

        # - declare extra/multi-bindings.
        for B in self.bindings:
            B.declare(self.channel)
            B.bind(self, nowait=nowait)
        return self.name

    def queue_declare(self, nowait=False, passive=False):
        """Declare queue on the server.

        :keyword nowait: Do not wait for a reply.
        :keyword passive: If set, the server will not create the queue.
            The client can use this to check whether a queue exists
            without modifying the server state.

        """
        ret = self.channel.queue_declare(queue=self.name,
                                         passive=passive,
                                         durable=self.durable,
                                         exclusive=self.exclusive,
                                         auto_delete=self.auto_delete,
                                         arguments=self.queue_arguments,
                                         nowait=nowait)
        if not self.name:
            self.name = ret[0]
        if self.on_declared:
            self.on_declared(*ret)
        return ret

    def queue_bind(self, nowait=False):
        """Create the queue binding on the server."""
        return self.bind_to(self.exchange, self.routing_key,
                            self.binding_arguments, nowait=nowait)

    def bind_to(self, exchange='', routing_key='',
                arguments=None, nowait=False):
        if isinstance(exchange, Exchange):
            exchange = exchange.name
        return self.channel.queue_bind(queue=self.name,
                                       exchange=exchange,
                                       routing_key=routing_key,
                                       arguments=arguments,
                                       nowait=nowait)

    def get(self, no_ack=None, accept=None):
        """Poll the server for a new message.

        Must return the message if a message was available,
        or :const:`None` otherwise.

        :keyword no_ack: If enabled the broker will automatically
            ack messages.
        :keyword accept: Custom list of accepted content types.

        This method provides direct access to the messages in a
        queue using a synchronous dialogue, designed for
        specific types of applications where synchronous functionality
        is more important than performance.

        """
        no_ack = self.no_ack if no_ack is None else no_ack
        message = self.channel.basic_get(queue=self.name, no_ack=no_ack)
        if message is not None:
            m2p = getattr(self.channel, 'message_to_python', None)
            if m2p:
                message = m2p(message)
            if message.errors:
                message._reraise_error()
            message.accept = prepare_accept_content(accept)
        return message

    def purge(self, nowait=False):
        """Remove all ready messages from the queue."""
        return self.channel.queue_purge(queue=self.name,
                                        nowait=nowait) or 0

    def consume(self, consumer_tag='', callback=None,
                no_ack=None, nowait=False):
        """Start a queue consumer.

        Consumers last as long as the channel they were created on, or
        until the client cancels them.

        :keyword consumer_tag: Unique identifier for the consumer. The
          consumer tag is local to a connection, so two clients
          can use the same consumer tags. If this field is empty
          the server will generate a unique tag.

        :keyword no_ack: If enabled the broker will automatically ack
            messages.

        :keyword nowait: Do not wait for a reply.

        :keyword callback: callback called for each delivered message

        """
        if no_ack is None:
            no_ack = self.no_ack
        return self.channel.basic_consume(queue=self.name,
                                          no_ack=no_ack,
                                          consumer_tag=consumer_tag or '',
                                          callback=callback,
                                          nowait=nowait)

    def cancel(self, consumer_tag):
        """Cancel a consumer by consumer tag."""
        return self.channel.basic_cancel(consumer_tag)

    def delete(self, if_unused=False, if_empty=False, nowait=False):
        """Delete the queue.

        :keyword if_unused: If set, the server will only delete the queue
            if it has no consumers. A channel error will be raised
            if the queue has consumers.

        :keyword if_empty: If set, the server will only delete the queue
            if it is empty. If it is not empty a channel error will be raised.

        :keyword nowait: Do not wait for a reply.

        """
        return self.channel.queue_delete(queue=self.name,
                                         if_unused=if_unused,
                                         if_empty=if_empty,
                                         nowait=nowait)

    def queue_unbind(self, arguments=None, nowait=False):
        return self.unbind_from(self.exchange, self.routing_key,
                                arguments, nowait)

    def unbind_from(self, exchange='', routing_key='',
                    arguments=None, nowait=False):
        """Unbind queue by deleting the binding from the server."""
        return self.channel.queue_unbind(queue=self.name,
                                         exchange=exchange.name,
                                         routing_key=routing_key,
                                         arguments=arguments,
                                         nowait=nowait)

    def __eq__(self, other):
        if isinstance(other, Queue):
            return (self.name == other.name and
                    self.exchange == other.exchange and
                    self.routing_key == other.routing_key and
                    self.queue_arguments == other.queue_arguments and
                    self.binding_arguments == other.binding_arguments and
                    self.durable == other.durable and
                    self.exclusive == other.exclusive and
                    self.auto_delete == other.auto_delete)
        return NotImplemented

    def __ne__(self, other):
        return not self.__eq__(other)

    def __repr__(self):
        s = super(Queue, self).__repr__
        if self.bindings:
            return s('Queue {name} -> {bindings}'.format(
                name=_reprstr(self.name),
                bindings=pretty_bindings(self.bindings),
            ))
        return s(
            'Queue {name} -> {0.exchange!r} -> {routing_key}'.format(
                self, name=_reprstr(self.name),
                routing_key=_reprstr(self.routing_key),
            ),
        )

    @property
    def can_cache_declaration(self):
        return not self.auto_delete

    @classmethod
    def from_dict(self, queue, **options):
        binding_key = options.get('binding_key') or options.get('routing_key')

        e_durable = options.get('exchange_durable')
        if e_durable is None:
            e_durable = options.get('durable')

        e_auto_delete = options.get('exchange_auto_delete')
        if e_auto_delete is None:
            e_auto_delete = options.get('auto_delete')

        q_durable = options.get('queue_durable')
        if q_durable is None:
            q_durable = options.get('durable')

        q_auto_delete = options.get('queue_auto_delete')
        if q_auto_delete is None:
            q_auto_delete = options.get('auto_delete')

        e_arguments = options.get('exchange_arguments')
        q_arguments = options.get('queue_arguments')
        b_arguments = options.get('binding_arguments')
        bindings = options.get('bindings')

        exchange = Exchange(options.get('exchange'),
                            type=options.get('exchange_type'),
                            delivery_mode=options.get('delivery_mode'),
                            routing_key=options.get('routing_key'),
                            durable=e_durable,
                            auto_delete=e_auto_delete,
                            arguments=e_arguments)
        return Queue(queue,
                     exchange=exchange,
                     routing_key=binding_key,
                     durable=q_durable,
                     exclusive=options.get('exclusive'),
                     auto_delete=q_auto_delete,
                     no_ack=options.get('no_ack'),
                     queue_arguments=q_arguments,
                     binding_arguments=b_arguments,
                     bindings=bindings)

    def as_dict(self, recurse=False):
        res = super(Queue, self).as_dict(recurse)
        if not recurse:
            return res
        bindings = res.get('bindings')
        if bindings:
            res['bindings'] = [b.as_dict(recurse=True) for b in bindings]
        return res
