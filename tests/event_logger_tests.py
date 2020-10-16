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
import time
import unittest
from datetime import datetime
from unittest.mock import patch

from superset.utils.log import (
    AbstractEventLogger,
    DBEventLogger,
    get_event_logger_from_cfg_value,
)
from tests.test_app import app


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
        with self.assertLogs(level="WARNING"):
            res = get_event_logger_from_cfg_value(DBEventLogger)

        # class is instantiated and returned
        self.assertIsInstance(res, DBEventLogger)

    def test_raises_typerror_if_not_abc_impl(self):
        # test that assignment of non AbstractEventLogger derived type raises TypeError
        with self.assertRaises(TypeError):
            get_event_logger_from_cfg_value(logging.getLogger())

    @patch.object(DBEventLogger, "log")
    def test_log_this_decorator(self, mock_log):
        logger = DBEventLogger()

        @logger.log_this
        def test_func():
            time.sleep(0.05)
            return 1

        with app.test_request_context():
            result = test_func()
            self.assertEqual(result, 1)
            assert mock_log.call_args[1]["duration_ms"] >= 50

    @patch.object(DBEventLogger, "log")
    def test_log_manually_decorator(self, mock_log):
        logger = DBEventLogger()

        @logger.log_manually
        def test_func(arg1, update_log_payload, karg1=1):
            time.sleep(0.1)
            update_log_payload(foo="bar")
            return arg1 * karg1

        with app.test_request_context():
            result = test_func(1, karg1=2)  # pylint: disable=no-value-for-parameter
            self.assertEqual(result, 2)
            # should contain only manual payload
            self.assertEqual(mock_log.call_args[1]["records"], [{"foo": "bar"}])
            assert mock_log.call_args[1]["duration_ms"] >= 100
