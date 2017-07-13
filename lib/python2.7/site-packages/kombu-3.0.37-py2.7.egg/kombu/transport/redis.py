"""
kombu.transport.redis
=====================

Redis transport.

"""
from __future__ import absolute_import

import numbers
import socket

from bisect import bisect
from collections import namedtuple
from contextlib import contextmanager
from time import time

from amqp import promise
from anyjson import loads, dumps

from kombu.exceptions import InconsistencyError, VersionMismatch
from kombu.five import Empty, values, string_t
from kombu.log import get_logger
from kombu.utils import cached_property, uuid
from kombu.utils.eventio import poll, READ, ERR
from kombu.utils.encoding import bytes_to_str
from kombu.utils.url import _parse_url

from . import virtual

try:
    from billiard.util import register_after_fork
except ImportError:  # pragma: no cover
    try:
        from multiprocessing.util import register_after_fork  # noqa
    except ImportError:
        def register_after_fork(*args, **kwargs):  # noqa
            pass

try:
    import redis
except ImportError:  # pragma: no cover
    redis = None     # noqa

logger = get_logger('kombu.transport.redis')
crit, warn = logger.critical, logger.warn

DEFAULT_PORT = 6379
DEFAULT_DB = 0

PRIORITY_STEPS = [0, 3, 6, 9]

error_classes_t = namedtuple('error_classes_t', (
    'connection_errors', 'channel_errors',
))

NO_ROUTE_ERROR = """
Cannot route message for exchange {0!r}: Table empty or key no longer exists.
Probably the key ({1!r}) has been removed from the Redis database.
"""

# This implementation may seem overly complex, but I assure you there is
# a good reason for doing it this way.
#
# Consuming from several connections enables us to emulate channels,
# which means we can have different service guarantees for individual
# channels.
#
# So we need to consume messages from multiple connections simultaneously,
# and using epoll means we don't have to do so using multiple threads.
#
# Also it means we can easily use PUBLISH/SUBSCRIBE to do fanout
# exchanges (broadcast), as an alternative to pushing messages to fanout-bound
# queues manually.


def get_redis_error_classes():
    from redis import exceptions
    # This exception suddenly changed name between redis-py versions
    if hasattr(exceptions, 'InvalidData'):
        DataError = exceptions.InvalidData
    else:
        DataError = exceptions.DataError
    return error_classes_t(
        (virtual.Transport.connection_errors + tuple(filter(None, (
            InconsistencyError,
            socket.error,
            IOError,
            OSError,
            exceptions.ConnectionError,
            exceptions.AuthenticationError,
            getattr(exceptions, 'TimeoutError', None))))),
        (virtual.Transport.channel_errors + (
            DataError,
            exceptions.InvalidResponse,
            exceptions.ResponseError)),
    )


def get_redis_ConnectionError():
    from redis import exceptions
    return exceptions.ConnectionError


class MutexHeld(Exception):
    pass


@contextmanager
def Mutex(client, name, expire):
    lock_id = uuid()
    i_won = client.setnx(name, lock_id)
    try:
        if i_won:
            client.expire(name, expire)
            yield
        else:
            if not client.ttl(name):
                client.expire(name, expire)
            raise MutexHeld()
    finally:
        if i_won:
            try:
                with client.pipeline(True) as pipe:
                    pipe.watch(name)
                    if pipe.get(name) == lock_id:
                        pipe.multi()
                        pipe.delete(name)
                        pipe.execute()
                    pipe.unwatch()
            except redis.WatchError:
                pass


