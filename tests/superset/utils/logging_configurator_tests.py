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
import unittest
from unittest.mock import MagicMock

from superset.utils.event_logger import SUPERSET_EVENT_LOGGER_NAME, SupersetEvent
from superset.utils.logging_configurator import LoggingConfigurator


class TestLoggingConfigurator(unittest.TestCase):
    def reset_logging(self):
        # work around all of the import side-effects in superset
        logging.root.manager.loggerDict = {}
        logging.root.handlers = []

    def test_configurator_adding_handler(self):
        class MyEventHandler(logging.Handler):
            def __init__(self):
                super().__init__(level=logging.DEBUG)
                self.received_event = False

            def handle(self, record):
                logging.info(
                    f"record to event: {SupersetEvent.from_log_record(record)}"
                )
                self.received_event = SupersetEvent.from_log_record(record) is not None

        class MyConfigurator(LoggingConfigurator):
            def __init__(self, handler):
                self.handler = handler

            def configure_logging(self, app_config, debug_mode):
                super().configure_logging(app_config, debug_mode)
                logger = logging.getLogger(SUPERSET_EVENT_LOGGER_NAME)
                logger.addHandler(self.handler)

        self.reset_logging()

        handler = MyEventHandler()
        cfg = MyConfigurator(handler)
        cfg.configure_logging(MagicMock(), True)

        ev = SupersetEvent("test_event", {"foo": "bar"})
        logging.getLogger(SUPERSET_EVENT_LOGGER_NAME).info(
            "testing", extra=ev.to_log_extra()
        )
        self.assertTrue(handler.received_event)
