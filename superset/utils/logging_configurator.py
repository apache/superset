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
import warnings
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
        if app_config["SILENCE_FAB"]:
            logging.getLogger("flask_appbuilder").setLevel(logging.ERROR)

        # basicConfig() will set up a default StreamHandler on stderr
        logging.basicConfig(format=app_config["LOG_FORMAT"])
        logging.getLogger().setLevel(app_config["LOG_LEVEL"])

        # Route Python warnings through the logging framework so they get
        # proper log-level formatting instead of raw stderr output. Without
        # this, the warnings module writes multi-line text to stderr where
        # the source-code context line has no level prefix, causing log
        # aggregators to misclassify it as an error.
        logging.captureWarnings(True)

        # sqlalchemy-redshift's own __init__ still imports pkg_resources
        # (superset/db_engine_specs/redshift.py has the full rationale and
        # a matching filter). That filter only registers the first time
        # something accesses Database.db_engine_spec, which normally
        # happens before the first create_engine() call for a Redshift
        # connection -- but isn't guaranteed to be the very first thing
        # that touches the process. Registering the same filter here,
        # unconditionally and as early as possible in app/worker startup,
        # closes that gap regardless of what runs first.
        warnings.filterwarnings(
            "ignore",
            message=r"pkg_resources is deprecated as an API",
        )

        if app_config["ENABLE_TIME_ROTATE"]:
            logging.getLogger().setLevel(app_config["TIME_ROTATE_LOG_LEVEL"])
            handler = TimedRotatingFileHandler(
                app_config["FILENAME"],
                when=app_config["ROLLOVER"],
                interval=app_config["INTERVAL"],
                backupCount=app_config["BACKUP_COUNT"],
            )
            logging.getLogger().addHandler(handler)

        logger.debug("logging was configured successfully")