class QoS(virtual.QoS):
    restore_at_shutdown = True

    def __init__(self, *args, **kwargs):
        super(QoS, self).__init__(*args, **kwargs)
        self._vrestore_count = 0

    def append(self, message, delivery_tag):
        delivery = message.delivery_info
        EX, RK = delivery['exchange'], delivery['routing_key']
        with self.pipe_or_acquire() as pipe:
            pipe.zadd(self.unacked_index_key, delivery_tag, time()) \
                .hset(self.unacked_key, delivery_tag,
                      dumps([message._raw, EX, RK])) \
                .execute()
            super(QoS, self).append(message, delivery_tag)

    def restore_unacked(self, client=None):
        with self.channel.conn_or_acquire(client) as client:
            for tag in self._delivered:
                self.restore_by_tag(tag, client=client)
        self._delivered.clear()

    def ack(self, delivery_tag):
        self._remove_from_indices(delivery_tag).execute()
        super(QoS, self).ack(delivery_tag)

    def reject(self, delivery_tag, requeue=False):
        if requeue:
            self.restore_by_tag(delivery_tag, leftmost=True)
        self.ack(delivery_tag)

    @contextmanager
    def pipe_or_acquire(self, pipe=None, client=None):
        if pipe:
            yield pipe
        else:
            with self.channel.conn_or_acquire(client) as client:
                yield client.pipeline()

    def _remove_from_indices(self, delivery_tag, pipe=None):
        with self.pipe_or_acquire(pipe) as pipe:
            return pipe.zrem(self.unacked_index_key, delivery_tag) \
                       .hdel(self.unacked_key, delivery_tag)

    def restore_visible(self, start=0, num=10, interval=10):
        self._vrestore_count += 1
        if (self._vrestore_count - 1) % interval:
            return
        with self.channel.conn_or_acquire() as client:
            ceil = time() - self.visibility_timeout
            try:
                with Mutex(client, self.unacked_mutex_key,
                           self.unacked_mutex_expire):
                    visible = client.zrevrangebyscore(
                        self.unacked_index_key, ceil, 0,
                        start=num and start, num=num, withscores=True)
                    for tag, score in visible or []:
                        self.restore_by_tag(tag, client)
            except MutexHeld:
                pass

    def restore_by_tag(self, tag, client=None, leftmost=False):
        with self.channel.conn_or_acquire(client) as client:
            with client.pipeline() as pipe:
                p, _, _ = self._remove_from_indices(
                    tag, pipe.hget(self.unacked_key, tag)).execute()
            if p:
                M, EX, RK = loads(bytes_to_str(p))  # json is unicode
                self.channel._do_restore_message(M, EX, RK, client, leftmost)

    @cached_property
    def unacked_key(self):
        return self.channel.unacked_key

    @cached_property
    def unacked_index_key(self):
        return self.channel.unacked_index_key

    @cached_property
    def unacked_mutex_key(self):
        return self.channel.unacked_mutex_key

    @cached_property
    def unacked_mutex_expire(self):
        return self.channel.unacked_mutex_expire

    @cached_property
    def visibility_timeout(self):
        return self.channel.visibility_timeout


