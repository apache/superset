"""
kombu.transport.virtual.exchange
================================

Implementations of the standard exchanges defined
by the AMQ protocol  (excluding the `headers` exchange).

"""
from __future__ import absolute_import

from kombu.utils import escape_regex

import re


class ExchangeType(object):
    """Implements the specifics for an exchange type.

    :param channel: AMQ Channel

    """
    type = None

    def __init__(self, channel):
        self.channel = channel

    def lookup(self, table, exchange, routing_key, default):
        """Lookup all queues matching `routing_key` in `exchange`.

        :returns: `default` if no queues matched.

        """
        raise NotImplementedError('subclass responsibility')

    def prepare_bind(self, queue, exchange, routing_key, arguments):
        """Return tuple of `(routing_key, regex, queue)` to be stored
        for bindings to this exchange."""
        return routing_key, None, queue

    def equivalent(self, prev, exchange, type,
                   durable, auto_delete, arguments):
        """Return true if `prev` and `exchange` is equivalent."""
        return (type == prev['type'] and
                durable == prev['durable'] and
                auto_delete == prev['auto_delete'] and
                (arguments or {}) == (prev['arguments'] or {}))


class DirectExchange(ExchangeType):
    """The `direct` exchange routes based on exact routing keys."""
    type = 'direct'

    def lookup(self, table, exchange, routing_key, default):
        return [queue for rkey, _, queue in table
                if rkey == routing_key]

    def deliver(self, message, exchange, routing_key, **kwargs):
        _lookup = self.channel._lookup
        _put = self.channel._put
        for queue in _lookup(exchange, routing_key):
            _put(queue, message, **kwargs)


class TopicExchange(ExchangeType):
    """The `topic` exchange routes messages based on words separated by
    dots, using wildcard characters ``*`` (any single word), and ``#``
    (one or more words)."""
    type = 'topic'

    #: map of wildcard to regex conversions
    wildcards = {'*': r'.*?[^\.]',
                 '#': r'.*?'}

    #: compiled regex cache
    _compiled = {}

    def lookup(self, table, exchange, routing_key, default):
        return [queue for rkey, pattern, queue in table
                if self._match(pattern, routing_key)]

    def deliver(self, message, exchange, routing_key, **kwargs):
        _lookup = self.channel._lookup
        _put = self.channel._put
        deadletter = self.channel.deadletter_queue
        for queue in [q for q in _lookup(exchange, routing_key)
                      if q and q != deadletter]:
            _put(queue, message, **kwargs)

    def prepare_bind(self, queue, exchange, routing_key, arguments):
        return routing_key, self.key_to_pattern(routing_key), queue

    def key_to_pattern(self, rkey):
        """Get the corresponding regex for any routing key."""
        return '^%s$' % ('\.'.join(
            self.wildcards.get(word, word)
            for word in escape_regex(rkey, '.#*').split('.')
        ))

    def _match(self, pattern, string):
        """Same as :func:`re.match`, except the regex is compiled and cached,
        then reused on subsequent matches with the same pattern."""
        try:
            compiled = self._compiled[pattern]
        except KeyError:
            compiled = self._compiled[pattern] = re.compile(pattern, re.U)
        return compiled.match(string)


class FanoutExchange(ExchangeType):
    """The `fanout` exchange implements broadcast messaging by delivering
    copies of all messages to all queues bound to the exchange.

    To support fanout the virtual channel needs to store the table
    as shared state.  This requires that the `Channel.supports_fanout`
    attribute is set to true, and the `Channel._queue_bind` and
    `Channel.get_table` methods are implemented.  See the redis backend
    for an example implementation of these methods.

    """
    type = 'fanout'

    def lookup(self, table, exchange, routing_key, default):
        return [queue for _, _, queue in table]

    def deliver(self, message, exchange, routing_key, **kwargs):
        if self.channel.supports_fanout:
            self.channel._put_fanout(
                exchange, message, routing_key, **kwargs)


#: Map of standard exchange types and corresponding classes.
STANDARD_EXCHANGE_TYPES = {'direct': DirectExchange,
                           'topic': TopicExchange,
                           'fanout': FanoutExchange}
