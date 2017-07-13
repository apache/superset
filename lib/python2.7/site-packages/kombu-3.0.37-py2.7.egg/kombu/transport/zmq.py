"""
kombu.transport.zmq
===================

ZeroMQ transport.

"""
from __future__ import absolute_import

import errno
import os
import socket

try:
    import zmq
    from zmq import ZMQError
except ImportError:
    zmq = ZMQError = None  # noqa

from kombu.five import Empty
from kombu.log import get_logger
from kombu.serialization import pickle
from kombu.utils import cached_property
from kombu.utils.eventio import poll, READ

from . import virtual

logger = get_logger('kombu.transport.zmq')

DEFAULT_PORT = 5555
DEFAULT_HWM = 128
DEFAULT_INCR = 1

dumps, loads = pickle.dumps, pickle.loads


class MultiChannelPoller(object):
    eventflags = READ

    def __init__(self):
        # active channels
        self._channels = set()
        # file descriptor -> channel map
        self._fd_to_chan = {}
        # poll implementation (epoll/kqueue/select)
        self.poller = poll()

    def close(self):
        for fd in self._fd_to_chan:
            try:
                self.poller.unregister(fd)
            except KeyError:
                pass
        self._channels.clear()
        self._fd_to_chan.clear()
        self.poller = None

    def add(self, channel):
        self._channels.add(channel)

    def discard(self, channel):
        self._channels.discard(channel)
        self._fd_to_chan.pop(channel.client.connection.fd, None)

    def _register(self, channel):
        conn = channel.client.connection
        self._fd_to_chan[conn.fd] = channel
        self.poller.register(conn.fd, self.eventflags)

    def on_poll_start(self):
        for channel in self._channels:
            self._register(channel)

    def on_readable(self, fileno):
        chan = self._fd_to_chan[fileno]
        return chan.drain_events(), chan

    def get(self, timeout=None):
        self.on_poll_start()

        events = self.poller.poll(timeout)
        for fileno, _ in events or []:
            return self.on_readable(fileno)

        raise Empty()

    @property
    def fds(self):
        return self._fd_to_chan


class Client(object):

    def __init__(self, uri='tcp://127.0.0.1', port=DEFAULT_PORT,
                 hwm=DEFAULT_HWM, swap_size=None, enable_sink=True,
                 context=None):
        try:
            scheme, parts = uri.split('://')
        except ValueError:
            scheme = 'tcp'
            parts = uri
        endpoints = parts.split(';')
        self.port = port

        if scheme != 'tcp':
            raise NotImplementedError('Currently only TCP can be used')

        self.context = context or zmq.Context.instance()

        if enable_sink:
            self.sink = self.context.socket(zmq.PULL)
            self.sink.bind('tcp://*:{0.port}'.format(self))
        else:
            self.sink = None

        self.vent = self.context.socket(zmq.PUSH)

        if hasattr(zmq, 'SNDHWM'):
            self.vent.setsockopt(zmq.SNDHWM, hwm)
        else:
            self.vent.setsockopt(zmq.HWM, hwm)

        if swap_size:
            self.vent.setsockopt(zmq.SWAP, swap_size)

        for endpoint in endpoints:
            if scheme == 'tcp' and ':' not in endpoint:
                endpoint += ':' + str(DEFAULT_PORT)

            endpoint = ''.join([scheme, '://', endpoint])

            self.connect(endpoint)

    def connect(self, endpoint):
        self.vent.connect(endpoint)

    def get(self, queue=None, timeout=None):
        sink = self.sink
        try:
            if timeout is not None:
                prev_timeout, sink.RCVTIMEO = sink.RCVTIMEO, timeout
                try:
                    return sink.recv()
                finally:
                    sink.RCVTIMEO = prev_timeout
            else:
                return sink.recv()
        except ZMQError as exc:
            if exc.errno == zmq.EAGAIN:
                raise socket.error(errno.EAGAIN, exc.strerror)
            else:
                raise

    def put(self, queue, message, **kwargs):
        return self.vent.send(message)

    def close(self):
        if self.sink and not self.sink.closed:
            self.sink.close()
        if not self.vent.closed:
            self.vent.close()

    @property
    def connection(self):
        if self.sink:
            return self.sink
        return self.vent