class MultiChannelPoller(object):
    eventflags = READ | ERR

    #: Set by :meth:`get` while reading from the socket.
    _in_protected_read = False

    #: Set of one-shot callbacks to call after reading from socket.
    after_read = None

    def __init__(self):
        # active channels
        self._channels = set()
        # file descriptor -> channel map.
        self._fd_to_chan = {}
        # channel -> socket map
        self._chan_to_sock = {}
        # poll implementation (epoll/kqueue/select)
        self.poller = poll()
        # one-shot callbacks called after reading from socket.
        self.after_read = set()

    def close(self):
        for fd in values(self._chan_to_sock):
            try:
                self.poller.unregister(fd)
            except (KeyError, ValueError):
                pass
        self._channels.clear()
        self._fd_to_chan.clear()
        self._chan_to_sock.clear()

    def add(self, channel):
        self._channels.add(channel)

    def discard(self, channel):
        self._channels.discard(channel)

    def _on_connection_disconnect(self, connection):
        try:
            self.poller.unregister(connection._sock)
        except (AttributeError, TypeError):
            pass

    def _register(self, channel, client, type):
        if (channel, client, type) in self._chan_to_sock:
            self._unregister(channel, client, type)
        if client.connection._sock is None:   # not connected yet.
            client.connection.connect()
        sock = client.connection._sock
        self._fd_to_chan[sock.fileno()] = (channel, type)
        self._chan_to_sock[(channel, client, type)] = sock
        self.poller.register(sock, self.eventflags)

    def _unregister(self, channel, client, type):
        self.poller.unregister(self._chan_to_sock[(channel, client, type)])

    def _register_BRPOP(self, channel):
        """enable BRPOP mode for channel."""
        ident = channel, channel.client, 'BRPOP'
        if channel.client.connection._sock is None or \
                ident not in self._chan_to_sock:
            channel._in_poll = False
            self._register(*ident)

        if not channel._in_poll:  # send BRPOP
            channel._brpop_start()

    def _register_LISTEN(self, channel):
        """enable LISTEN mode for channel."""
        if channel.subclient.connection._sock is None:
            channel._in_listen = False
            self._register(channel, channel.subclient, 'LISTEN')
        if not channel._in_listen:
            channel._subscribe()  # send SUBSCRIBE

    def on_poll_start(self):
        for channel in self._channels:
            if channel.active_queues:           # BRPOP mode?
                if channel.qos.can_consume():
                    self._register_BRPOP(channel)
            if channel.active_fanout_queues:    # LISTEN mode?
                self._register_LISTEN(channel)

    def on_poll_init(self, poller):
        self.poller = poller
        for channel in self._channels:
            return channel.qos.restore_visible(
                num=channel.unacked_restore_limit,
            )

    def maybe_restore_messages(self):
        for channel in self._channels:
            if channel.active_queues:
                # only need to do this once, as they are not local to channel.
                return channel.qos.restore_visible(
                    num=channel.unacked_restore_limit,
                )

    def on_readable(self, fileno):
        try:
            chan, type = self._fd_to_chan[fileno]
        except KeyError:
            return
        if chan.qos.can_consume():
            return chan.handlers[type]()

    def handle_event(self, fileno, event):
        if event & READ:
            return self.on_readable(fileno), self
        elif event & ERR:
            chan, type = self._fd_to_chan[fileno]
            chan._poll_error(type)

    def get(self, timeout=None):
        self._in_protected_read = True
        try:
            for channel in self._channels:
                if channel.active_queues:           # BRPOP mode?
                    if channel.qos.can_consume():
                        self._register_BRPOP(channel)
                if channel.active_fanout_queues:    # LISTEN mode?
                    self._register_LISTEN(channel)

            events = self.poller.poll(timeout)
            for fileno, event in events or []:
                ret = self.handle_event(fileno, event)
                if ret:
                    return ret

            # - no new data, so try to restore messages.
            # - reset active redis commands.
            self.maybe_restore_messages()

            raise Empty()
        finally:
            self._in_protected_read = False
            while self.after_read:
                try:
                    fun = self.after_read.pop()
                except KeyError:
                    break
                else:
                    fun()

    @property
    def fds(self):
        return self._fd_to_chan


