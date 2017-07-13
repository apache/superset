"""
kombu.connection
================

Broker connection and pools.

"""
from __future__ import absolute_import

import os
import socket

from contextlib import contextmanager
from itertools import count, cycle
from operator import itemgetter

# jython breaks on relative import for .exceptions for some reason
# (Issue #112)
from kombu import exceptions
from .five import Empty, range, string_t, text_t, LifoQueue as _LifoQueue
from .log import get_logger
from .transport import get_transport_cls, supports_librabbitmq
from .utils import cached_property, retry_over_time, shufflecycle, HashedSeq
from .utils.compat import OrderedDict
from .utils.functional import lazy
from .utils.url import as_url, parse_url, quote, urlparse

__all__ = ['Connection', 'ConnectionPool', 'ChannelPool']

RESOLVE_ALIASES = {'pyamqp': 'amqp',
                   'librabbitmq': 'amqp'}

_LOG_CONNECTION = os.environ.get('KOMBU_LOG_CONNECTION', False)
_LOG_CHANNEL = os.environ.get('KOMBU_LOG_CHANNEL', False)

logger = get_logger(__name__)
roundrobin_failover = cycle

failover_strategies = {
    'round-robin': roundrobin_failover,
    'shuffle': shufflecycle,
}


class Connection(object):
    """A connection to the broker.

    :param URL:  Broker URL, or a list of URLs, e.g.

    .. code-block:: python

        Connection('amqp://guest:guest@localhost:5672//')
        Connection('amqp://foo;amqp://bar', failover_strategy='round-robin')
        Connection('redis://', transport_options={
            'visibility_timeout': 3000,
        })

        import ssl
        Connection('amqp://', login_method='EXTERNAL', ssl={
            'ca_certs': '/etc/pki/tls/certs/something.crt',
            'keyfile': '/etc/something/system.key',
            'certfile': '/etc/something/system.cert',
            'cert_reqs': ssl.CERT_REQUIRED,
        })

    .. admonition:: SSL compatibility

        SSL currently only works with the py-amqp, amqplib, and qpid
        transports.  For other transports you can use stunnel.

    :keyword ssl: Use SSL to connect to the server. Default is ``False``.
      May not be supported by the specified transport.
    :keyword transport: Default transport if not specified in the URL.
    :keyword connect_timeout: Timeout in seconds for connecting to the
      server. May not be supported by the specified transport.
    :keyword transport_options: A dict of additional connection arguments to
      pass to alternate kombu channel implementations.  Consult the transport
      documentation for available options.
    :keyword heartbeat: Heartbeat interval in int/float seconds.
        Note that if heartbeats are enabled then the :meth:`heartbeat_check`
        method must be called regularly, around once per second.

    .. note::

        The connection is established lazily when needed. If you need the
        connection to be established, then force it by calling
        :meth:`connect`::

            >>> conn = Connection('amqp://')
            >>> conn.connect()

        and always remember to close the connection::

            >>> conn.release()

    *Legacy options*

    These options have been replaced by the URL argument, but are still
    supported for backwards compatibility:

    :keyword hostname: Host name/address.
        NOTE: You cannot specify both the URL argument and use the hostname
        keyword argument at the same time.
    :keyword userid: Default user name if not provided in the URL.
    :keyword password: Default password if not provided in the URL.
    :keyword virtual_host: Default virtual host if not provided in the URL.
    :keyword port: Default port if not provided in the URL.

    """
    port = None
    virtual_host = '/'
    connect_timeout = 5

    _closed = None
    _connection = None
    _default_channel = None
    _transport = None
    _logger = False
    uri_prefix = None

    #: The cache of declared entities is per connection,
    #: in case the server loses data.
    declared_entities = None

    #: Iterator returning the next broker URL to try in the event
    #: of connection failure (initialized by :attr:`failover_strategy`).
    cycle = None

    #: Additional transport specific options,
    #: passed on to the transport instance.
    transport_options = None

    #: Strategy used to select new hosts when reconnecting after connection
    #: failure.  One of "round-robin", "shuffle" or any custom iterator
    #: constantly yielding new URLs to try.
    failover_strategy = 'round-robin'

    #: Map of failover strategy name to Callable
    failover_strategies = failover_strategies

    #: Heartbeat value, currently only supported by the py-amqp transport.
    heartbeat = None


    hostname = userid = password = ssl = login_method = None

    def __init__(self, hostname='localhost', userid=None,
                 password=None, virtual_host=None, port=None, insist=False,
                 ssl=False, transport=None, connect_timeout=5,
                 transport_options=None, login_method=None, uri_prefix=None,
                 heartbeat=0, failover_strategy='round-robin',
                 alternates=None, **kwargs):
        alt = [] if alternates is None else alternates
        # have to spell the args out, just to get nice docstrings :(
        params = self._initial_params = {
            'hostname': hostname, 'userid': userid,
            'password': password, 'virtual_host': virtual_host,
            'port': port, 'insist': insist, 'ssl': ssl,
            'transport': transport, 'connect_timeout': connect_timeout,
            'login_method': login_method, 'heartbeat': heartbeat
        }

        if hostname and not isinstance(hostname, string_t):
            alt.extend(hostname)
            hostname = alt[0]
        if hostname and '://' in hostname:
            if ';' in hostname:
                alt.extend(hostname.split(';'))
                hostname = alt[0]
            if '+' in hostname[:hostname.index('://')]:
                # e.g. sqla+mysql://root:masterkey@localhost/
                params['transport'], params['hostname'] = \
                    hostname.split('+', 1)
                transport = self.uri_prefix = params['transport']
            else:
                transport = transport or urlparse(hostname).scheme
                if not get_transport_cls(transport).can_parse_url:
                    # we must parse the URL
                    params.update(parse_url(hostname))

                params['transport'] = transport

        self._init_params(**params)

        # fallback hosts
        self.alt = alt
        self._failover_strategy_arg = failover_strategy or 'round-robin'
        self.failover_strategy = self.failover_strategies.get(
            self._failover_strategy_arg) or failover_strategy
        if self.alt:
            self.cycle = self.failover_strategy(self.alt)
            next(self.cycle)  # skip first entry

        if transport_options is None:
            transport_options = {}
        self.transport_options = transport_options

        if _LOG_CONNECTION:  # pragma: no cover
            self._logger = True

        if uri_prefix:
            self.uri_prefix = uri_prefix

        self.declared_entities = set()

    def switch(self, url):
        """Switch connection parameters to use a new URL (does not
        reconnect)"""
        self.close()
        self.declared_entities.clear()
        self._closed = False
        self._init_params(**dict(self._initial_params, **parse_url(url)))

    def maybe_switch_next(self):
        """Switch to next URL given by the current failover strategy (if
        any)."""
        if self.cycle:
            self.switch(next(self.cycle))

    def _init_params(self, hostname, userid, password, virtual_host, port,
                     insist, ssl, transport, connect_timeout,
                     login_method, heartbeat):
        transport = transport or 'amqp'
        if transport == 'amqp' and supports_librabbitmq():
            transport = 'librabbitmq'
        self.hostname = hostname
        self.userid = userid
        self.password = password
        self.login_method = login_method
        self.virtual_host = virtual_host or self.virtual_host
        self.port = port or self.port
        self.insist = insist
        self.connect_timeout = connect_timeout
        self.ssl = ssl
        self.transport_cls = transport
        self.heartbeat = heartbeat and float(heartbeat)

    def register_with_event_loop(self, loop):
        self.transport.register_with_event_loop(self.connection, loop)

    def _debug(self, msg, *args, **kwargs):
        if self._logger:  # pragma: no cover
            fmt = '[Kombu connection:0x{id:x}] {msg}'
            logger.debug(fmt.format(id=id(self), msg=text_t(msg)),
                         *args, **kwargs)

    def connect(self):
        """Establish connection to server immediately."""
        self._closed = False
        return self.connection

    def channel(self):
        """Create and return a new channel."""
        self._debug('create channel')
        chan = self.transport.create_channel(self.connection)
        if _LOG_CHANNEL:  # pragma: no cover
            from .utils.debug import Logwrapped
            return Logwrapped(chan, 'kombu.channel',
                              '[Kombu channel:{0.channel_id}] ')
        return chan

    def heartbeat_check(self, rate=2):
        """Allow the transport to perform any periodic tasks
        required to make heartbeats work.  This should be called
        approximately every second.

        If the current transport does not support heartbeats then
        this is a noop operation.

        :keyword rate: Rate is how often the tick is called
            compared to the actual heartbeat value.  E.g. if
            the heartbeat is set to 3 seconds, and the tick
            is called every 3 / 2 seconds, then the rate is 2.
            This value is currently unused by any transports.

        """
        return self.transport.heartbeat_check(self.connection, rate=rate)

    def drain_events(self, **kwargs):
        """Wait for a single event from the server.

        :keyword timeout: Timeout in seconds before we give up.


        :raises :exc:`socket.timeout`: if the timeout is exceeded.

        """
        return self.transport.drain_events(self.connection, **kwargs)

    def maybe_close_channel(self, channel):
        """Close given channel, but ignore connection and channel errors."""
        try:
            channel.close()
        except (self.connection_errors + self.channel_errors):
            pass

    def _do_close_self(self):
        # Close only connection and channel(s), but not transport.
        self.declared_entities.clear()
        if self._default_channel:
            self.maybe_close_channel(self._default_channel)
        if self._connection:
            try:
                self.transport.close_connection(self._connection)
            except self.connection_errors + (AttributeError, socket.error):
                pass
            self._connection = None

    def _close(self):
        """Really close connection, even if part of a connection pool."""
        self._do_close_self()
        if self._transport:
            self._transport.client = None
            self._transport = None
        self._debug('closed')
        self._closed = True

    def collect(self, socket_timeout=None):
        # amqp requires communication to close, we don't need that just
        # to clear out references, Transport._collect can also be implemented
        # by other transports that want fast after fork
        try:
            gc_transport = self._transport._collect
        except AttributeError:
            _timeo = socket.getdefaulttimeout()
            socket.setdefaulttimeout(socket_timeout)
            try:
                self._close()
            except socket.timeout:
                pass
            finally:
                socket.setdefaulttimeout(_timeo)
        else:
            gc_transport(self._connection)
            if self._transport:
                self._transport.client = None
                self._transport = None
            self.declared_entities.clear()
            self._connection = None

    def release(self):
        """Close the connection (if open)."""
        self._close()
    close = release

    def ensure_connection(self, errback=None, max_retries=None,
                          interval_start=2, interval_step=2, interval_max=30,
                          callback=None):
        """Ensure we have a connection to the server.

        If not retry establishing the connection with the settings
        specified.

        :keyword errback: Optional callback called each time the connection
          can't be established. Arguments provided are the exception
          raised and the interval that will be slept ``(exc, interval)``.

        :keyword max_retries: Maximum number of times to retry.
          If this limit is exceeded the connection error will be re-raised.

        :keyword interval_start: The number of seconds we start sleeping for.
        :keyword interval_step: How many seconds added to the interval
          for each retry.
        :keyword interval_max: Maximum number of seconds to sleep between
          each retry.
        :keyword callback: Optional callback that is called for every
           internal iteration (1 s)

        """
        def on_error(exc, intervals, retries, interval=0):
            round = self.completes_cycle(retries)
            if round:
                interval = next(intervals)
            if errback:
                errback(exc, interval)
            self.maybe_switch_next()  # select next host

            return interval if round else 0

        retry_over_time(self.connect, self.recoverable_connection_errors,
                        (), {}, on_error, max_retries,
                        interval_start, interval_step, interval_max, callback)
        return self

    def completes_cycle(self, retries):
        """Return true if the cycle is complete after number of `retries`."""
        return not (retries + 1) % len(self.alt) if self.alt else True

    def revive(self, new_channel):
        """Revive connection after connection re-established."""
        if self._default_channel:
            self.maybe_close_channel(self._default_channel)
            self._default_channel = None

    def _default_ensure_callback(self, exc, interval):
        logger.error("Ensure: Operation error: %r. Retry in %ss",
                     exc, interval, exc_info=True)

    def ensure(self, obj, fun, errback=None, max_retries=None,
               interval_start=1, interval_step=1, interval_max=1,
               on_revive=None):
        """Ensure operation completes, regardless of any channel/connection
        errors occurring.

        Will retry by establishing the connection, and reapplying
        the function.

        :param fun: Method to apply.

        :keyword errback: Optional callback called each time the connection
          can't be established. Arguments provided are the exception
          raised and the interval that will be slept ``(exc, interval)``.

        :keyword max_retries: Maximum number of times to retry.
          If this limit is exceeded the connection error will be re-raised.

        :keyword interval_start: The number of seconds we start sleeping for.
        :keyword interval_step: How many seconds added to the interval
          for each retry.
        :keyword interval_max: Maximum number of seconds to sleep between
          each retry.

        **Example**

        This is an example ensuring a publish operation::

            >>> from kombu import Connection, Producer
            >>> conn = Connection('amqp://')
            >>> producer = Producer(conn)

            >>> def errback(exc, interval):
            ...     logger.error('Error: %r', exc, exc_info=1)
            ...     logger.info('Retry in %s seconds.', interval)

            >>> publish = conn.ensure(producer, producer.publish,
            ...                       errback=errback, max_retries=3)
            >>> publish({'hello': 'world'}, routing_key='dest')

        """
        def _ensured(*args, **kwargs):
            got_connection = 0
            conn_errors = self.recoverable_connection_errors
            chan_errors = self.recoverable_channel_errors
            has_modern_errors = hasattr(
                self.transport, 'recoverable_connection_errors',
            )
            for retries in count(0):  # for infinity
                try:
                    return fun(*args, **kwargs)
                except conn_errors as exc:
                    if got_connection and not has_modern_errors:
                        # transport can not distinguish between
                        # recoverable/irrecoverable errors, so we propagate
                        # the error if it persists after a new connection was
                        # successfully established.
                        raise
                    if max_retries is not None and retries > max_retries:
                        raise
                    self._debug('ensure connection error: %r', exc, exc_info=1)
                    self._connection = None
                    self._do_close_self()
                    errback and errback(exc, 0)
                    remaining_retries = None
                    if max_retries is not None:
                        remaining_retries = max(max_retries - retries, 1)
                    self.ensure_connection(errback,
                                           remaining_retries,
                                           interval_start,
                                           interval_step,
                                           interval_max)
                    new_channel = self.channel()
                    self.revive(new_channel)
                    obj.revive(new_channel)
                    if on_revive:
                        on_revive(new_channel)
                    got_connection += 1
                except chan_errors as exc:
                    if max_retries is not None and retries > max_retries:
                        raise
                    self._debug('ensure channel error: %r', exc, exc_info=1)
                    errback and errback(exc, 0)
        _ensured.__name__ = "%s(ensured)" % fun.__name__
        _ensured.__doc__ = fun.__doc__
        _ensured.__module__ = fun.__module__
        return _ensured

    def autoretry(self, fun, channel=None, **ensure_options):
        """Decorator for functions supporting a ``channel`` keyword argument.

        The resulting callable will retry calling the function if
        it raises connection or channel related errors.
        The return value will be a tuple of ``(retval, last_created_channel)``.

        If a ``channel`` is not provided, then one will be automatically
        acquired (remember to close it afterwards).

        See :meth:`ensure` for the full list of supported keyword arguments.

        Example usage::

            channel = connection.channel()
            try:
                ret, channel = connection.autoretry(publish_messages, channel)
            finally:
                channel.close()
        """
        channels = [channel]
        create_channel = self.channel

        class Revival(object):
            __name__ = getattr(fun, '__name__', None)
            __module__ = getattr(fun, '__module__', None)
            __doc__ = getattr(fun, '__doc__', None)

            def revive(self, channel):
                channels[0] = channel

            def __call__(self, *args, **kwargs):
                if channels[0] is None:
                    self.revive(create_channel())
                return fun(*args, channel=channels[0], **kwargs), channels[0]

        revive = Revival()
        return self.ensure(revive, revive, **ensure_options)

    def create_transport(self):
        return self.get_transport_cls()(client=self)

    def get_transport_cls(self):
        """Get the currently used transport class."""
        transport_cls = self.transport_cls
        if not transport_cls or isinstance(transport_cls, string_t):
            transport_cls = get_transport_cls(transport_cls)
        return transport_cls

    def clone(self, **kwargs):
        """Create a copy of the connection with the same connection
        settings."""
        return self.__class__(**dict(self._info(resolve=False), **kwargs))

    def get_heartbeat_interval(self):
        return self.transport.get_heartbeat_interval(self.connection)

    def _info(self, resolve=True):
        transport_cls = self.transport_cls
        if resolve:
            transport_cls = RESOLVE_ALIASES.get(transport_cls, transport_cls)
        D = self.transport.default_connection_params

        hostname = self.hostname or D.get('hostname')
        if self.uri_prefix:
            hostname = '%s+%s' % (self.uri_prefix, hostname)

        info = (
            ('hostname', hostname),
            ('userid', self.userid or D.get('userid')),
            ('password', self.password or D.get('password')),
            ('virtual_host', self.virtual_host or D.get('virtual_host')),
            ('port', self.port or D.get('port')),
            ('insist', self.insist),
            ('ssl', self.ssl),
            ('transport', transport_cls),
            ('connect_timeout', self.connect_timeout),
            ('transport_options', self.transport_options),
            ('login_method', self.login_method or D.get('login_method')),
            ('uri_prefix', self.uri_prefix),
            ('heartbeat', self.heartbeat),
            ('failover_strategy', self._failover_strategy_arg),
            ('alternates', self.alt),
        )
        return info

    def info(self):
        """Get connection info."""
        return OrderedDict(self._info())

    def __eqhash__(self):
        return HashedSeq(self.transport_cls, self.hostname, self.userid,
                         self.password, self.virtual_host, self.port,
                         repr(self.transport_options))

    def as_uri(self, include_password=False, mask='**',
               getfields=itemgetter('port', 'userid', 'password',
                                    'virtual_host', 'transport')):
        """Convert connection parameters to URL form."""
        hostname = self.hostname or 'localhost'
        if self.transport.can_parse_url:
            if self.uri_prefix:
                return '%s+%s' % (self.uri_prefix, hostname)
            return self.hostname
        if self.uri_prefix:
            return '%s+%s' % (self.uri_prefix, hostname)
        fields = self.info()
        port, userid, password, vhost, transport = getfields(fields)

        return as_url(
            transport, hostname, port, userid, password, quote(vhost),
            sanitize=not include_password, mask=mask,
        )

    def Pool(self, limit=None, preload=None):
        """Pool of connections.

        See :class:`ConnectionPool`.

        :keyword limit: Maximum number of active connections.
          Default is no limit.
        :keyword preload: Number of connections to preload
          when the pool is created.  Default is 0.

        *Example usage*::

            >>> connection = Connection('amqp://')
            >>> pool = connection.Pool(2)
            >>> c1 = pool.acquire()
            >>> c2 = pool.acquire()
            >>> c3 = pool.acquire()
            Traceback (most recent call last):
              File "<stdin>", line 1, in <module>
              File "kombu/connection.py", line 354, in acquire
              raise ConnectionLimitExceeded(self.limit)
                kombu.exceptions.ConnectionLimitExceeded: 2
            >>> c1.release()
            >>> c3 = pool.acquire()

        """
        return ConnectionPool(self, limit, preload)

    def ChannelPool(self, limit=None, preload=None):
        """Pool of channels.

        See :class:`ChannelPool`.

        :keyword limit: Maximum number of active channels.
          Default is no limit.
        :keyword preload: Number of channels to preload
          when the pool is created.  Default is 0.

        *Example usage*::

            >>> connection = Connection('amqp://')
            >>> pool = connection.ChannelPool(2)
            >>> c1 = pool.acquire()
            >>> c2 = pool.acquire()
            >>> c3 = pool.acquire()
            Traceback (most recent call last):
              File "<stdin>", line 1, in <module>
              File "kombu/connection.py", line 354, in acquire
              raise ChannelLimitExceeded(self.limit)
                kombu.connection.ChannelLimitExceeded: 2
            >>> c1.release()
            >>> c3 = pool.acquire()

        """
        return ChannelPool(self, limit, preload)

    def Producer(self, channel=None, *args, **kwargs):
        """Create new :class:`kombu.Producer` instance using this
        connection."""
        from .messaging import Producer
        return Producer(channel or self, *args, **kwargs)

    def Consumer(self, queues=None, channel=None, *args, **kwargs):
        """Create new :class:`kombu.Consumer` instance using this
        connection."""
        from .messaging import Consumer
        return Consumer(channel or self, queues, *args, **kwargs)

    def SimpleQueue(self, name, no_ack=None, queue_opts=None,
                    exchange_opts=None, channel=None, **kwargs):
        """Create new :class:`~kombu.simple.SimpleQueue`, using a channel
        from this connection.

        If ``name`` is a string, a queue and exchange will be automatically
        created using that name as the name of the queue and exchange,
        also it will be used as the default routing key.

        :param name: Name of the queue/or a :class:`~kombu.Queue`.
        :keyword no_ack: Disable acknowledgements. Default is false.
        :keyword queue_opts: Additional keyword arguments passed to the
          constructor of the automatically created
          :class:`~kombu.Queue`.
        :keyword exchange_opts: Additional keyword arguments passed to the
          constructor of the automatically created
          :class:`~kombu.Exchange`.
        :keyword channel: Custom channel to use. If not specified the
            connection default channel is used.

        """
        from .simple import SimpleQueue
        return SimpleQueue(channel or self, name, no_ack, queue_opts,
                           exchange_opts, **kwargs)

    def SimpleBuffer(self, name, no_ack=None, queue_opts=None,
                     exchange_opts=None, channel=None, **kwargs):
        """Create new :class:`~kombu.simple.SimpleQueue` using a channel
        from this connection.

        Same as :meth:`SimpleQueue`, but configured with buffering
        semantics. The resulting queue and exchange will not be durable, also
        auto delete is enabled. Messages will be transient (not persistent),
        and acknowledgements are disabled (``no_ack``).

        """
        from .simple import SimpleBuffer
        return SimpleBuffer(channel or self, name, no_ack, queue_opts,
                            exchange_opts, **kwargs)

    def _establish_connection(self):
        self._debug('establishing connection...')
        conn = self.transport.establish_connection()
        self._debug('connection established: %r', conn)
        return conn

    def __repr__(self):
        """``x.__repr__() <==> repr(x)``"""
        return '<Connection: {0} at 0x{1:x}>'.format(self.as_uri(), id(self))

    def __copy__(self):
        """``x.__copy__() <==> copy(x)``"""
        return self.clone()

    def __reduce__(self):
        return self.__class__, tuple(self.info().values()), None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.release()

    @property
    def qos_semantics_matches_spec(self):
        return self.transport.qos_semantics_matches_spec(self.connection)

    @property
    def connected(self):
        """Return true if the connection has been established."""
        return (not self._closed and
                self._connection is not None and
                self.transport.verify_connection(self._connection))

    @property
    def connection(self):
        """The underlying connection object.

        .. warning::
            This instance is transport specific, so do not
            depend on the interface of this object.

        """
        if not self._closed:
            if not self.connected:
                self.declared_entities.clear()
                self._default_channel = None
                self._connection = self._establish_connection()
                self._closed = False
            return self._connection

    @property
    def default_channel(self):
        """Default channel, created upon access and closed when the connection
        is closed.

        Can be used for automatic channel handling when you only need one
        channel, and also it is the channel implicitly used if a connection
        is passed instead of a channel, to functions that require a channel.

        """
        # make sure we're still connected, and if not refresh.
        self.connection
        if self._default_channel is None:
            self._default_channel = self.channel()
        return self._default_channel

    @property
    def host(self):
        """The host as a host name/port pair separated by colon."""
        return ':'.join([self.hostname, str(self.port)])

    @property
    def transport(self):
        if self._transport is None:
            self._transport = self.create_transport()
        return self._transport

    @cached_property
    def manager(self):
        """Experimental manager that can be used to manage/monitor the broker
        instance.  Not available for all transports."""
        return self.transport.manager

    def get_manager(self, *args, **kwargs):
        return self.transport.get_manager(*args, **kwargs)

    @cached_property
    def recoverable_connection_errors(self):
        """List of connection related exceptions that can be recovered from,
        but where the connection must be closed and re-established first."""
        try:
            return self.transport.recoverable_connection_errors
        except AttributeError:
            # There were no such classification before,
            # and all errors were assumed to be recoverable,
            # so this is a fallback for transports that do
            # not support the new recoverable/irrecoverable classes.
            return self.connection_errors + self.channel_errors

    @cached_property
    def recoverable_channel_errors(self):
        """List of channel related exceptions that can be automatically
        recovered from without re-establishing the connection."""
        try:
            return self.transport.recoverable_channel_errors
        except AttributeError:
            return ()

    @cached_property
    def connection_errors(self):
        """List of exceptions that may be raised by the connection."""
        return self.transport.connection_errors

    @cached_property
    def channel_errors(self):
        """List of exceptions that may be raised by the channel."""
        return self.transport.channel_errors

    @property
    def supports_heartbeats(self):
        return self.transport.supports_heartbeats

    @property
    def is_evented(self):
        return self.transport.supports_ev
