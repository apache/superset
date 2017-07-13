"""
kombu.transport.amqplib
=======================

amqplib transport.

"""
from __future__ import absolute_import

import errno
import socket

from kombu.five import items
from kombu.utils.encoding import str_to_bytes
from kombu.utils.amq_manager import get_manager

from . import base

try:
    from ssl import SSLError
except ImportError:
    class SSLError(Exception):  # noqa
        pass
from struct import unpack


class NA(object):
    pass

try:
    from amqplib import client_0_8 as amqp
    from amqplib.client_0_8 import transport
    from amqplib.client_0_8.channel import Channel as _Channel
    from amqplib.client_0_8.exceptions import AMQPConnectionException
    from amqplib.client_0_8.exceptions import AMQPChannelException
except ImportError:  # pragma: no cover

    class NAx(object):
        pass
    amqp = NA
    amqp.Connection = NA
    transport = _Channel = NA                               # noqa
    # Sphinx crashes if this is NA, must be different class
    transport.TCPTransport = transport.SSLTransport = NAx
    AMQPConnectionException = AMQPChannelException = NA     # noqa

DEFAULT_PORT = 5672
HAS_MSG_PEEK = hasattr(socket, 'MSG_PEEK')

# amqplib's handshake mistakenly identifies as protocol version 1191,
# this breaks in RabbitMQ tip, which no longer falls back to
# 0-8 for unknown ids.
transport.AMQP_PROTOCOL_HEADER = str_to_bytes('AMQP\x01\x01\x08\x00')


# - fixes warnings when socket is not connected.
class TCPTransport(transport.TCPTransport):

    def read_frame(self):
        frame_type, channel, size = unpack('>BHI', self._read(7, True))
        payload = self._read(size)
        ch = ord(self._read(1))
        if ch == 206:  # '\xce'
            return frame_type, channel, payload
        else:
            raise Exception(
                'Framing Error, received 0x%02x while expecting 0xce' % ch)

    def _read(self, n, initial=False):
        read_buffer = self._read_buffer
        while len(read_buffer) < n:
            try:
                s = self.sock.recv(n - len(read_buffer))
            except socket.error as exc:
                if not initial and exc.errno in (errno.EAGAIN, errno.EINTR):
                    continue
                raise
            if not s:
                raise IOError('Socket closed')
            read_buffer += s

        result = read_buffer[:n]
        self._read_buffer = read_buffer[n:]

        return result

    def __del__(self):
        try:
            self.close()
        except Exception:
            pass
        finally:
            self.sock = None

transport.TCPTransport = TCPTransport


class SSLTransport(transport.SSLTransport):

    def __init__(self, host, connect_timeout, ssl):
        if isinstance(ssl, dict):
            self.sslopts = ssl
        self.sslobj = None

        transport._AbstractTransport.__init__(self, host, connect_timeout)

    def read_frame(self):
        frame_type, channel, size = unpack('>BHI', self._read(7, True))
        payload = self._read(size)
        ch = ord(self._read(1))
        if ch == 206:  # '\xce'
            return frame_type, channel, payload
        else:
            raise Exception(
                'Framing Error, received 0x%02x while expecting 0xce' % ch)

    def _read(self, n, initial=False):
        result = ''

        while len(result) < n:
            try:
                s = self.sslobj.read(n - len(result))
            except socket.error as exc:
                if not initial and exc.errno in (errno.EAGAIN, errno.EINTR):
                    continue
                raise
            if not s:
                raise IOError('Socket closed')
            result += s

        return result

    def __del__(self):
        try:
            self.close()
        except Exception:
            pass
        finally:
            self.sock = None
transport.SSLTransport = SSLTransport


class Connection(amqp.Connection):  # pragma: no cover
    connected = True

    def _do_close(self, *args, **kwargs):
        # amqplib does not ignore socket errors when connection
        # is closed on the remote end.
        try:
            super(Connection, self)._do_close(*args, **kwargs)
        except socket.error:
            pass

    def _dispatch_basic_return(self, channel, args, msg):
        reply_code = args.read_short()
        reply_text = args.read_shortstr()
        exchange = args.read_shortstr()
        routing_key = args.read_shortstr()

        exc = AMQPChannelException(reply_code, reply_text, (50, 60))
        if channel.events['basic_return']:
            for callback in channel.events['basic_return']:
                callback(exc, exchange, routing_key, msg)
        else:
            raise exc

    def __init__(self, *args, **kwargs):
        super(Connection, self).__init__(*args, **kwargs)
        self._method_override = {(60, 50): self._dispatch_basic_return}

    def drain_events(self, timeout=None):
        """Wait for an event on a channel."""
        chanmap = self.channels
        chanid, method_sig, args, content = self._wait_multiple(
            chanmap, None, timeout=timeout)

        channel = chanmap[chanid]

        if (content and
                channel.auto_decode and
                hasattr(content, 'content_encoding')):
            try:
                content.body = content.body.decode(content.content_encoding)
            except Exception:
                pass

        amqp_method = self._method_override.get(method_sig) or \
            channel._METHOD_MAP.get(method_sig, None)

        if amqp_method is None:
            raise Exception('Unknown AMQP method (%d, %d)' % method_sig)

        if content is None:
            return amqp_method(channel, args)
        else:
            return amqp_method(channel, args, content)

    def read_timeout(self, timeout=None):
        if timeout is None:
            return self.method_reader.read_method()
        sock = self.transport.sock
        prev = sock.gettimeout()
        if prev != timeout:
            sock.settimeout(timeout)
        try:
            try:
                return self.method_reader.read_method()
            except SSLError as exc:
                # http://bugs.python.org/issue10272
                if 'timed out' in str(exc):
                    raise socket.timeout()
                # Non-blocking SSL sockets can throw SSLError
                if 'The operation did not complete' in str(exc):
                    raise socket.timeout()
                raise
        finally:
            if prev != timeout:
                sock.settimeout(prev)

    def _wait_multiple(self, channels, allowed_methods, timeout=None):
        for channel_id, channel in items(channels):
            method_queue = channel.method_queue
            for queued_method in method_queue:
                method_sig = queued_method[0]
                if (allowed_methods is None or
                        method_sig in allowed_methods or
                        method_sig == (20, 40)):
                    method_queue.remove(queued_method)
                    method_sig, args, content = queued_method
                    return channel_id, method_sig, args, content

        # Nothing queued, need to wait for a method from the peer
        read_timeout = self.read_timeout
        wait = self.wait
        while 1:
            channel, method_sig, args, content = read_timeout(timeout)

            if (channel in channels and
                    allowed_methods is None or
                    method_sig in allowed_methods or
                    method_sig == (20, 40)):
                return channel, method_sig, args, content

            # Not the channel and/or method we were looking for. Queue
            # this method for later
            channels[channel].method_queue.append((method_sig, args, content))

            #
            # If we just queued up a method for channel 0 (the Connection
            # itself) it's probably a close method in reaction to some
            # error, so deal with it right away.
            #
            if channel == 0:
                wait()

    def channel(self, channel_id=None):
        try:
            return self.channels[channel_id]
        except KeyError:
            return Channel(self, channel_id)