class Channel(virtual.Channel):
    QoS = QoS

    _client = None
    _subclient = None
    _closing = False
    supports_fanout = True
    keyprefix_queue = '_kombu.binding.%s'
    keyprefix_fanout = '/{db}.'
    sep = '\x06\x16'
    _in_poll = False
    _in_listen = False
    _fanout_queues = {}
    ack_emulation = True
    unacked_key = 'unacked'
    unacked_index_key = 'unacked_index'
    unacked_mutex_key = 'unacked_mutex'
    unacked_mutex_expire = 300  # 5 minutes
    unacked_restore_limit = None
    visibility_timeout = 3600   # 1 hour
    priority_steps = PRIORITY_STEPS
    socket_timeout = None
    socket_connect_timeout = None
    socket_keepalive = None
    socket_keepalive_options = None
    max_connections = 10
    #: Transport option to enable disable fanout keyprefix.
    #: Should be enabled by default, but that is not
    #: backwards compatible.  Can also be string, in which
    #: case it changes the default prefix ('/{db}.') into to something
    #: else.  The prefix must include a leading slash and a trailing dot.
    fanout_prefix = False

    #: If enabled the fanout exchange will support patterns in routing
    #: and binding keys (like a topic exchange but using PUB/SUB).
    #: This will be enabled by default in a future version.
    fanout_patterns = False

    _async_pool = None
    _pool = None
    _disconnecting_pools = False

    from_transport_options = (
        virtual.Channel.from_transport_options +
        ('ack_emulation',
         'unacked_key',
         'unacked_index_key',
         'unacked_mutex_key',
         'unacked_mutex_expire',
         'visibility_timeout',
         'unacked_restore_limit',
         'fanout_prefix',
         'fanout_patterns',
         'socket_timeout',
         'socket_connect_timeout',
         'socket_keepalive',
         'socket_keepalive_options',
         'queue_order_strategy',
         'max_connections',
         'priority_steps')  # <-- do not add comma here!
    )

    def __init__(self, *args, **kwargs):
        super_ = super(Channel, self)
        super_.__init__(*args, **kwargs)

        if not self.ack_emulation:  # disable visibility timeout
            self.QoS = virtual.QoS

        self._queue_cycle = []
        self.AsyncClient = self._get_async_client()
        self.Client = redis.Redis
        self.ResponseError = self._get_response_error()
        self.active_fanout_queues = set()
        self.auto_delete_queues = set()
        self._fanout_to_queue = {}
        self.handlers = {'BRPOP': self._brpop_read, 'LISTEN': self._receive}

        if self.fanout_prefix:
            if isinstance(self.fanout_prefix, string_t):
                self.keyprefix_fanout = self.fanout_prefix
        else:
            # previous versions did not set a fanout, so cannot enable
            # by default.
            self.keyprefix_fanout = ''

        # Evaluate connection.
        try:
            self.client.info()
        except Exception:
            self._disconnect_pools()
            raise

        self.connection.cycle.add(self)  # add to channel poller.
        # copy errors, in case channel closed but threads still
        # are still waiting for data.
        self.connection_errors = self.connection.connection_errors

        register_after_fork(self, self._after_fork)

    def _after_fork(self):
        self._disconnect_pools()

    def _disconnect_pools(self):
        if not self._disconnecting_pools:
            self._disconnecting_pools = True
            try:
                if self._async_pool is not None:
                    self._async_pool.disconnect()
                if self._pool is not None:
                    self._pool.disconnect()
                self._async_pool = self._pool = None
            finally:
                self._disconnecting_pools = False

    def _on_connection_disconnect(self, connection):
        self._in_poll = False
        self._in_listen = False
        if self.connection and self.connection.cycle:
            self.connection.cycle._on_connection_disconnect(connection)
        self._disconnect_pools()
        if not self._closing:
            raise get_redis_ConnectionError()

    def _do_restore_message(self, payload, exchange, routing_key,
                            client=None, leftmost=False):
        with self.conn_or_acquire(client) as client:
            try:
                try:
                    payload['headers']['redelivered'] = True
                except KeyError:
                    pass
                for queue in self._lookup(exchange, routing_key):
                    (client.lpush if leftmost else client.rpush)(
                        queue, dumps(payload),
                    )
            except Exception:
                crit('Could not restore message: %r', payload, exc_info=True)

    def _restore(self, message, leftmost=False):
        if not self.ack_emulation:
            return super(Channel, self)._restore(message)
        tag = message.delivery_tag
        with self.conn_or_acquire() as client:
            with client.pipeline() as pipe:
                P, _ = pipe.hget(self.unacked_key, tag) \
                           .hdel(self.unacked_key, tag) \
                           .execute()
            if P:
                M, EX, RK = loads(bytes_to_str(P))  # json is unicode
                self._do_restore_message(M, EX, RK, client, leftmost)

    def _restore_at_beginning(self, message):
        return self._restore(message, leftmost=True)

    def basic_consume(self, queue, *args, **kwargs):
        if queue in self._fanout_queues:
            exchange, _ = self._fanout_queues[queue]
            self.active_fanout_queues.add(queue)
            self._fanout_to_queue[exchange] = queue
        ret = super(Channel, self).basic_consume(queue, *args, **kwargs)
        self._update_cycle()
        return ret

    def basic_cancel(self, consumer_tag):
        # If we are busy reading messages we may experience
        # a race condition where a message is consumed after
        # cancelling, so we must delay this operation until reading
        # is complete (Issue celery/celery#1773).
        connection = self.connection
        if connection:
            if connection.cycle._in_protected_read:
                return connection.cycle.after_read.add(
                    promise(self._basic_cancel, (consumer_tag, )),
                )
            return self._basic_cancel(consumer_tag)

    def _basic_cancel(self, consumer_tag):
        try:
            queue = self._tag_to_queue[consumer_tag]
        except KeyError:
            return
        try:
            self.active_fanout_queues.remove(queue)
        except KeyError:
            pass
        else:
            self._unsubscribe_from(queue)
        try:
            exchange, _ = self._fanout_queues[queue]
            self._fanout_to_queue.pop(exchange)
        except KeyError:
            pass
        ret = super(Channel, self).basic_cancel(consumer_tag)
        self._update_cycle()
        return ret

    def _get_publish_topic(self, exchange, routing_key):
        if routing_key and self.fanout_patterns:
            return ''.join([self.keyprefix_fanout, exchange, '/', routing_key])
        return ''.join([self.keyprefix_fanout, exchange])

    def _get_subscribe_topic(self, queue):
        exchange, routing_key = self._fanout_queues[queue]
        return self._get_publish_topic(exchange, routing_key)

    def _subscribe(self):
        keys = [self._get_subscribe_topic(queue)
                for queue in self.active_fanout_queues]
        if not keys:
            return
        c = self.subclient
        if c.connection._sock is None:
            c.connection.connect()
        self._in_listen = True
        c.psubscribe(keys)

    def _unsubscribe_from(self, queue):
        topic = self._get_subscribe_topic(queue)
        c = self.subclient
        should_disconnect = False
        if c.connection._sock is None:
            c.connection.connect()
            should_disconnect = True
        try:
            c.unsubscribe([topic])
        finally:
            if should_disconnect and c.connection:
                c.connection.disconnect()

    def _handle_message(self, client, r):
        if bytes_to_str(r[0]) == 'unsubscribe' and r[2] == 0:
            client.subscribed = False
        elif bytes_to_str(r[0]) == 'pmessage':
            return {'type':    r[0], 'pattern': r[1],
                    'channel': r[2], 'data':    r[3]}
        else:
            return {'type':    r[0], 'pattern': None,
                    'channel': r[1], 'data':    r[2]}

    def _receive(self):
        c = self.subclient
        response = None
        try:
            response = c.parse_response()
        except self.connection_errors:
            self._in_listen = False
            raise Empty()
        if response is not None:
            payload = self._handle_message(c, response)
            if bytes_to_str(payload['type']).endswith('message'):
                channel = bytes_to_str(payload['channel'])
                if payload['data']:
                    if channel[0] == '/':
                        _, _, channel = channel.partition('.')
                    try:
                        message = loads(bytes_to_str(payload['data']))
                    except (TypeError, ValueError):
                        warn('Cannot process event on channel %r: %s',
                             channel, repr(payload)[:4096], exc_info=1)
                        raise Empty()
                    exchange = channel.split('/', 1)[0]
                    return message, self._fanout_to_queue[exchange]
        raise Empty()

    def _brpop_start(self, timeout=1):
        queues = self._consume_cycle()
        if not queues:
            return
        keys = [self._q_for_pri(queue, pri) for pri in PRIORITY_STEPS
                for queue in queues] + [timeout or 0]
        self._in_poll = True
        self.client.connection.send_command('BRPOP', *keys)

    def _brpop_read(self, **options):
        try:
            try:
                dest__item = self.client.parse_response(self.client.connection,
                                                        'BRPOP',
                                                        **options)
            except self.connection_errors:
                # if there's a ConnectionError, disconnect so the next
                # iteration will reconnect automatically.
                self.client.connection.disconnect()
                raise Empty()
            if dest__item:
                dest, item = dest__item
                dest = bytes_to_str(dest).rsplit(self.sep, 1)[0]
                self._rotate_cycle(dest)
                return loads(bytes_to_str(item)), dest
            else:
                raise Empty()
        finally:
            self._in_poll = False

    def _poll_error(self, type, **options):
        if type == 'LISTEN':
            self.subclient.parse_response()
        else:
            self.client.parse_response(self.client.connection, type)

    def _get(self, queue):
        with self.conn_or_acquire() as client:
            for pri in PRIORITY_STEPS:
                item = client.rpop(self._q_for_pri(queue, pri))
                if item:
                    return loads(bytes_to_str(item))
            raise Empty()

    def _size(self, queue):
        with self.conn_or_acquire() as client:
            with client.pipeline() as pipe:
                for pri in PRIORITY_STEPS:
                    pipe = pipe.llen(self._q_for_pri(queue, pri))
                sizes = pipe.execute()
                return sum(size for size in sizes
                           if isinstance(size, numbers.Integral))

    def _q_for_pri(self, queue, pri):
        pri = self.priority(pri)
        return '%s%s%s' % ((queue, self.sep, pri) if pri else (queue, '', ''))

    def priority(self, n):
        steps = self.priority_steps
        return steps[bisect(steps, n) - 1]

    def _put(self, queue, message, **kwargs):
        """Deliver message."""
        try:
            pri = max(min(int(
                message['properties']['delivery_info']['priority']), 9), 0)
        except (TypeError, ValueError, KeyError):
            pri = 0
        with self.conn_or_acquire() as client:
            client.lpush(self._q_for_pri(queue, pri), dumps(message))

    def _put_fanout(self, exchange, message, routing_key, **kwargs):
        """Deliver fanout message."""
        with self.conn_or_acquire() as client:
            client.publish(
                self._get_publish_topic(exchange, routing_key),
                dumps(message),
            )

    def _new_queue(self, queue, auto_delete=False, **kwargs):
        if auto_delete:
            self.auto_delete_queues.add(queue)

    def _queue_bind(self, exchange, routing_key, pattern, queue):
        if self.typeof(exchange).type == 'fanout':
            # Mark exchange as fanout.
            self._fanout_queues[queue] = (
                exchange, routing_key.replace('#', '*'),
            )
        with self.conn_or_acquire() as client:
            client.sadd(self.keyprefix_queue % (exchange, ),
                        self.sep.join([routing_key or '',
                                       pattern or '',
                                       queue or '']))

    def _delete(self, queue, exchange, routing_key, pattern, *args):
        self.auto_delete_queues.discard(queue)
        with self.conn_or_acquire() as client:
            client.srem(self.keyprefix_queue % (exchange, ),
                        self.sep.join([routing_key or '',
                                       pattern or '',
                                       queue or '']))
            with client.pipeline() as pipe:
                for pri in PRIORITY_STEPS:
                    pipe = pipe.delete(self._q_for_pri(queue, pri))
                pipe.execute()

    def _has_queue(self, queue, **kwargs):
        with self.conn_or_acquire() as client:
            with client.pipeline() as pipe:
                for pri in PRIORITY_STEPS:
                    pipe = pipe.exists(self._q_for_pri(queue, pri))
                return any(pipe.execute())

    def get_table(self, exchange):
        key = self.keyprefix_queue % exchange
        with self.conn_or_acquire() as client:
            values = client.smembers(key)
            if not values:
                raise InconsistencyError(NO_ROUTE_ERROR.format(exchange, key))
            return [tuple(bytes_to_str(val).split(self.sep)) for val in values]

    def _purge(self, queue):
        with self.conn_or_acquire() as client:
            with client.pipeline() as pipe:
                for pri in PRIORITY_STEPS:
                    priq = self._q_for_pri(queue, pri)
                    pipe = pipe.llen(priq).delete(priq)
                sizes = pipe.execute()
                return sum(sizes[::2])

    def close(self):
        self._closing = True
        self._disconnect_pools()
        if not self.closed:
            # remove from channel poller.
            self.connection.cycle.discard(self)

            # delete fanout bindings
            for queue in self._fanout_queues:
                if queue in self.auto_delete_queues:
                    self.queue_delete(queue)

            self._close_clients()

        super(Channel, self).close()

    def _close_clients(self):
        # Close connections
        for attr in 'client', 'subclient':
            try:
                self.__dict__[attr].connection.disconnect()
            except (KeyError, AttributeError, self.ResponseError):
                pass

    def _prepare_virtual_host(self, vhost):
        if not isinstance(vhost, numbers.Integral):
            if not vhost or vhost == '/':
                vhost = DEFAULT_DB
            elif vhost.startswith('/'):
                vhost = vhost[1:]
            try:
                vhost = int(vhost)
            except ValueError:
                raise ValueError(
                    'Database is int between 0 and limit - 1, not {0}'.format(
                        vhost,
                    ))
        return vhost

    def _filter_tcp_connparams(self, socket_keepalive=None,
                               socket_keepalive_options=None, **params):
        return params

    def _connparams(self, async=False, _r210_options=(
            'socket_connect_timeout', 'socket_keepalive',
            'socket_keepalive_options')):
        conninfo = self.connection.client
        connparams = {
            'host': conninfo.hostname or '127.0.0.1',
            'port': conninfo.port or DEFAULT_PORT,
            'virtual_host': conninfo.virtual_host,
            'password': conninfo.password,
            'max_connections': self.max_connections,
            'socket_timeout': self.socket_timeout,
            'socket_connect_timeout': self.socket_connect_timeout,
            'socket_keepalive': self.socket_keepalive,
            'socket_keepalive_options': self.socket_keepalive_options,
        }
        if redis.VERSION < (2, 10):
            for param in _r210_options:
                val = connparams.pop(param, None)
                if val is not None:
                    raise VersionMismatch(
                        'redis: {0!r} requires redis 2.10.0 or higher'.format(
                            param))
        host = connparams['host']
        if '://' in host:
            scheme, _, _, _, password, path, query = _parse_url(host)
            if scheme == 'socket':
                connparams = self._filter_tcp_connparams(**connparams)
                connparams.update({
                    'connection_class': redis.UnixDomainSocketConnection,
                    'path': '/' + path,
                    'password': password}, **query)

                connparams.pop('socket_connect_timeout', None)
                connparams.pop('socket_keepalive', None)
                connparams.pop('socket_keepalive_options', None)

            connparams.pop('host', None)
            connparams.pop('port', None)
        connparams['db'] = self._prepare_virtual_host(
            connparams.pop('virtual_host', None))

        channel = self
        connection_cls = (
            connparams.get('connection_class') or
            redis.Connection
        )

        if async:
            class Connection(connection_cls):
                def disconnect(self):
                    super(Connection, self).disconnect()
                    channel._on_connection_disconnect(self)
            connparams['connection_class'] = Connection

        return connparams

    def _create_client(self, async=False):
        if async:
            return self.AsyncClient(connection_pool=self.async_pool)
        return self.Client(connection_pool=self.pool)

    def _get_pool(self, async=False):
        params = self._connparams(async=async)
        self.keyprefix_fanout = self.keyprefix_fanout.format(db=params['db'])
        return redis.ConnectionPool(**params)

    def _get_async_client(self):
        if redis.VERSION < (2, 4, 4):
            raise VersionMismatch(
                'Redis transport requires redis-py versions 2.4.4 or later. '
                'You have {0.__version__}'.format(redis))

        # AsyncRedis maintains a connection attribute on it's instance and
        # uses that when executing commands
        # This was added after redis-py was changed.
        class AsyncRedis(redis.Redis):  # pragma: no cover

            def __init__(self, *args, **kwargs):
                super(AsyncRedis, self).__init__(*args, **kwargs)
                self.connection = self.connection_pool.get_connection('_')

        return AsyncRedis

    @contextmanager
    def conn_or_acquire(self, client=None):
        if client:
            yield client
        else:
            yield self._create_client()

    @property
    def pool(self):
        if self._pool is None:
            self._pool = self._get_pool()
        return self._pool

    @property
    def async_pool(self):
        if self._async_pool is None:
            self._async_pool = self._get_pool(async=True)
        return self._async_pool

    @cached_property
    def client(self):
        """Client used to publish messages, BRPOP etc."""
        return self._create_client(async=True)

    @cached_property
    def subclient(self):
        """Pub/Sub connection used to consume fanout queues."""
        client = self._create_client(async=True)
        pubsub = client.pubsub()
        pool = pubsub.connection_pool
        pubsub.connection = pool.get_connection('pubsub', pubsub.shard_hint)
        return pubsub

    def _update_cycle(self):
        """Update fair cycle between queues.

        We cycle between queues fairly to make sure that
        each queue is equally likely to be consumed from,
        so that a very busy queue will not block others.

        This works by using Redis's `BRPOP` command and
        by rotating the most recently used queue to the
        and of the list.  See Kombu github issue #166 for
        more discussion of this method.

        """
        self._queue_cycle = list(self.active_queues)

    def _consume_cycle(self):
        """Get a fresh list of queues from the queue cycle."""
        active = len(self.active_queues)
        return self._queue_cycle[0:active]

    def _rotate_cycle(self, used):
        """Move most recently used queue to end of list."""
        cycle = self._queue_cycle
        try:
            cycle.append(cycle.pop(cycle.index(used)))
        except ValueError:
            pass

    def _get_response_error(self):
        from redis import exceptions
        return exceptions.ResponseError

    @property
    def active_queues(self):
        """Set of queues being consumed from (excluding fanout queues)."""
        return set(queue for queue in self._active_queues
                   if queue not in self.active_fanout_queues)