BrokerConnection = Connection


class Resource(object):
    LimitExceeded = exceptions.LimitExceeded

    def __init__(self, limit=None, preload=None):
        self.limit = limit
        self.preload = preload or 0
        self._closed = False

        self._resource = _LifoQueue()
        self._dirty = set()
        self.setup()

    def setup(self):
        raise NotImplementedError('subclass responsibility')

    def _add_when_empty(self):
        if self.limit and len(self._dirty) >= self.limit:
            raise self.LimitExceeded(self.limit)
        # All taken, put new on the queue and
        # try get again, this way the first in line
        # will get the resource.
        self._resource.put_nowait(self.new())

    def acquire(self, block=False, timeout=None):
        """Acquire resource.

        :keyword block: If the limit is exceeded,
          block until there is an available item.
        :keyword timeout: Timeout to wait
          if ``block`` is true. Default is :const:`None` (forever).

        :raises LimitExceeded: if block is false
          and the limit has been exceeded.

        """
        if self._closed:
            raise RuntimeError('Acquire on closed pool')
        if self.limit:
            while 1:
                try:
                    R = self._resource.get(block=block, timeout=timeout)
                except Empty:
                    self._add_when_empty()
                else:
                    try:
                        R = self.prepare(R)
                    except BaseException:
                        if isinstance(R, lazy):
                            # no evaluated yet, just put it back
                            self._resource.put_nowait(R)
                        else:
                            # evaluted so must try to release/close first.
                            self.release(R)
                        raise
                    self._dirty.add(R)
                    break
        else:
            R = self.prepare(self.new())

        def release():
            """Release resource so it can be used by another thread.

            The caller is responsible for discarding the object,
            and to never use the resource again.  A new resource must
            be acquired if so needed.

            """
            self.release(R)
        R.release = release

        return R

    def prepare(self, resource):
        return resource

    def close_resource(self, resource):
        resource.close()

    def release_resource(self, resource):
        pass

    def replace(self, resource):
        """Replace resource with a new instance.  This can be used in case
        of defective resources."""
        if self.limit:
            self._dirty.discard(resource)
        self.close_resource(resource)

    def release(self, resource):
        if self.limit:
            self._dirty.discard(resource)
            self._resource.put_nowait(resource)
            self.release_resource(resource)
        else:
            self.close_resource(resource)

    def collect_resource(self, resource):
        pass

    def force_close_all(self):
        """Close and remove all resources in the pool (also those in use).

        Can be used to close resources from parent processes
        after fork (e.g. sockets/connections).

        """
        self._closed = True
        dirty = self._dirty
        resource = self._resource
        while 1:  # - acquired
            try:
                dres = dirty.pop()
            except KeyError:
                break
            try:
                self.collect_resource(dres)
            except AttributeError:  # Issue #78
                pass
        while 1:  # - available
            # deque supports '.clear', but lists do not, so for that
            # reason we use pop here, so that the underlying object can
            # be any object supporting '.pop' and '.append'.
            try:
                res = resource.queue.pop()
            except IndexError:
                break
            try:
                self.collect_resource(res)
            except AttributeError:
                pass  # Issue #78

    if os.environ.get('KOMBU_DEBUG_POOL'):  # pragma: no cover
        _orig_acquire = acquire
        _orig_release = release

        _next_resource_id = 0

        def acquire(self, *args, **kwargs):  # noqa
            import traceback
            id = self._next_resource_id = self._next_resource_id + 1
            print('+{0} ACQUIRE {1}'.format(id, self.__class__.__name__))
            r = self._orig_acquire(*args, **kwargs)
            r._resource_id = id
            print('-{0} ACQUIRE {1}'.format(id, self.__class__.__name__))
            if not hasattr(r, 'acquired_by'):
                r.acquired_by = []
            r.acquired_by.append(traceback.format_stack())
            return r

        def release(self, resource):  # noqa
            id = resource._resource_id
            print('+{0} RELEASE {1}'.format(id, self.__class__.__name__))
            r = self._orig_release(resource)
            print('-{0} RELEASE {1}'.format(id, self.__class__.__name__))
            self._next_resource_id -= 1
            return r


