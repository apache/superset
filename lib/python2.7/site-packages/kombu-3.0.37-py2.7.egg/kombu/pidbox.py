"""
kombu.pidbox
===============

Generic process mailbox.

"""
from __future__ import absolute_import

import socket
import warnings

from collections import defaultdict, deque
from copy import copy
from itertools import count
from threading import local
from time import time

from . import Exchange, Queue, Consumer, Producer
from .clocks import LamportClock
from .common import maybe_declare, oid_from
from .exceptions import InconsistencyError
from .five import range
from .log import get_logger
from .utils import cached_property, kwdict, uuid, reprcall

REPLY_QUEUE_EXPIRES = 10

W_PIDBOX_IN_USE = """\
A node named {node.hostname} is already using this process mailbox!

Maybe you forgot to shutdown the other node or did not do so properly?
Or if you meant to start multiple nodes on the same host please make sure
you give each node a unique node name!
"""

__all__ = ['Node', 'Mailbox']
logger = get_logger(__name__)
debug, error = logger.debug, logger.error


class Node(object):

    #: hostname of the node.
    hostname = None

    #: the :class:`Mailbox` this is a node for.
    mailbox = None

    #: map of method name/handlers.
    handlers = None

    #: current context (passed on to handlers)
    state = None

    #: current channel.
    channel = None

    def __init__(self, hostname, state=None, channel=None,
                 handlers=None, mailbox=None):
        self.channel = channel
        self.mailbox = mailbox
        self.hostname = hostname
        self.state = state
        self.adjust_clock = self.mailbox.clock.adjust
        if handlers is None:
            handlers = {}
        self.handlers = handlers

    def Consumer(self, channel=None, no_ack=True, accept=None, **options):
        queue = self.mailbox.get_queue(self.hostname)

        def verify_exclusive(name, messages, consumers):
            if consumers:
                warnings.warn(W_PIDBOX_IN_USE.format(node=self))
        queue.on_declared = verify_exclusive

        return Consumer(
            channel or self.channel, [queue], no_ack=no_ack,
            accept=self.mailbox.accept if accept is None else accept,
            **options
        )

    def handler(self, fun):
        self.handlers[fun.__name__] = fun
        return fun

    def on_decode_error(self, message, exc):
        error('Cannot decode message: %r', exc, exc_info=1)

    def listen(self, channel=None, callback=None):
        consumer = self.Consumer(channel=channel,
                                 callbacks=[callback or self.handle_message],
                                 on_decode_error=self.on_decode_error)
        consumer.consume()
        return consumer

    def dispatch(self, method, arguments=None,
                 reply_to=None, ticket=None, **kwargs):
        arguments = arguments or {}
        debug('pidbox received method %s [reply_to:%s ticket:%s]',
              reprcall(method, (), kwargs=arguments), reply_to, ticket)
        handle = reply_to and self.handle_call or self.handle_cast
        try:
            reply = handle(method, kwdict(arguments))
        except SystemExit:
            raise
        except Exception as exc:
            error('pidbox command error: %r', exc, exc_info=1)
            reply = {'error': repr(exc)}

        if reply_to:
            self.reply({self.hostname: reply},
                       exchange=reply_to['exchange'],
                       routing_key=reply_to['routing_key'],
                       ticket=ticket)
        return reply

    def handle(self, method, arguments={}):
        return self.handlers[method](self.state, **arguments)

    def handle_call(self, method, arguments):
        return self.handle(method, arguments)

    def handle_cast(self, method, arguments):
        return self.handle(method, arguments)

    def handle_message(self, body, message=None):
        destination = body.get('destination')
        if message:
            self.adjust_clock(message.headers.get('clock') or 0)
        if not destination or self.hostname in destination:
            return self.dispatch(**kwdict(body))
    dispatch_from_message = handle_message

    def reply(self, data, exchange, routing_key, ticket, **kwargs):
        self.mailbox._publish_reply(data, exchange, routing_key, ticket,
                                    channel=self.channel,
                                    serializer=self.mailbox.serializer)