class Transport(virtual.Transport):
    Channel = Channel

    polling_interval = None  # disable sleep between unsuccessful polls.
    default_port = DEFAULT_PORT
    supports_ev = True
    driver_type = 'redis'
    driver_name = 'redis'

    def __init__(self, *args, **kwargs):
        if redis is None:
            raise ImportError('Missing redis library (pip install redis)')
        super(Transport, self).__init__(*args, **kwargs)

        # Get redis-py exceptions.
        self.connection_errors, self.channel_errors = self._get_errors()
        # All channels share the same poller.
        self.cycle = MultiChannelPoller()

    def driver_version(self):
        return redis.__version__

    def register_with_event_loop(self, connection, loop):
        cycle = self.cycle
        cycle.on_poll_init(loop.poller)
        cycle_poll_start = cycle.on_poll_start
        add_reader = loop.add_reader
        on_readable = self.on_readable

        def _on_disconnect(connection):
            if connection._sock:
                loop.remove(connection._sock)
        cycle._on_connection_disconnect = _on_disconnect

        def on_poll_start():
            cycle_poll_start()
            [add_reader(fd, on_readable, fd) for fd in cycle.fds]
        loop.on_tick.add(on_poll_start)
        loop.call_repeatedly(10, cycle.maybe_restore_messages)

    def on_readable(self, fileno):
        """Handle AIO event for one of our file descriptors."""
        item = self.cycle.on_readable(fileno)
        if item:
            message, queue = item
            if not queue or queue not in self._callbacks:
                raise KeyError(
                    'Message for queue {0!r} without consumers: {1}'.format(
                        queue, message))
            self._callbacks[queue](message)

    def _get_errors(self):
        """Utility to import redis-py's exceptions at runtime."""
        return get_redis_error_classes()
