import logging
import unittest

from superset.utils.log import AbstractEventLogger, DBEventLogger, get_event_logger_from_cfg_value


class TestEventLogger(unittest.TestCase):

    def test_returns_configured_object_if_correct(self):
        # test that assignment of concrete AbstractBaseClass impl returns unmodified object
        obj = DBEventLogger()
        res = get_event_logger_from_cfg_value(obj)
        self.assertTrue(obj is res)

    def test_event_logger_config_class_deprecation(self):
        # test that assignment of a class object to EVENT_LOGGER is correctly deprecated
        res = None

        # print warning if a class is assigned to EVENT_LOGGER
        with self.assertLogs(level='WARNING') as l:
            res = get_event_logger_from_cfg_value(DBEventLogger)

        # class is instantiated and returned
        self.assertIsInstance(res, DBEventLogger)

    def test_raises_typerror_if_not_abc_impl(self):
        # test that assignment of non AbstractEventLogger derived type raises TypeError
        with self.assertRaises(TypeError) as f:
            get_event_logger_from_cfg_value(logging.getLogger())