"""
kombu.transport.pyamqp
======================

pure python amqp transport.

"""
from __future__ import absolute_import

import amqp

from kombu.five import items
from kombu.utils.amq_manager import get_manager
from kombu.utils.text import version_string_as_tuple

from . import base

DEFAULT_PORT = 5672
DEFAULT_SSL_PORT = 5671


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


class Channel(amqp.Channel, base.StdChannel):
    Message = Message

    def prepare_message(self, body, priority=None,
                        content_type=None, content_encoding=None,
                        headers=None, properties=None, _Message=amqp.Message):
        """Prepares message so that it can be sent using this transport."""
        return _Message(
            body,
            priority=priority,
            content_type=content_type,
            content_encoding=content_encoding,
            application_headers=headers,
            **properties or {}
        )

    def message_to_python(self, raw_message):
        """Convert encoded message body back to a Python value."""
        return self.Message(self, raw_message)


class Connection(amqp.Connection):
    Channel = Channel


class Transport(base.Transport):
    Connection = Connection

    default_port = DEFAULT_PORT
    default_ssl_port = DEFAULT_SSL_PORT

    # it's very annoying that pyamqp sometimes raises AttributeError
    # if the connection is lost, but nothing we can do about that here.
    connection_errors = amqp.Connection.connection_errors
    channel_errors = amqp.Connection.channel_errors
    recoverable_connection_errors = \
        amqp.Connection.recoverable_connection_errors
    recoverable_channel_errors = amqp.Connection.recoverable_channel_errors

    driver_name = 'py-amqp'
    driver_type = 'amqp'
    supports_heartbeats = True
    supports_ev = True

    def __init__(self, client,
                 default_port=None, default_ssl_port=None, **kwargs):
        self.client = client
        self.default_port = default_port or self.default_port
        self.default_ssl_port = default_ssl_port or self.default_ssl_port

    def driver_version(self):
        return amqp.__version__

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
        opts = dict({
            'host': conninfo.host,
            'userid': conninfo.userid,
            'password': conninfo.password,
            'login_method': conninfo.login_method,
            'virtual_host': conninfo.virtual_host,
            'insist': conninfo.insist,
            'ssl': conninfo.ssl,
            'connect_timeout': conninfo.connect_timeout,
            'heartbeat': conninfo.heartbeat,
        }, **conninfo.transport_options or {})
        conn = self.Connection(**opts)
        conn.client = self.client
        return conn

    def verify_connection(self, connection):
        return connection.connected

    def close_connection(self, connection):
        """Close the AMQP broker connection."""
        connection.client = None
        connection.close()

    def get_heartbeat_interval(self, connection):
        return connection.heartbeat

    def register_with_event_loop(self, connection, loop):
        loop.add_reader(connection.sock, self.on_readable, connection, loop)

    def heartbeat_check(self, connection, rate=2):
        return connection.heartbeat_tick(rate=rate)

    def qos_semantics_matches_spec(self, connection):
        props = connection.server_properties
        if props.get('product') == 'RabbitMQ':
            return version_string_as_tuple(props['version']) < (3, 3)
        return True

    @property
    def default_connection_params(self):
        return {
            'userid': 'guest',
            'password': 'guest',
            'port': (self.default_ssl_port if self.client.ssl
                     else self.default_port),
            'hostname': 'localhost',
            'login_method': 'AMQPLAIN',
        }

    def get_manager(self, *args, **kwargs):
        return get_manager(self.client, *args, **kwargs)
