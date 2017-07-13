"""
kombu.transport.SQS
===================

Amazon SQS transport module for Kombu. This package implements an AMQP-like
interface on top of Amazons SQS service, with the goal of being optimized for
high performance and reliability.

The default settings for this module are focused now on high performance in
task queue situations where tasks are small, idempotent and run very fast.

SQS Features supported by this transport:
  Long Polling:
    http://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/
      sqs-long-polling.html

    Long polling is enabled by setting the `wait_time_seconds` transport
    option to a number > 1. Amazon supports up to 20 seconds. This is
    disabled for now, but will be enabled by default in the near future.

  Batch API Actions:
   http://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/
     sqs-batch-api.html

    The default behavior of the SQS Channel.drain_events() method is to
    request up to the 'prefetch_count' messages on every request to SQS.
    These messages are stored locally in a deque object and passed back
    to the Transport until the deque is empty, before triggering a new
    API call to Amazon.

    This behavior dramatically speeds up the rate that you can pull tasks
    from SQS when you have short-running tasks (or a large number of workers).

    When a Celery worker has multiple queues to monitor, it will pull down
    up to 'prefetch_count' messages from queueA and work on them all before
    moving on to queueB. If queueB is empty, it will wait up until
    'polling_interval' expires before moving back and checking on queueA.
"""

from __future__ import absolute_import

import collections
import socket
import string

from anyjson import loads, dumps

import boto
from boto import exception
from boto import sdb as _sdb
from boto import sqs as _sqs
from boto.sdb.domain import Domain
from boto.sdb.connection import SDBConnection
from boto.sqs.connection import SQSConnection
from boto.sqs.message import Message

from kombu.five import Empty, range, text_t
from kombu.log import get_logger
from kombu.utils import cached_property, uuid
from kombu.utils.encoding import bytes_to_str, safe_str
from kombu.transport.virtual import scheduling

from . import virtual

logger = get_logger(__name__)

# dots are replaced by dash, all other punctuation
# replaced by underscore.
CHARS_REPLACE_TABLE = dict((ord(c), 0x5f)
                           for c in string.punctuation if c not in '-_.')
CHARS_REPLACE_TABLE[0x2e] = 0x2d  # '.' -> '-'


def maybe_int(x):
    try:
        return int(x)
    except ValueError:
        return x
BOTO_VERSION = tuple(maybe_int(part) for part in boto.__version__.split('.'))
W_LONG_POLLING = BOTO_VERSION >= (2, 8)

#: SQS bulk get supports a maximum of 10 messages at a time.
SQS_MAX_MESSAGES = 10


class Table(Domain):
    """Amazon SimpleDB domain describing the message routing table."""
    # caches queues already bound, so we don't have to declare them again.
    _already_bound = set()

    def routes_for(self, exchange):
        """Iterator giving all routes for an exchange."""
        return self.select("""WHERE exchange = '%s'""" % exchange)

    def get_queue(self, queue):
        """Get binding for queue."""
        qid = self._get_queue_id(queue)
        if qid:
            return self.get_item(qid)

    def create_binding(self, queue):
        """Get binding item for queue.

        Creates the item if it doesn't exist.

        """
        item = self.get_queue(queue)
        if item:
            return item, item['id']
        id = uuid()
        return self.new_item(id), id

    def queue_bind(self, exchange, routing_key, pattern, queue):
        if queue not in self._already_bound:
            binding, id = self.create_binding(queue)
            binding.update(exchange=exchange,
                           routing_key=routing_key or '',
                           pattern=pattern or '',
                           queue=queue or '',
                           id=id)
            binding.save()
            self._already_bound.add(queue)

    def queue_delete(self, queue):
        """delete queue by name."""
        self._already_bound.discard(queue)
        item = self._get_queue_item(queue)
        if item:
            self.delete_item(item)

    def exchange_delete(self, exchange):
        """Delete all routes for `exchange`."""
        for item in self.routes_for(exchange):
            self.delete_item(item['id'])

    def get_item(self, item_name):
        """Uses `consistent_read` by default."""
        # Domain is an old-style class, can't use super().
        for consistent_read in (False, True):
            item = Domain.get_item(self, item_name, consistent_read)
            if item:
                return item

    def select(self, query='', next_token=None,
               consistent_read=True, max_items=None):
        """Uses `consistent_read` by default."""
        query = """SELECT * FROM `%s` %s""" % (self.name, query)
        return Domain.select(self, query, next_token,
                             consistent_read, max_items)

    def _try_first(self, query='', **kwargs):
        for c in (False, True):
            for item in self.select(query, consistent_read=c, **kwargs):
                return item

    def get_exchanges(self):
        return list(set(i['exchange'] for i in self.select()))

    def _get_queue_item(self, queue):
        return self._try_first("""WHERE queue = '%s' limit 1""" % queue)

    def _get_queue_id(self, queue):
        item = self._get_queue_item(queue)
        if item:
            return item['id']


