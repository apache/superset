from __future__ import with_statement
import random
import re
import socket

import mock
from nose.tools import eq_

from statsd import StatsClient
from statsd import TCPStatsClient


ADDR = (socket.gethostbyname('localhost'), 8125)


# proto specific methods to get the socket method to send data
send_method = {
    'udp': lambda x: x.sendto,
    'tcp': lambda x: x.sendall,
}


# proto specific methods to create the expected value
make_val = {
    'udp': lambda x, addr: mock.call(str.encode(x), addr),
    'tcp': lambda x, addr: mock.call(str.encode(x + '\n')),
}


def _udp_client(prefix=None, addr=None, port=None, ipv6=False):
    if not addr:
        addr = ADDR[0]
    if not port:
        port = ADDR[1]
    sc = StatsClient(host=addr, port=port, prefix=prefix, ipv6=ipv6)
    sc._sock = mock.Mock()
    return sc


def _tcp_client(prefix=None, addr=None, port=None, timeout=None, ipv6=False):
    if not addr:
        addr = ADDR[0]
    if not port:
        port = ADDR[1]
    sc = TCPStatsClient(host=addr, port=port, prefix=prefix, timeout=timeout,
                        ipv6=ipv6)
    sc._sock = mock.Mock()
    return sc


def _timer_check(sock, count, proto, start, end):
    send = send_method[proto](sock)
    eq_(send.call_count, count)
    value = send.call_args[0][0].decode('ascii')
    exp = re.compile('^%s:\d+|%s$' % (start, end))
    assert exp.match(value)


def _sock_check(sock, count, proto, val=None, addr=None):
    send = send_method[proto](sock)
    eq_(send.call_count, count)
    if not addr:
        addr = ADDR
    if val is not None:
        eq_(
            send.call_args,
            make_val[proto](val, addr),
        )


class assert_raises(object):
    """A context manager that asserts a given exception was raised.

    >>> with assert_raises(TypeError):
    ...     raise TypeError

    >>> with assert_raises(TypeError):
    ...     raise ValueError
    AssertionError: ValueError not in ['TypeError']

    >>> with assert_raises(TypeError):
    ...     pass
    AssertionError: No exception raised.

    Or you can specify any of a number of exceptions:

    >>> with assert_raises(TypeError, ValueError):
    ...     raise ValueError

    >>> with assert_raises(TypeError, ValueError):
    ...     raise KeyError
    AssertionError: KeyError not in ['TypeError', 'ValueError']

    You can also get the exception back later:

    >>> with assert_raises(TypeError) as cm:
    ...     raise TypeError('bad type!')
    >>> cm.exception
    TypeError('bad type!')
    >>> cm.exc_type
    TypeError
    >>> cm.traceback
    <traceback @ 0x3323ef0>

    Lowercase name because that it's a class is an implementation detail.

    """

    def __init__(self, *exc_cls):
        self.exc_cls = exc_cls

    def __enter__(self):
        # For access to the exception later.
        return self

    def __exit__(self, typ, value, tb):
        assert typ, 'No exception raised.'
        assert typ in self.exc_cls, '%s not in %s' % (
            typ.__name__, [e.__name__ for e in self.exc_cls])
        self.exc_type = typ
        self.exception = value
        self.traceback = tb

        # Swallow expected exceptions.
        return True


def _test_incr(cl, proto):
    cl.incr('foo')
    _sock_check(cl._sock, 1, proto, val='foo:1|c')

    cl.incr('foo', 10)
    _sock_check(cl._sock, 2, proto, val='foo:10|c')

    cl.incr('foo', 1.2)
    _sock_check(cl._sock, 3, proto, val='foo:1.2|c')

    cl.incr('foo', 10, rate=0.5)
    _sock_check(cl._sock, 4, proto, val='foo:10|c|@0.5')