class Mailbox(object):
    node_cls = Node
    exchange_fmt = '%s.pidbox'
    reply_exchange_fmt = 'reply.%s.pidbox'

    #: Name of application.
    namespace = None

    #: Connection (if bound).
    connection = None

    #: Exchange type (usually direct, or fanout for broadcast).
    type = 'direct'

    #: mailbox exchange (init by constructor).
    exchange = None

    #: exchange to send replies to.
    reply_exchange = None

    #: Only accepts json messages by default.
    accept = ['json']

    #: Message serializer
    serializer = None

    def __init__(self, namespace,
                 type='direct', connection=None, clock=None,
                 accept=None, serializer=None):
        self.namespace = namespace
        self.connection = connection
        self.type = type
        self.clock = LamportClock() if clock is None else clock
        self.exchange = self._get_exchange(self.namespace, self.type)
        self.reply_exchange = self._get_reply_exchange(self.namespace)
        self._tls = local()
        self.unclaimed = defaultdict(deque)
        self.accept = self.accept if accept is None else accept
        self.serializer = self.serializer if serializer is None else serializer

    def __call__(self, connection):
        bound = copy(self)
        bound.connection = connection
        return bound

    def Node(self, hostname=None, state=None, channel=None, handlers=None):
        hostname = hostname or socket.gethostname()
        return self.node_cls(hostname, state, channel, handlers, mailbox=self)

    def call(self, destination, command, kwargs={},
             timeout=None, callback=None, channel=None):
        return self._broadcast(command, kwargs, destination,
                               reply=True, timeout=timeout,
                               callback=callback,
                               channel=channel)

    def cast(self, destination, command, kwargs={}):
        return self._broadcast(command, kwargs, destination, reply=False)

    def abcast(self, command, kwargs={}):
        return self._broadcast(command, kwargs, reply=False)

    def multi_call(self, command, kwargs={}, timeout=1,
                   limit=None, callback=None, channel=None):
        return self._broadcast(command, kwargs, reply=True,
                               timeout=timeout, limit=limit,
                               callback=callback,
                               channel=channel)

    def get_reply_queue(self):
        oid = self.oid
        return Queue(
            '%s.%s' % (oid, self.reply_exchange.name),
            exchange=self.reply_exchange,
            routing_key=oid,
            durable=False,
            auto_delete=True,
            queue_arguments={'x-expires': int(REPLY_QUEUE_EXPIRES * 1000)},
        )

    @cached_property
    def reply_queue(self):
        return self.get_reply_queue()

    def get_queue(self, hostname):
        return Queue('%s.%s.pidbox' % (hostname, self.namespace),
                     exchange=self.exchange,
                     durable=False,
                     auto_delete=True)

    def _publish_reply(self, reply, exchange, routing_key, ticket,
                       channel=None, **opts):
        chan = channel or self.connection.default_channel
        exchange = Exchange(exchange, exchange_type='direct',
                            delivery_mode='transient',
                            durable=False)
        producer = Producer(chan, auto_declare=False)
        try:
            producer.publish(
                reply, exchange=exchange, routing_key=routing_key,
                declare=[exchange], headers={
                    'ticket': ticket, 'clock': self.clock.forward(),
                },
                **opts
            )
        except InconsistencyError:
            pass   # queue probably deleted and no one is expecting a reply.

    def _publish(self, type, arguments, destination=None,
                 reply_ticket=None, channel=None, timeout=None,
                 serializer=None):
        message = {'method': type,
                   'arguments': arguments,
                   'destination': destination}
        chan = channel or self.connection.default_channel
        exchange = self.exchange
        if reply_ticket:
            maybe_declare(self.reply_queue(channel))
            message.update(ticket=reply_ticket,
                           reply_to={'exchange': self.reply_exchange.name,
                                     'routing_key': self.oid})
        serializer = serializer or self.serializer
        producer = Producer(chan, auto_declare=False)
        producer.publish(
            message, exchange=exchange.name, declare=[exchange],
            headers={'clock': self.clock.forward(),
                     'expires': time() + timeout if timeout else 0},
            serializer=serializer,
        )

    def _broadcast(self, command, arguments=None, destination=None,
                   reply=False, timeout=1, limit=None,
                   callback=None, channel=None, serializer=None):
        if destination is not None and \
                not isinstance(destination, (list, tuple)):
            raise ValueError(
                'destination must be a list/tuple not {0}'.format(
                    type(destination)))

        arguments = arguments or {}
        reply_ticket = reply and uuid() or None
        chan = channel or self.connection.default_channel

        # Set reply limit to number of destinations (if specified)
        if limit is None and destination:
            limit = destination and len(destination) or None

        serializer = serializer or self.serializer
        self._publish(command, arguments, destination=destination,
                      reply_ticket=reply_ticket,
                      channel=chan,
                      timeout=timeout,
                      serializer=serializer)

        if reply_ticket:
            return self._collect(reply_ticket, limit=limit,
                                 timeout=timeout,
                                 callback=callback,
                                 channel=chan)

    def _collect(self, ticket,
                 limit=None, timeout=1, callback=None,
                 channel=None, accept=None):
        if accept is None:
            accept = self.accept
        chan = channel or self.connection.default_channel
        queue = self.reply_queue
        consumer = Consumer(channel, [queue], accept=accept, no_ack=True)
        responses = []
        unclaimed = self.unclaimed
        adjust_clock = self.clock.adjust

        try:
            return unclaimed.pop(ticket)
        except KeyError:
            pass

        def on_message(body, message):
            # ticket header added in kombu 2.5
            header = message.headers.get
            adjust_clock(header('clock') or 0)
            expires = header('expires')
            if expires and time() > expires:
                return
            this_id = header('ticket', ticket)
            if this_id == ticket:
                if callback:
                    callback(body)
                responses.append(body)
            else:
                unclaimed[this_id].append(body)

        consumer.register_callback(on_message)
        try:
            with consumer:
                for i in limit and range(limit) or count():
                    try:
                        self.connection.drain_events(timeout=timeout)
                    except socket.timeout:
                        break
                return responses
        finally:
            chan.after_reply_message_received(queue.name)

    def _get_exchange(self, namespace, type):
        return Exchange(self.exchange_fmt % namespace,
                        type=type,
                        durable=False,
                        delivery_mode='transient')

    def _get_reply_exchange(self, namespace):
        return Exchange(self.reply_exchange_fmt % namespace,
                        type='direct',
                        durable=False,
                        delivery_mode='transient')

    @cached_property
    def oid(self):
        try:
            return self._tls.OID
        except AttributeError:
            oid = self._tls.OID = oid_from(self)
            return oid
