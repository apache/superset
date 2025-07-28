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
import abc
import logging
from logging.handlers import TimedRotatingFileHandler

import flask.app
import flask.config

logger = logging.getLogger(__name__)


class LoggingConfigurator(abc.ABC):  # pylint: disable=too-few-public-methods
    @abc.abstractmethod
    def configure_logging(
        self, app_config: flask.config.Config, debug_mode: bool
    ) -> None:
        pass


class DefaultLoggingConfigurator(  # pylint: disable=too-few-public-methods
    LoggingConfigurator
):
    def configure_logging(
        self, app_config: flask.config.Config, debug_mode: bool
    ) -> None:
        conf = app_config
        if conf["SILENCE_FAB"]:
            logging.getLogger("flask_appbuilder").setLevel(logging.ERROR)

        # basicConfig() will set up a default StreamHandler on stderr
        logging.basicConfig(format=conf["LOG_FORMAT"])
        logging.getLogger().setLevel(conf["LOG_LEVEL"])

        if conf["ENABLE_TIME_ROTATE"]:
            logging.getLogger().setLevel(conf["TIME_ROTATE_LOG_LEVEL"])
            handler = TimedRotatingFileHandler(
                conf["FILENAME"],
                when=conf["ROLLOVER"],
                interval=conf["INTERVAL"],
                backupCount=conf["BACKUP_COUNT"],
            )
            logging.getLogger().addHandler(handler)

        logger.debug("logging was configured successfully")
