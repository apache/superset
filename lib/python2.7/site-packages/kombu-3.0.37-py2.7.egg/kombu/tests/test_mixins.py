from __future__ import absolute_import, unicode_literals

import socket

from kombu.mixins import ConsumerMixin

from .case import Case, Mock, ContextMock, patch


def Message(body, content_type='text/plain', content_encoding='utf-8'):
    m = Mock(name='Message')
    m.body = body
    m.content_type = content_type
    m.content_encoding = content_encoding
    return m


class Cons(ConsumerMixin):

    def __init__(self, consumers):
        self.calls = Mock(name='ConsumerMixin')
        self.calls.get_consumers.return_value = consumers
        self.get_consumers = self.calls.get_consumers
        self.on_connection_revived = self.calls.on_connection_revived
        self.on_consume_ready = self.calls.on_consume_ready
        self.on_consume_end = self.calls.on_consume_end
        self.on_iteration = self.calls.on_iteration
        self.on_decode_error = self.calls.on_decode_error
        self.on_connection_error = self.calls.on_connection_error
        self.extra_context = ContextMock(name='extra_context')
        self.extra_context.return_value = self.extra_context


class test_ConsumerMixin(Case):

    def _context(self):
        Acons = ContextMock(name='consumerA')
        Bcons = ContextMock(name='consumerB')
        c = Cons([Acons, Bcons])
        _conn = c.connection = ContextMock(name='connection')
        est = c.establish_connection = Mock(name='est_connection')
        est.return_value = _conn
        return c, Acons, Bcons

    def test_consume(self):
        c, Acons, Bcons = self._context()
        c.should_stop = False
        it = c.consume(no_ack=True)
        next(it)
        Acons.__enter__.assert_called_with()
        Bcons.__enter__.assert_called_with()
        c.extra_context.__enter__.assert_called_with()
        self.assertTrue(c.on_consume_ready.called)
        c.on_iteration.assert_called_with()
        c.connection.drain_events.assert_called_with(timeout=1)
        next(it)
        next(it)
        next(it)
        c.should_stop = True
        with self.assertRaises(StopIteration):
            next(it)

    def test_consume_drain_raises_socket_error(self):
        c, Acons, Bcons = self._context()
        c.should_stop = False
        it = c.consume(no_ack=True)
        c.connection.drain_events.side_effect = socket.error
        with self.assertRaises(socket.error):
            next(it)

        def se2(*args, **kwargs):
            c.should_stop = True
            raise socket.error()
        c.connection.drain_events.side_effect = se2
        it = c.consume(no_ack=True)
        with self.assertRaises(StopIteration):
            next(it)

    def test_consume_drain_raises_socket_timeout(self):
        c, Acons, Bcons = self._context()
        c.should_stop = False
        it = c.consume(no_ack=True, timeout=1)

        def se(*args, **kwargs):
            c.should_stop = True
            raise socket.timeout()
        c.connection.drain_events.side_effect = se
        with self.assertRaises(socket.error):
            next(it)

    def test_Consumer_context(self):
        c, Acons, Bcons = self._context()

        with c.Consumer() as (conn, channel, consumer):
            self.assertIs(conn, c.connection)
            self.assertIs(channel, conn.default_channel)
            c.on_connection_revived.assert_called_with()
            self.assertTrue(c.get_consumers.called)
            cls = c.get_consumers.call_args[0][0]

            subcons = cls()
            self.assertIs(subcons.on_decode_error, c.on_decode_error)
            self.assertIs(subcons.channel, conn.default_channel)
            Acons.__enter__.assert_called_with()
            Bcons.__enter__.assert_called_with()
        c.on_consume_end.assert_called_with(conn, channel)