class Message(base.Message):

    def __init__(self, channel, msg, **kwargs):
        props = msg.properties
        super(Message, self).__init__(
            channel,
            body=msg.body,
            delivery_tag=msg.delivery_tag,
            content_type=props.get('content_type'),
            content_encoding=props.get('content_encoding'),
            delivery_info=msg.delivery_info,
            properties=msg.properties,
            headers=props.get('application_headers') or {},
            **kwargs)


class Channel(_Channel, base.StdChannel):
    Message = Message
    events = {'basic_return': set()}

    def __init__(self, *args, **kwargs):
        self.no_ack_consumers = set()
        super(Channel, self).__init__(*args, **kwargs)

    def prepare_message(self, body, priority=None, content_type=None,
                        content_encoding=None, headers=None, properties=None):
        """Encapsulate data into a AMQP message."""
        return amqp.Message(body, priority=priority,
                            content_type=content_type,
                            content_encoding=content_encoding,
                            application_headers=headers,
                            **properties)

    def message_to_python(self, raw_message):
        """Convert encoded message body back to a Python value."""
        return self.Message(self, raw_message)

    def close(self):
        try:
            super(Channel, self).close()
        finally:
            self.connection = None

    def basic_consume(self, *args, **kwargs):
        consumer_tag = super(Channel, self).basic_consume(*args, **kwargs)
        if kwargs['no_ack']:
            self.no_ack_consumers.add(consumer_tag)
        return consumer_tag

    def basic_cancel(self, consumer_tag, **kwargs):
        self.no_ack_consumers.discard(consumer_tag)
        return super(Channel, self).basic_cancel(consumer_tag, **kwargs)


class Transport(base.Transport):
    Connection = Connection

    default_port = DEFAULT_PORT

    # it's very annoying that amqplib sometimes raises AttributeError
    # if the connection is lost, but nothing we can do about that here.
    connection_errors = (
        base.Transport.connection_errors + (
            AMQPConnectionException,
            socket.error, IOError, OSError, AttributeError)
    )
    channel_errors = base.Transport.channel_errors + (AMQPChannelException, )

    driver_name = 'amqplib'
    driver_type = 'amqp'
    supports_ev = True

    def __init__(self, client, **kwargs):
        self.client = client
        self.default_port = kwargs.get('default_port') or self.default_port

        if amqp is NA:
            raise ImportError('Missing amqplib library (pip install amqplib)')

    def create_channel(self, connection):
        return connection.channel()

    def drain_events(self, connection, **kwargs):
        return connection.drain_events(**kwargs)

    def establish_connection(self):
        """Establish connection to the AMQP broker."""
        conninfo = self.client
        for name, default_value in items(self.default_connection_params):
            if not getattr(conninfo, name, None):
                setattr(conninfo, name, default_value)
        if conninfo.hostname == 'localhost':
            conninfo.hostname = '127.0.0.1'
        conn = self.Connection(host=conninfo.host,
                               userid=conninfo.userid,
                               password=conninfo.password,
                               login_method=conninfo.login_method,
                               virtual_host=conninfo.virtual_host,
                               insist=conninfo.insist,
                               ssl=conninfo.ssl,
                               connect_timeout=conninfo.connect_timeout)
        conn.client = self.client
        return conn

    def close_connection(self, connection):
        """Close the AMQP broker connection."""
        connection.client = None
        connection.close()

    def is_alive(self, connection):
        if HAS_MSG_PEEK:
            sock = connection.transport.sock
            prev = sock.gettimeout()
            sock.settimeout(0.0001)
            try:
                sock.recv(1, socket.MSG_PEEK)
            except socket.timeout:
                pass
            except socket.error:
                return False
            finally:
                sock.settimeout(prev)
        return True

    def verify_connection(self, connection):
        return connection.channels is not None and self.is_alive(connection)

    def register_with_event_loop(self, connection, loop):
        loop.add_reader(connection.method_reader.source.sock,
                        self.on_readable, connection, loop)

    @property
    def default_connection_params(self):
        return {'userid': 'guest', 'password': 'guest',
                'port': self.default_port,
                'hostname': 'localhost', 'login_method': 'AMQPLAIN'}

    def get_manager(self, *args, **kwargs):
        return get_manager(self.client, *args, **kwargs)
