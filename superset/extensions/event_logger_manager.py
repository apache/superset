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

from superset.utils.log import AbstractEventLogger, StdOutEventLogger


class EventLoggerManager:
    _instance = None

    def __new__(cls) -> "EventLoggerManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._event_logger = (
                StdOutEventLogger()
            )  # Initialize with default logger
        return cls._instance

    def get_event_logger(self) -> AbstractEventLogger:
        return self._event_logger

    def set_event_logger(self, logger: AbstractEventLogger) -> None:
        self._event_logger = logger  # pylint: disable=attribute-defined-outside-init


__all__ = ["EventLoggerManager"]
