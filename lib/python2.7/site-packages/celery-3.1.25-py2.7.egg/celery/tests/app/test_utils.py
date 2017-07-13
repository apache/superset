from __future__ import absolute_import

from collections import Mapping, MutableMapping

from celery.app.utils import Settings, filter_hidden_settings, bugreport

from celery.tests.case import AppCase, Mock


class TestSettings(AppCase):
    """
    Tests of celery.app.utils.Settings
    """
    def test_is_mapping(self):
        """Settings should be a collections.Mapping"""
        self.assertTrue(issubclass(Settings, Mapping))

    def test_is_mutable_mapping(self):
        """Settings should be a collections.MutableMapping"""
        self.assertTrue(issubclass(Settings, MutableMapping))


class test_filter_hidden_settings(AppCase):

    def test_handles_non_string_keys(self):
        """filter_hidden_settings shouldn't raise an exception when handling
        mappings with non-string keys"""
        conf = {
            'STRING_KEY': 'VALUE1',
            ('NON', 'STRING', 'KEY'): 'VALUE2',
            'STRING_KEY2': {
                'STRING_KEY3': 1,
                ('NON', 'STRING', 'KEY', '2'): 2
            },
        }
        filter_hidden_settings(conf)


class test_bugreport(AppCase):

    def test_no_conn_driver_info(self):
        self.app.connection = Mock()
        conn = self.app.connection.return_value = Mock()
        conn.transport = None

        bugreport(self.app)
