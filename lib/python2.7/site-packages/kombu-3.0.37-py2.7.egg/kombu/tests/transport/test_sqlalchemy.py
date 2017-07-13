from __future__ import absolute_import

from kombu import Connection
from kombu.tests.case import Case, SkipTest, patch


class test_sqlalchemy(Case):

    def setUp(self):
        try:
            import sqlalchemy  # noqa
        except ImportError:
            raise SkipTest('sqlalchemy not installed')

    def test_url_parser(self):
        with patch('kombu.transport.sqlalchemy.Channel._open'):
            url = 'sqlalchemy+sqlite:///celerydb.sqlite'
            Connection(url).connect()

            url = 'sqla+sqlite:///celerydb.sqlite'
            Connection(url).connect()

            # Should prevent regression fixed by f187ccd
            url = 'sqlb+sqlite:///celerydb.sqlite'
            with self.assertRaises(KeyError):
                Connection(url).connect()

    def test_simple_queueing(self):
        conn = Connection('sqlalchemy+sqlite:///:memory:')
        conn.connect()
        channel = conn.channel()
        self.assertEqual(
            channel.queue_cls.__table__.name,
            'kombu_queue'
        )
        self.assertEqual(
            channel.message_cls.__table__.name,
            'kombu_message'
        )
        channel._put('celery', 'DATA')
        assert channel._get('celery') == 'DATA'

    def test_custom_table_names(self):
        raise SkipTest('causes global side effect')
        conn = Connection('sqlalchemy+sqlite:///:memory:', transport_options={
            'queue_tablename': 'my_custom_queue',
            'message_tablename': 'my_custom_message'
        })
        conn.connect()
        channel = conn.channel()
        self.assertEqual(
            channel.queue_cls.__table__.name,
            'my_custom_queue'
        )
        self.assertEqual(
            channel.message_cls.__table__.name,
            'my_custom_message'
        )
        channel._put('celery', 'DATA')
        assert channel._get('celery') == 'DATA'

    def test_clone(self):
        hostname = 'sqlite:///celerydb.sqlite'
        x = Connection('+'.join(['sqla', hostname]))
        self.assertEqual(x.uri_prefix, 'sqla')
        self.assertEqual(x.hostname, hostname)
        clone = x.clone()
        self.assertEqual(clone.hostname, hostname)
        self.assertEqual(clone.uri_prefix, 'sqla')
