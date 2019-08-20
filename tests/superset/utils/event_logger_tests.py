# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import logging
from typing import List
import unittest

from superset.utils.event_logger import (
    AbstractEventLogger,
    DBEventLogger,
    get_event_logger_from_cfg_value,
    SupersetEvent,
)


class TestEventLoggerInstanceConfiguration(unittest.TestCase):
    def test_returns_configured_object_if_correct(self):
        # test that assignment of concrete AbstractBaseClass impl returns unmodified object
        obj = DBEventLogger()
        res = get_event_logger_from_cfg_value(obj)
        self.assertTrue(obj is res)

    def test_event_logger_config_class_deprecation(self):
        # test that assignment of a class object to EVENT_LOGGER is correctly deprecated
        res = None

        # print warning if a class is assigned to EVENT_LOGGER
        with self.assertLogs(level="WARNING"):
            res = get_event_logger_from_cfg_value(DBEventLogger)

        # class is instantiated and returned
        self.assertIsInstance(res, DBEventLogger)

    def test_raises_typerror_if_not_abc_impl(self):
        # test that assignment of non AbstractEventLogger derived type raises TypeError
        with self.assertRaises(TypeError):
            get_event_logger_from_cfg_value(logging.getLogger())


class TestEventLoggerEventLogging(unittest.TestCase):
    class TestHandler(logging.Handler):
        def __init__(self):
            super().__init__(level=logging.DEBUG)
            self.received_event = None
            self.received_record = None

        def handle(self, record):
            self.received_event = SupersetEvent.from_log_record(record)
            self.received_record = record

    class TestLogger(AbstractEventLogger):
        def __init__(self, ignored_event_type_names: List[str] = None) -> None:
            super().__init__(ignored_event_type_names)

        def log(self, user_id, action, *args, **kwargs):
            pass

    def test_event_data_on_log_record(self):
        handler = TestEventLoggerEventLogging.TestHandler()
        logging.getLogger("superset_events").addHandler(handler)
        event_logger = TestEventLoggerEventLogging.TestLogger()
        event_logger.log_event(SupersetEvent("test_event", {"foo": "bar"}))

        ev = handler.received_event
        self.assertEqual(ev.type_name, "test_event")
        self.assertEqual(ev.data["foo"], "bar")

    def test_ignored_event_types(self):
        handler = TestEventLoggerEventLogging.TestHandler()
        logging.getLogger("superset_events").addHandler(handler)

        event_logger = TestEventLoggerEventLogging.TestLogger(
            ignored_event_type_names=["test_event_a"]
        )
        event_logger.log_event(SupersetEvent("test_event_a", {"foo": "bar"}))
        self.assertIsNone(handler.received_event)

        event_logger.log_event(SupersetEvent("test_event_b", {"foo": "bar"}))
        self.assertIsNotNone(handler.received_event)

    def test_custom_event_msg_type(self):
        class MyEvent(SupersetEvent):
            def __init__(self, value: int) -> None:
                super().__init__("my_event", {"value": value})

            def to_log_msg(self):
                return "foobar"

        handler = TestEventLoggerEventLogging.TestHandler()
        logging.getLogger("superset_events").addHandler(handler)
        event_logger = TestEventLoggerEventLogging.TestLogger()
        event_logger.log_event(MyEvent(4))

        self.assertEqual(handler.received_record.msg, "foobar")
