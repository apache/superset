from __future__ import absolute_import

from kombu import transport

from kombu.tests.case import Case, Mock, patch


class test_supports_librabbitmq(Case):

    def test_eventlet(self):
        with patch('kombu.transport._detect_environment') as de:
            de.return_value = 'eventlet'
            self.assertFalse(transport.supports_librabbitmq())


class test_transport(Case):

    def test_resolve_transport(self):
        from kombu.transport.memory import Transport
        self.assertIs(transport.resolve_transport(
            'kombu.transport.memory:Transport'),
            Transport)
        self.assertIs(transport.resolve_transport(Transport), Transport)

    def test_resolve_transport_alias_callable(self):
        m = transport.TRANSPORT_ALIASES['George'] = Mock(name='lazyalias')
        try:
            transport.resolve_transport('George')
            m.assert_called_with()
        finally:
            transport.TRANSPORT_ALIASES.pop('George')

    def test_resolve_transport_alias(self):
        self.assertTrue(transport.resolve_transport('pyamqp'))


class test_transport_ghettoq(Case):

    @patch('warnings.warn')
    def test_compat(self, warn):
        x = transport._ghettoq('Redis', 'redis', 'redis')

        self.assertEqual(x(), 'kombu.transport.redis.Transport')
        self.assertTrue(warn.called)