class ConnectionPool(Resource):
    LimitExceeded = exceptions.ConnectionLimitExceeded

    def __init__(self, connection, limit=None, preload=None):
        self.connection = connection
        super(ConnectionPool, self).__init__(limit=limit,
                                             preload=preload)

    def new(self):
        return self.connection.clone()

    def release_resource(self, resource):
        try:
            resource._debug('released')
        except AttributeError:
            pass

    def close_resource(self, resource):
        resource._close()

    def collect_resource(self, resource, socket_timeout=0.1):
        return resource.collect(socket_timeout)

    @contextmanager
    def acquire_channel(self, block=False):
        with self.acquire(block=block) as connection:
            yield connection, connection.default_channel

    def setup(self):
        if self.limit:
            for i in range(self.limit):
                if i < self.preload:
                    conn = self.new()
                    conn.connect()
                else:
                    conn = lazy(self.new)
                self._resource.put_nowait(conn)

    def prepare(self, resource):
        if callable(resource):
            resource = resource()
        resource._debug('acquired')
        return resource


class ChannelPool(Resource):
    LimitExceeded = exceptions.ChannelLimitExceeded

    def __init__(self, connection, limit=None, preload=None):
        self.connection = connection
        super(ChannelPool, self).__init__(limit=limit,
                                          preload=preload)

    def new(self):
        return lazy(self.connection.channel)

    def setup(self):
        channel = self.new()
        if self.limit:
            for i in range(self.limit):
                self._resource.put_nowait(
                    i < self.preload and channel() or lazy(channel))

    def prepare(self, channel):
        if callable(channel):
            channel = channel()
        return channel


def maybe_channel(channel):
    """Return the default channel if argument is a connection instance,
    otherwise just return the channel given."""
    if isinstance(channel, Connection):
        return channel.default_channel
    return channel


def is_connection(obj):
    return isinstance(obj, Connection)