@mock.patch.object(random, 'random', lambda: -1)
def test_incr_udp():
    """StatsClient.incr works."""
    cl = _udp_client()
    _test_incr(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_incr_tcp():
    """TCPStatsClient.incr works."""
    cl = _tcp_client()
    _test_incr(cl, 'tcp')


def _test_decr(cl, proto):
    cl.decr('foo')
    _sock_check(cl._sock, 1, proto, 'foo:-1|c')

    cl.decr('foo', 10)
    _sock_check(cl._sock, 2, proto, 'foo:-10|c')

    cl.decr('foo', 1.2)
    _sock_check(cl._sock, 3, proto, 'foo:-1.2|c')

    cl.decr('foo', 1, rate=0.5)
    _sock_check(cl._sock, 4, proto, 'foo:-1|c|@0.5')


@mock.patch.object(random, 'random', lambda: -1)
def test_decr_udp():
    """StatsClient.decr works."""
    cl = _udp_client()
    _test_decr(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_decr_tcp():
    """TCPStatsClient.decr works."""
    cl = _tcp_client()
    _test_decr(cl, 'tcp')


def _test_gauge(cl, proto):
    cl.gauge('foo', 30)
    _sock_check(cl._sock, 1, proto, 'foo:30|g')

    cl.gauge('foo', 1.2)
    _sock_check(cl._sock, 2, proto, 'foo:1.2|g')

    cl.gauge('foo', 70, rate=0.5)
    _sock_check(cl._sock, 3, proto, 'foo:70|g|@0.5')


@mock.patch.object(random, 'random', lambda: -1)
def test_gauge_udp():
    """StatsClient.gauge works."""
    cl = _udp_client()
    _test_gauge(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_gauge_tcp():
    """TCPStatsClient.gauge works."""
    cl = _tcp_client()
    _test_gauge(cl, 'tcp')


def _test_ipv6(cl, proto, addr):
    cl.gauge('foo', 30)
    _sock_check(cl._sock, 1, proto, 'foo:30|g', addr=addr)


def test_ipv6_udp():
    """StatsClient can use to IPv6 address."""
    addr = ('::1', 8125, 0, 0)
    cl = _udp_client(addr=addr[0], ipv6=True)
    _test_ipv6(cl, 'udp', addr)


def test_ipv6_tcp():
    """TCPStatsClient can use to IPv6 address."""
    addr = ('::1', 8125, 0, 0)
    cl = _tcp_client(addr=addr[0], ipv6=True)
    _test_ipv6(cl, 'tcp', addr)


def _test_resolution(cl, proto, addr):
    cl.incr('foo')
    _sock_check(cl._sock, 1, proto, 'foo:1|c', addr=addr)


def test_ipv6_resolution_udp():
    cl = _udp_client(addr='localhost', ipv6=True)
    _test_resolution(cl, 'udp', ('::1', 8125, 0, 0))


def test_ipv6_resolution_tcp():
    cl = _tcp_client(addr='localhost', ipv6=True)
    _test_resolution(cl, 'tcp', ('::1', 8125, 0, 0))


def test_ipv4_resolution_udp():
    cl = _udp_client(addr='localhost')
    _test_resolution(cl, 'udp', ('127.0.0.1', 8125))


def test_ipv4_resolution_tcp():
    cl = _tcp_client(addr='localhost')
    _test_resolution(cl, 'tcp', ('127.0.0.1', 8125))


def _test_gauge_delta(cl, proto):
    tests = (
        (12, '+12'),
        (-13, '-13'),
        (1.2, '+1.2'),
        (-1.3, '-1.3'),
    )

    def _check(num, result):
        cl._sock.reset_mock()
        cl.gauge('foo', num, delta=True)
        _sock_check(cl._sock, 1, proto, 'foo:%s|g' % result)

    for num, result in tests:
        _check(num, result)


@mock.patch.object(random, 'random', lambda: -1)
def test_gauge_delta_udp():
    """StatsClient.gauge works with delta values."""
    cl = _udp_client()
    _test_gauge_delta(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_gauge_delta_tcp():
    """TCPStatsClient.gauge works with delta values."""
    cl = _tcp_client()
    _test_gauge_delta(cl, 'tcp')


def _test_gauge_absolute_negative(cl, proto):
    cl.gauge('foo', -5, delta=False)
    _sock_check(cl._sock, 1, 'foo:0|g\nfoo:-5|g')


@mock.patch.object(random, 'random', lambda: -1)
def test_gauge_absolute_negative_udp():
    """StatsClient.gauge works with absolute negative value."""
    cl = _udp_client()
    _test_gauge_delta(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_gauge_absolute_negative_tcp():
    """TCPStatsClient.gauge works with absolute negative value."""
    cl = _tcp_client()
    _test_gauge_delta(cl, 'tcp')


def _test_gauge_absolute_negative_rate(cl, proto, mock_random):
    mock_random.return_value = -1
    cl.gauge('foo', -1, rate=0.5, delta=False)
    _sock_check(cl._sock, 1, proto, 'foo:0|g\nfoo:-1|g')

    mock_random.return_value = 2
    cl.gauge('foo', -2, rate=0.5, delta=False)
    # Should not have changed.
    _sock_check(cl._sock, 1, proto, 'foo:0|g\nfoo:-1|g')


@mock.patch.object(random, 'random')
def test_gauge_absolute_negative_rate_udp(mock_random):
    """StatsClient.gauge works with absolute negative value and rate."""
    cl = _udp_client()
    _test_gauge_absolute_negative_rate(cl, 'udp', mock_random)


@mock.patch.object(random, 'random')
def test_gauge_absolute_negative_rate_tcp(mock_random):
    """TCPStatsClient.gauge works with absolute negative value and rate."""
    cl = _tcp_client()
    _test_gauge_absolute_negative_rate(cl, 'tcp', mock_random)


def _test_set(cl, proto):
    cl.set('foo', 10)
    _sock_check(cl._sock, 1, proto, 'foo:10|s')

    cl.set('foo', 2.3)
    _sock_check(cl._sock, 2, proto, 'foo:2.3|s')

    cl.set('foo', 'bar')
    _sock_check(cl._sock, 3, proto, 'foo:bar|s')

    cl.set('foo', 2.3, 0.5)
    _sock_check(cl._sock, 4, proto, 'foo:2.3|s|@0.5')


@mock.patch.object(random, 'random', lambda: -1)
def test_set_udp():
    """StatsClient.set works."""
    cl = _udp_client()
    _test_set(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_set_tcp():
    """TCPStatsClient.set works."""
    cl = _tcp_client()
    _test_set(cl, 'tcp')


def _test_timing(cl, proto):
    cl.timing('foo', 100)
    _sock_check(cl._sock, 1, proto, 'foo:100.000000|ms')

    cl.timing('foo', 350)
    _sock_check(cl._sock, 2, proto, 'foo:350.000000|ms')

    cl.timing('foo', 100, rate=0.5)
    _sock_check(cl._sock, 3, proto, 'foo:100.000000|ms|@0.5')


@mock.patch.object(random, 'random', lambda: -1)
def test_timing_udp():
    """StatsClient.timing works."""
    cl = _udp_client()
    _test_timing(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_timing_tcp():
    """TCPStatsClient.timing works."""
    cl = _tcp_client()
    _test_timing(cl, 'tcp')


def _test_prepare(cl, proto):
    tests = (
        ('foo:1|c', ('foo', '1|c', 1)),
        ('bar:50|ms|@0.5', ('bar', '50|ms', 0.5)),
        ('baz:23|g', ('baz', '23|g', 1)),
    )

    def _check(o, s, v, r):
        with mock.patch.object(random, 'random', lambda: -1):
            eq_(o, cl._prepare(s, v, r))

    for o, (s, v, r) in tests:
        _check(o, s, v, r)


@mock.patch.object(random, 'random', lambda: -1)
def test_prepare_udp():
    """Test StatsClient._prepare method."""
    cl = _udp_client()
    _test_prepare(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_prepare_tcp():
    """Test TCPStatsClient._prepare method."""
    cl = _tcp_client()
    _test_prepare(cl, 'tcp')


def _test_prefix(cl, proto):
    cl.incr('bar')
    _sock_check(cl._sock, 1, proto, 'foo.bar:1|c')


@mock.patch.object(random, 'random', lambda: -1)
def test_prefix_udp():
    """StatsClient.incr works."""
    cl = _udp_client(prefix='foo')
    _test_prefix(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_prefix_tcp():
    """TCPStatsClient.incr works."""
    cl = _tcp_client(prefix='foo')
    _test_prefix(cl, 'tcp')


def _test_timer_manager(cl, proto):
    with cl.timer('foo'):
        pass

    _timer_check(cl._sock, 1, proto, 'foo', 'ms')


def test_timer_manager_udp():
    """StatsClient.timer can be used as manager."""
    cl = _udp_client()
    _test_timer_manager(cl, 'udp')


def test_timer_manager_tcp():
    """TCPStatsClient.timer can be used as manager."""
    cl = _tcp_client()
    _test_timer_manager(cl, 'tcp')


def _test_timer_decorator(cl, proto):
    @cl.timer('foo')
    def foo(a, b):
        return [a, b]

    @cl.timer('bar')
    def bar(a, b):
        return [b, a]

    # make sure it works with more than one decorator, called multiple
    # times, and that parameters are handled correctly
    eq_([4, 2], foo(4, 2))
    _timer_check(cl._sock, 1, proto, 'foo', 'ms')

    eq_([2, 4], bar(4, 2))
    _timer_check(cl._sock, 2, proto, 'bar', 'ms')

    eq_([6, 5], bar(5, 6))
    _timer_check(cl._sock, 3, proto, 'bar', 'ms')


def test_timer_decorator_udp():
    """StatsClient.timer is a thread-safe decorator (UDP)."""
    cl = _udp_client()
    _test_timer_decorator(cl, 'udp')


def test_timer_decorator_tcp():
    """StatsClient.timer is a thread-safe decorator (TCP)."""
    cl = _tcp_client()
    _test_timer_decorator(cl, 'tcp')


def _test_timer_capture(cl, proto):
    with cl.timer('woo') as result:
        eq_(result.ms, None)
    assert isinstance(result.ms, float)


def test_timer_capture_udp():
    """You can capture the output of StatsClient.timer (UDP)."""
    cl = _udp_client()
    _test_timer_capture(cl, 'udp')


def test_timer_capture_tcp():
    """You can capture the output of StatsClient.timer (TCP)."""
    cl = _tcp_client()
    _test_timer_capture(cl, 'tcp')


def _test_timer_context_rate(cl, proto):
    with cl.timer('foo', rate=0.5):
        pass

    _timer_check(cl._sock, 1, proto, 'foo', 'ms|@0.5')


@mock.patch.object(random, 'random', lambda: -1)
def test_timer_context_rate_udp():
    """StatsClient.timer can be used as manager with rate."""
    cl = _udp_client()
    _test_timer_context_rate(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_timer_context_rate_tcp():
    """TCPStatsClient.timer can be used as manager with rate."""
    cl = _tcp_client()
    _test_timer_context_rate(cl, 'tcp')


def _test_timer_decorator_rate(cl, proto):
    @cl.timer('foo', rate=0.1)
    def foo(a, b):
        return [b, a]

    @cl.timer('bar', rate=0.2)
    def bar(a, b=2, c=3):
        return [c, b, a]

    eq_([2, 4], foo(4, 2))
    _timer_check(cl._sock, 1, proto, 'foo', 'ms|@0.1')

    eq_([3, 2, 5], bar(5))
    _timer_check(cl._sock, 2, proto, 'bar', 'ms|@0.2')


@mock.patch.object(random, 'random', lambda: -1)
def test_timer_decorator_rate_udp():
    """StatsClient.timer can be used as decorator with rate."""
    cl = _udp_client()
    _test_timer_decorator_rate(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_timer_decorator_rate_tcp():
    """TCPStatsClient.timer can be used as decorator with rate."""
    cl = _tcp_client()
    _test_timer_decorator_rate(cl, 'tcp')


def _test_timer_context_exceptions(cl, proto):
    with assert_raises(socket.timeout):
        with cl.timer('foo'):
            raise socket.timeout()

    _timer_check(cl._sock, 1, proto, 'foo', 'ms')


def test_timer_context_exceptions_udp():
    cl = _udp_client()
    _test_timer_context_exceptions(cl, 'udp')


def test_timer_context_exceptions_tcp():
    cl = _tcp_client()
    _test_timer_context_exceptions(cl, 'tcp')


def _test_timer_decorator_exceptions(cl, proto):
    @cl.timer('foo')
    def foo():
        raise ValueError()

    with assert_raises(ValueError):
        foo()

    _timer_check(cl._sock, 1, proto, 'foo', 'ms')


def test_timer_decorator_exceptions_udp():
    cl = _udp_client()
    _test_timer_decorator_exceptions(cl, 'udp')


def test_timer_decorator_exceptions_tcp():
    cl = _tcp_client()
    _test_timer_decorator_exceptions(cl, 'tcp')


def _test_timer_object(cl, proto):
    t = cl.timer('foo').start()
    t.stop()

    _timer_check(cl._sock, 1, proto, 'foo', 'ms')


def test_timer_object_udp():
    """StatsClient.timer works."""
    cl = _udp_client()
    _test_timer_object(cl, 'udp')


def test_timer_object_tcp():
    """TCPStatsClient.timer works."""
    cl = _tcp_client()
    _test_timer_object(cl, 'tcp')


def _test_timer_object_no_send(cl, proto):
    t = cl.timer('foo').start()
    t.stop(send=False)
    _sock_check(cl._sock, 0, proto)

    t.send()
    _timer_check(cl._sock, 1, proto, 'foo', 'ms')


def test_timer_object_no_send_udp():
    """Stop StatsClient.timer without sending."""
    cl = _udp_client()
    _test_timer_object_no_send(cl, 'udp')


def test_timer_object_no_send_tcp():
    """Stop TCPStatsClient.timer without sending."""
    cl = _tcp_client()
    _test_timer_object_no_send(cl, 'tcp')


def _test_timer_object_rate(cl, proto):
    t = cl.timer('foo', rate=0.5)
    t.start()
    t.stop()

    _timer_check(cl._sock, 1, proto, 'foo', 'ms@0.5')


@mock.patch.object(random, 'random', lambda: -1)
def test_timer_object_rate_udp():
    """StatsClient.timer works with rate."""
    cl = _udp_client()
    _test_timer_object_rate(cl, 'udp')


@mock.patch.object(random, 'random', lambda: -1)
def test_timer_object_rate_tcp():
    """TCPStatsClient.timer works with rate."""
    cl = _tcp_client()
    _test_timer_object_rate(cl, 'tcp')


def _test_timer_object_no_send_twice(cl):
    t = cl.timer('foo').start()
    t.stop()

    with assert_raises(RuntimeError):
        t.send()


def test_timer_object_no_send_twice_udp():
    """StatsClient.timer raises RuntimeError if send is called twice."""
    cl = _udp_client()
    _test_timer_object_no_send_twice(cl)


def test_timer_object_no_send_twice_tcp():
    """TCPStatsClient.timer raises RuntimeError if send is called twice."""
    cl = _tcp_client()
    _test_timer_object_no_send_twice(cl)


def _test_timer_send_without_stop(cl):
    with cl.timer('foo') as t:
        assert t.ms is None
        with assert_raises(RuntimeError):
            t.send()

    t = cl.timer('bar').start()
    assert t.ms is None
    with assert_raises(RuntimeError):
        t.send()


def test_timer_send_without_stop_udp():
    """StatsClient.timer raises error if send is called before stop."""
    cl = _udp_client()
    _test_timer_send_without_stop(cl)


def test_timer_send_without_stop_tcp():
    """TCPStatsClient.timer raises error if send is called before stop."""
    cl = _tcp_client()
    _test_timer_send_without_stop(cl)


def _test_timer_object_stop_without_start(cl):
    with assert_raises(RuntimeError):
        cl.timer('foo').stop()


def test_timer_object_stop_without_start_udp():
    """StatsClient.timer raises error if stop is called before start."""
    cl = _udp_client()
    _test_timer_object_stop_without_start(cl)


def test_timer_object_stop_without_start_tcp():
    """TCPStatsClient.timer raises error if stop is called before start."""
    cl = _tcp_client()
    _test_timer_object_stop_without_start(cl)


def _test_pipeline(cl, proto):
    pipe = cl.pipeline()
    pipe.incr('foo')
    pipe.decr('bar')
    pipe.timing('baz', 320)
    pipe.send()
    _sock_check(cl._sock, 1, proto, 'foo:1|c\nbar:-1|c\nbaz:320.000000|ms')


def test_pipeline_udp():
    """StatsClient.pipeline works."""
    cl = _udp_client()
    _test_pipeline(cl, 'udp')


def test_pipeline_tcp():
    """TCPStatsClient.pipeline works."""
    cl = _tcp_client()
    _test_pipeline(cl, 'tcp')


def _test_pipeline_null(cl, proto):
    pipe = cl.pipeline()
    pipe.send()
    _sock_check(cl._sock, 0, proto)


def test_pipeline_null_udp():
    """Ensure we don't error on an empty pipeline (UDP)."""
    cl = _udp_client()
    _test_pipeline_null(cl, 'udp')


def test_pipeline_null_tcp():
    """Ensure we don't error on an empty pipeline (TCP)."""
    cl = _tcp_client()
    _test_pipeline_null(cl, 'tcp')


def _test_pipeline_manager(cl, proto):
    with cl.pipeline() as pipe:
        pipe.incr('foo')
        pipe.decr('bar')
        pipe.gauge('baz', 15)
    _sock_check(cl._sock, 1, proto, 'foo:1|c\nbar:-1|c\nbaz:15|g')


def test_pipeline_manager_udp():
    """StatsClient.pipeline can be used as manager."""
    cl = _udp_client()
    _test_pipeline_manager(cl, 'udp')


def test_pipeline_manager_tcp():
    """TCPStatsClient.pipeline can be used as manager."""
    cl = _tcp_client()
    _test_pipeline_manager(cl, 'tcp')


def _test_pipeline_timer_manager(cl, proto):
    with cl.pipeline() as pipe:
        with pipe.timer('foo'):
            pass
    _timer_check(cl._sock, 1, proto, 'foo', 'ms')


def test_pipeline_timer_manager_udp():
    """Timer manager can be retrieve from UDP Pipeline manager."""
    cl = _udp_client()
    _test_pipeline_timer_manager(cl, 'udp')


def test_pipeline_timer_manager_tcp():
    """Timer manager can be retrieve from TCP Pipeline manager."""
    cl = _tcp_client()
    _test_pipeline_timer_manager(cl, 'tcp')


def _test_pipeline_timer_decorator(cl, proto):
    with cl.pipeline() as pipe:
        @pipe.timer('foo')
        def foo():
            pass
        foo()
    _timer_check(cl._sock, 1, proto, 'foo', 'ms')


def test_pipeline_timer_decorator_udp():
    """UDP Pipeline manager can be used as decorator."""
    cl = _udp_client()
    _test_pipeline_timer_decorator(cl, 'udp')


def test_pipeline_timer_decorator_tcp():
    """TCP Pipeline manager can be used as decorator."""
    cl = _tcp_client()
    _test_pipeline_timer_decorator(cl, 'tcp')


def _test_pipeline_timer_object(cl, proto):
    with cl.pipeline() as pipe:
        t = pipe.timer('foo').start()
        t.stop()
        _sock_check(cl._sock, 0, proto)
    _timer_check(cl._sock, 1, proto, 'foo', 'ms')


def test_pipeline_timer_object_udp():
    """Timer from UDP Pipeline manager works."""
    cl = _udp_client()
    _test_pipeline_timer_object(cl, 'udp')


def test_pipeline_timer_object_tcp():
    """Timer from TCP Pipeline manager works."""
    cl = _tcp_client()
    _test_pipeline_timer_object(cl, 'tcp')


def _test_pipeline_empty(cl):
    with cl.pipeline() as pipe:
        pipe.incr('foo')
        eq_(1, len(pipe._stats))
    eq_(0, len(pipe._stats))


def test_pipeline_empty_udp():
    """Pipelines should be empty after a send() call (UDP)."""
    cl = _udp_client()
    _test_pipeline_empty(cl)


def test_pipeline_empty_tcp():
    """Pipelines should be empty after a send() call (TCP)."""
    cl = _tcp_client()
    _test_pipeline_empty(cl)


def _test_pipeline_negative_absolute_gauge(cl, proto):
    with cl.pipeline() as pipe:
        pipe.gauge('foo', -10, delta=False)
        pipe.incr('bar')
    _sock_check(cl._sock, 1, proto, 'foo:0|g\nfoo:-10|g\nbar:1|c')


def test_pipeline_negative_absolute_gauge_udp():
    """Negative absolute gauges use an internal pipeline (UDP)."""
    cl = _udp_client()
    _test_pipeline_negative_absolute_gauge(cl, 'udp')


def test_pipeline_negative_absolute_gauge_tcp():
    """Negative absolute gauges use an internal pipeline (TCP)."""
    cl = _tcp_client()
    _test_pipeline_negative_absolute_gauge(cl, 'tcp')


def _test_big_numbers(cl, proto):
    num = 1234568901234
    tests = (
        # Explicitly create strings so we avoid the bug we're trying to test.
        ('gauge', 'foo:1234568901234|g'),
        ('incr', 'foo:1234568901234|c'),
        ('timing', 'foo:1234568901234.000000|ms'),
    )

    def _check(method, result):
        cl._sock.reset_mock()
        getattr(cl, method)('foo', num)
        _sock_check(cl._sock, 1, proto, result)

    for method, result in tests:
        _check(method, result)


def test_big_numbers_udp():
    """Test big numbers with UDP client."""
    cl = _udp_client()
    _test_big_numbers(cl, 'udp')


def test_big_numbers_tcp():
    """Test big numbers with TCP client."""
    cl = _tcp_client()
    _test_big_numbers(cl, 'tcp')


def _test_rate_no_send(cl, proto):
    cl.incr('foo', rate=0.5)
    _sock_check(cl._sock, 0, proto)


@mock.patch.object(random, 'random', lambda: 2)
def test_rate_no_send_udp():
    """Rate below random value prevents sending with StatsClient.incr."""
    cl = _udp_client()
    _test_rate_no_send(cl, 'udp')


@mock.patch.object(random, 'random', lambda: 2)
def test_rate_no_send_tcp():
    """Rate below random value prevents sending with TCPStatsClient.incr."""
    cl = _tcp_client()
    _test_rate_no_send(cl, 'tcp')


def test_socket_error():
    """Socket error on StatsClient should be ignored."""
    cl = _udp_client()
    cl._sock.sendto.side_effect = socket.timeout()
    cl.incr('foo')
    _sock_check(cl._sock, 1, 'udp', 'foo:1|c')


def test_pipeline_packet_size():
    """Pipelines shouldn't send packets larger than 512 bytes (UDP only)."""
    sc = _udp_client()
    pipe = sc.pipeline()
    for x in range(32):
        # 32 * 16 = 512, so this will need 2 packets.
        pipe.incr('sixteen_char_str')
    pipe.send()
    eq_(2, sc._sock.sendto.call_count)
    assert len(sc._sock.sendto.call_args_list[0][0][0]) <= 512
    assert len(sc._sock.sendto.call_args_list[1][0][0]) <= 512


@mock.patch.object(socket, 'socket')
def test_tcp_raises_exception_to_user(mock_socket):
    """Socket errors in TCPStatsClient should be raised to user."""
    addr = ('127.0.0.1', 1234)
    cl = _tcp_client(addr=addr[0], port=addr[1])
    cl.incr('foo')
    cl._sock.sendall.assert_called_once()
    cl._sock.sendall.side_effect = socket.error
    with assert_raises(socket.error):
        cl.incr('foo')


@mock.patch.object(socket, 'socket')
def test_tcp_timeout(mock_socket):
    """Timeout on TCPStatsClient should be set on socket."""
    test_timeout = 321
    cl = TCPStatsClient(timeout=test_timeout)
    cl.incr('foo')
    cl._sock.settimeout.assert_called_once()
    cl._sock.settimeout.assert_called_with(test_timeout)