class Channel(virtual.Channel):
    Client = Client

    hwm = DEFAULT_HWM
    swap_size = None
    enable_sink = True
    port_incr = DEFAULT_INCR

    from_transport_options = (
        virtual.Channel.from_transport_options +
        ('hwm', 'swap_size', 'enable_sink', 'port_incr')
    )

    def __init__(self, *args, **kwargs):
        super_ = super(Channel, self)
        super_.__init__(*args, **kwargs)

        # Evaluate socket
        self.client.connection.closed

        self.connection.cycle.add(self)
        self.connection_errors = self.connection.connection_errors

    def _get(self, queue, timeout=None):
        try:
            return loads(self.client.get(queue, timeout))
        except socket.error as exc:
            if exc.errno == errno.EAGAIN and timeout != 0:
                raise Empty()
            else:
                raise

    def _put(self, queue, message, **kwargs):
        self.client.put(queue, dumps(message, -1), **kwargs)

    def _purge(self, queue):
        return 0

    def _poll(self, cycle, timeout=None):
        return cycle.get(timeout=timeout)

    def close(self):
        if not self.closed:
            self.connection.cycle.discard(self)
            try:
                self.__dict__['client'].close()
            except KeyError:
                pass
        super(Channel, self).close()

    def _prepare_port(self, port):
        return (port + self.channel_id - 1) * self.port_incr

    def _create_client(self):
        conninfo = self.connection.client
        port = self._prepare_port(conninfo.port or DEFAULT_PORT)
        return self.Client(uri=conninfo.hostname or 'tcp://127.0.0.1',
                           port=port,
                           hwm=self.hwm,
                           swap_size=self.swap_size,
                           enable_sink=self.enable_sink,
                           context=self.connection.context)

    @cached_property
    def client(self):
        return self._create_client()


class Transport(virtual.Transport):
    Channel = Channel

    can_parse_url = True
    default_port = DEFAULT_PORT
    driver_type = 'zeromq'
    driver_name = 'zmq'

    connection_errors = virtual.Transport.connection_errors + (ZMQError, )

    supports_ev = True
    polling_interval = None

    def __init__(self, *args, **kwargs):
        if zmq is None:
            raise ImportError('The zmq library is not installed')
        super(Transport, self).__init__(*args, **kwargs)
        self.cycle = MultiChannelPoller()

    def driver_version(self):
        return zmq.__version__

    def register_with_event_loop(self, connection, loop):
        cycle = self.cycle
        cycle.poller = loop.poller
        add_reader = loop.add_reader
        on_readable = self.on_readable

        cycle_poll_start = cycle.on_poll_start

        def on_poll_start():
            cycle_poll_start()
            [add_reader(fd, on_readable, fd) for fd in cycle.fds]

        loop.on_tick.add(on_poll_start)

    def on_readable(self, fileno):
        self._handle_event(self.cycle.on_readable(fileno))

    def drain_events(self, connection, timeout=None):
        more_to_read = False
        for channel in connection.channels:
            try:
                evt = channel.cycle.get(timeout=timeout)
            except socket.error as exc:
                if exc.errno == errno.EAGAIN:
                    continue
                raise
            else:
                connection._handle_event((evt, channel))
                more_to_read = True
        if not more_to_read:
            raise socket.error(errno.EAGAIN, os.strerror(errno.EAGAIN))

    def _handle_event(self, evt):
        item, channel = evt
        message, queue = item
        if not queue or queue not in self._callbacks:
            raise KeyError(
                'Message for queue {0!r} without consumers: {1}'.format(
                    queue, message))
        self._callbacks[queue](message)

    def establish_connection(self):
        self.context.closed
        return super(Transport, self).establish_connection()

    def close_connection(self, connection):
        super(Transport, self).close_connection(connection)
        try:
            connection.__dict__['context'].term()
        except KeyError:
            pass

    @cached_property
    def context(self):
        return zmq.Context(1)