class Channel(virtual.Channel):
    Table = Table

    default_region = 'us-east-1'
    default_visibility_timeout = 1800  # 30 minutes.
    default_wait_time_seconds = 0  # disabled see #198
    domain_format = 'kombu%(vhost)s'
    _sdb = None
    _sqs = None
    _queue_cache = {}
    _noack_queues = set()

    def __init__(self, *args, **kwargs):
        super(Channel, self).__init__(*args, **kwargs)

        # SQS blows up when you try to create a new queue if one already
        # exists with a different visibility_timeout, so this prepopulates
        # the queue_cache to protect us from recreating
        # queues that are known to already exist.
        queues = self.sqs.get_all_queues(prefix=self.queue_name_prefix)
        for queue in queues:
            self._queue_cache[queue.name] = queue
        self._fanout_queues = set()

        # The drain_events() method stores extra messages in a local
        # Deque object. This allows multiple messages to be requested from
        # SQS at once for performance, but maintains the same external API
        # to the caller of the drain_events() method.
        self._queue_message_cache = collections.deque()

    def basic_consume(self, queue, no_ack, *args, **kwargs):
        if no_ack:
            self._noack_queues.add(queue)
        return super(Channel, self).basic_consume(
            queue, no_ack, *args, **kwargs
        )

    def basic_cancel(self, consumer_tag):
        if consumer_tag in self._consumers:
            queue = self._tag_to_queue[consumer_tag]
            self._noack_queues.discard(queue)
        return super(Channel, self).basic_cancel(consumer_tag)

    def drain_events(self, timeout=None):
        """Return a single payload message from one of our queues.

        :raises Empty: if no messages available.

        """
        # If we're not allowed to consume or have no consumers, raise Empty
        if not self._consumers or not self.qos.can_consume():
            raise Empty()
        message_cache = self._queue_message_cache

        # Check if there are any items in our buffer. If there are any, pop
        # off that queue first.
        try:
            return message_cache.popleft()
        except IndexError:
            pass

        # At this point, go and get more messages from SQS
        res, queue = self._poll(self.cycle, timeout=timeout)
        message_cache.extend((r, queue) for r in res)

        # Now try to pop off the queue again.
        try:
            return message_cache.popleft()
        except IndexError:
            raise Empty()

    def _reset_cycle(self):
        """Reset the consume cycle.

        :returns: a FairCycle object that points to our _get_bulk() method
          rather than the standard _get() method. This allows for multiple
          messages to be returned at once from SQS (based on the prefetch
          limit).

        """
        self._cycle = scheduling.FairCycle(
            self._get_bulk, self._active_queues, Empty,
        )

    def entity_name(self, name, table=CHARS_REPLACE_TABLE):
        """Format AMQP queue name into a legal SQS queue name."""
        return text_t(safe_str(name)).translate(table)

    def _new_queue(self, queue, **kwargs):
        """Ensure a queue with given name exists in SQS."""
        # Translate to SQS name for consistency with initial
        # _queue_cache population.
        queue = self.entity_name(self.queue_name_prefix + queue)
        try:
            return self._queue_cache[queue]
        except KeyError:
            q = self._queue_cache[queue] = self.sqs.create_queue(
                queue, self.visibility_timeout,
            )
            return q

    def queue_bind(self, queue, exchange=None, routing_key='',
                   arguments=None, **kwargs):
        super(Channel, self).queue_bind(queue, exchange, routing_key,
                                        arguments, **kwargs)
        if self.typeof(exchange).type == 'fanout':
            self._fanout_queues.add(queue)

    def _queue_bind(self, *args):
        """Bind ``queue`` to ``exchange`` with routing key.

        Route will be stored in SDB if so enabled.

        """
        if self.supports_fanout:
            self.table.queue_bind(*args)

    def get_table(self, exchange):
        """Get routing table.

        Retrieved from SDB if :attr:`supports_fanout`.

        """
        if self.supports_fanout:
            return [(r['routing_key'], r['pattern'], r['queue'])
                    for r in self.table.routes_for(exchange)]
        return super(Channel, self).get_table(exchange)

    def get_exchanges(self):
        if self.supports_fanout:
            return self.table.get_exchanges()
        return super(Channel, self).get_exchanges()

    def _delete(self, queue, *args):
        """delete queue by name."""
        if self.supports_fanout:
            self.table.queue_delete(queue)
        super(Channel, self)._delete(queue)
        self._queue_cache.pop(queue, None)

    def exchange_delete(self, exchange, **kwargs):
        """Delete exchange by name."""
        if self.supports_fanout:
            self.table.exchange_delete(exchange)
        super(Channel, self).exchange_delete(exchange, **kwargs)

    def _has_queue(self, queue, **kwargs):
        """Return True if ``queue`` was previously declared."""
        if self.supports_fanout:
            return bool(self.table.get_queue(queue))
        return super(Channel, self)._has_queue(queue)

    def _put(self, queue, message, **kwargs):
        """Put message onto queue."""
        q = self._new_queue(queue)
        m = Message()
        m.set_body(dumps(message))
        q.write(m)

    def _put_fanout(self, exchange, message, routing_key, **kwargs):
        """Deliver fanout message to all queues in ``exchange``."""
        for route in self.table.routes_for(exchange):
            self._put(route['queue'], message, **kwargs)

    def _get_from_sqs(self, queue, count=1):
        """Retrieve messages from SQS and returns the raw SQS message objects.

        :returns: List of SQS message objects

        """
        q = self._new_queue(queue)
        if W_LONG_POLLING and queue not in self._fanout_queues:
            return q.get_messages(
                count, wait_time_seconds=self.wait_time_seconds,
            )
        else:  # boto < 2.8
            return q.get_messages(count)

    def _message_to_python(self, message, queue_name, queue):
        payload = loads(bytes_to_str(message.get_body()))
        if queue_name in self._noack_queues:
            queue.delete_message(message)
        else:
            payload['properties']['delivery_info'].update({
                'sqs_message': message, 'sqs_queue': queue,
            })
        return payload

    def _messages_to_python(self, messages, queue):
        """Convert a list of SQS Message objects into Payloads.

        This method handles converting SQS Message objects into
        Payloads, and appropriately updating the queue depending on
        the 'ack' settings for that queue.

        :param messages: A list of SQS Message objects.
        :param queue: String name representing the queue they came from

        :returns: A list of Payload objects

        """
        q = self._new_queue(queue)
        return [self._message_to_python(m, queue, q) for m in messages]

    def _get_bulk(self, queue, max_if_unlimited=SQS_MAX_MESSAGES):
        """Try to retrieve multiple messages off ``queue``.

        Where _get() returns a single Payload object, this method returns a
        list of Payload objects. The number of objects returned is determined
        by the total number of messages available in the queue and the
        number of messages that the QoS object allows (based on the
        prefetch_count).

        .. note::
            Ignores QoS limits so caller is responsible for checking
            that we are allowed to consume at least one message from the
            queue.  get_bulk will then ask QoS for an estimate of
            the number of extra messages that we can consume.

        args:
            queue: The queue name (string) to pull from

        returns:
            payloads: A list of payload objects returned
        """
        # drain_events calls `can_consume` first, consuming
        # a token, so we know that we are allowed to consume at least
        # one message.
        maxcount = self.qos.can_consume_max_estimate()
        maxcount = max_if_unlimited if maxcount is None else max(maxcount, 1)
        if maxcount:
            messages = self._get_from_sqs(
                queue, count=min(maxcount, SQS_MAX_MESSAGES),
            )

            if messages:
                return self._messages_to_python(messages, queue)
        raise Empty()

    def _get(self, queue):
        """Try to retrieve a single message off ``queue``."""
        messages = self._get_from_sqs(queue, count=1)

        if messages:
            return self._messages_to_python(messages, queue)[0]
        raise Empty()

    def _restore(self, message,
                 unwanted_delivery_info=('sqs_message', 'sqs_queue')):
        for unwanted_key in unwanted_delivery_info:
            # Remove objects that aren't JSON serializable (Issue #1108).
            message.delivery_info.pop(unwanted_key, None)
        return super(Channel, self)._restore(message)

    def basic_ack(self, delivery_tag):
        delivery_info = self.qos.get(delivery_tag).delivery_info
        try:
            queue = delivery_info['sqs_queue']
        except KeyError:
            pass
        else:
            queue.delete_message(delivery_info['sqs_message'])
        super(Channel, self).basic_ack(delivery_tag)

    def _size(self, queue):
        """Return the number of messages in a queue."""
        return self._new_queue(queue).count()

    def _purge(self, queue):
        """Delete all current messages in a queue."""
        q = self._new_queue(queue)
        # SQS is slow at registering messages, so run for a few
        # iterations to ensure messages are deleted.
        size = 0
        for i in range(10):
            size += q.count()
            if not size:
                break
        q.clear()
        return size

    def close(self):
        super(Channel, self).close()
        for conn in (self._sqs, self._sdb):
            if conn:
                try:
                    conn.close()
                except AttributeError as exc:  # FIXME ???
                    if "can't set attribute" not in str(exc):
                        raise

    def _get_regioninfo(self, regions):
        if self.region:
            for _r in regions:
                if _r.name == self.region:
                    return _r

    def _aws_connect_to(self, fun, regions):
        conninfo = self.conninfo
        region = self._get_regioninfo(regions)
        return fun(region=region,
                   aws_access_key_id=conninfo.userid,
                   aws_secret_access_key=conninfo.password,
                   port=conninfo.port)

    @property
    def sqs(self):
        if self._sqs is None:
            self._sqs = self._aws_connect_to(SQSConnection, _sqs.regions())
        return self._sqs

    @property
    def sdb(self):
        if self._sdb is None:
            self._sdb = self._aws_connect_to(SDBConnection, _sdb.regions())
        return self._sdb

    @property
    def table(self):
        name = self.entity_name(
            self.domain_format % {'vhost': self.conninfo.virtual_host})
        d = self.sdb.get_object(
            'CreateDomain', {'DomainName': name}, self.Table)
        d.name = name
        return d

    @property
    def conninfo(self):
        return self.connection.client

    @property
    def transport_options(self):
        return self.connection.client.transport_options

    @cached_property
    def visibility_timeout(self):
        return (self.transport_options.get('visibility_timeout') or
                self.default_visibility_timeout)

    @cached_property
    def queue_name_prefix(self):
        return self.transport_options.get('queue_name_prefix', '')

    @cached_property
    def supports_fanout(self):
        return self.transport_options.get('sdb_persistence', False)

    @cached_property
    def region(self):
        return self.transport_options.get('region') or self.default_region

    @cached_property
    def wait_time_seconds(self):
        return self.transport_options.get('wait_time_seconds',
                                          self.default_wait_time_seconds)


class Transport(virtual.Transport):
    Channel = Channel

    polling_interval = 1
    wait_time_seconds = 0
    default_port = None
    connection_errors = (
        virtual.Transport.connection_errors +
        (exception.SQSError, socket.error)
    )
    channel_errors = (
        virtual.Transport.channel_errors + (exception.SQSDecodeError, )
    )
    driver_type = 'sqs'
    driver_name = 'sqs'