class test_ConsumerMixin_interface(Case):

    def setUp(self):
        self.c = ConsumerMixin()

    def test_get_consumers(self):
        with self.assertRaises(NotImplementedError):
            self.c.get_consumers(Mock(), Mock())

    def test_on_connection_revived(self):
        self.assertIsNone(self.c.on_connection_revived())

    def test_on_consume_ready(self):
        self.assertIsNone(self.c.on_consume_ready(
            Mock(), Mock(), [],
        ))

    def test_on_consume_end(self):
        self.assertIsNone(self.c.on_consume_end(Mock(), Mock()))

    def test_on_iteration(self):
        self.assertIsNone(self.c.on_iteration())

    def test_on_decode_error(self):
        message = Message('foo')
        with patch('kombu.mixins.error') as error:
            self.c.on_decode_error(message, KeyError('foo'))
            self.assertTrue(error.called)
            message.ack.assert_called_with()

    def test_on_connection_error(self):
        with patch('kombu.mixins.warn') as warn:
            self.c.on_connection_error(KeyError('foo'), 3)
            self.assertTrue(warn.called)

    def test_extra_context(self):
        with self.c.extra_context(Mock(), Mock()):
            pass

    def test_restart_limit(self):
        self.assertTrue(self.c.restart_limit)

    def test_connection_errors(self):
        conn = Mock(name='connection')
        self.c.connection = conn
        conn.connection_errors = (KeyError, )
        self.assertTupleEqual(self.c.connection_errors, conn.connection_errors)
        conn.channel_errors = (ValueError, )
        self.assertTupleEqual(self.c.channel_errors, conn.channel_errors)

    def test__consume_from(self):
        a = ContextMock(name='A')
        b = ContextMock(name='B')
        a.__enter__ = Mock(name='A.__enter__')
        b.__enter__ = Mock(name='B.__enter__')
        with self.c._consume_from(a, b):
            pass
        a.__enter__.assert_called_with()
        b.__enter__.assert_called_with()

    def test_establish_connection(self):
        conn = ContextMock(name='connection')
        conn.clone.return_value = conn
        self.c.connection = conn
        self.c.connect_max_retries = 3

        with self.c.establish_connection() as conn:
            self.assertTrue(conn)
        conn.ensure_connection.assert_called_with(
            self.c.on_connection_error, 3,
        )

    def test_maybe_conn_error(self):
        conn = ContextMock(name='connection')
        conn.connection_errors = (KeyError, )
        conn.channel_errors = ()

        self.c.connection = conn

        def raises():
            raise KeyError('foo')
        self.c.maybe_conn_error(raises)

    def test_run(self):
        conn = ContextMock(name='connection')
        self.c.connection = conn
        conn.connection_errors = (KeyError, )
        conn.channel_errors = ()
        consume = self.c.consume = Mock(name='c.consume')

        def se(*args, **kwargs):
            self.c.should_stop = True
            return [1]
        self.c.should_stop = False
        consume.side_effect = se
        self.c.run()

    def test_run_restart_rate_limited(self):
        conn = ContextMock(name='connection')
        self.c.connection = conn
        conn.connection_errors = (KeyError, )
        conn.channel_errors = ()
        consume = self.c.consume = Mock(name='c.consume')
        with patch('kombu.mixins.sleep') as sleep:
            counter = [0]

            def se(*args, **kwargs):
                if counter[0] >= 1:
                    self.c.should_stop = True
                counter[0] += 1
                return counter
            self.c.should_stop = False
            consume.side_effect = se
            self.c.run()
            self.assertTrue(sleep.called)

    def test_run_raises(self):
        conn = ContextMock(name='connection')
        self.c.connection = conn
        conn.connection_errors = (KeyError, )
        conn.channel_errors = ()
        consume = self.c.consume = Mock(name='c.consume')

        with patch('kombu.mixins.warn') as warn:
            def se_raises(*args, **kwargs):
                self.c.should_stop = True
                raise KeyError('foo')
            self.c.should_stop = False
            consume.side_effect = se_raises
            self.c.run()
            self.assertTrue(warn.called)
