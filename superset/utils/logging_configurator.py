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
from collections.abc import Mapping
from logging.handlers import TimedRotatingFileHandler
from typing import Any

import flask.app
import flask.config
from celery.signals import setup_logging

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


def keep_configured_logging(**kwargs: Any) -> None:  # pylint: disable=unused-argument
    """
    Receiver for Celery's ``setup_logging`` signal.

    Celery skips its own logging setup as soon as this signal has a receiver,
    so the handlers and levels applied by ``LOGGING_CONFIGURATOR`` stay the only
    logging configuration of a worker or beat process. There is nothing left to
    do here; the ``loglevel`` and ``logfile`` Celery passes along are ignored on
    purpose, see :func:`configure_celery_logging`.

    The receiver has to stay trivial: Celery sends the signal again in every
    prefork child when ``--logfile`` contains ``%i``, and an exception raised by
    a receiver is logged and swallowed while logging still counts as handled.

    :see: https://docs.celeryq.dev/en/stable/userguide/signals.html#setup-logging
    """


def configure_celery_logging(app_config: Mapping[str, Any]) -> bool:
    """
    Apply ``CELERY_SKIP_LOGGING_SETUP`` to the Celery processes of this app.

    Celery configures logging when a worker or beat process starts, after the
    application, and with it ``LOGGING_CONFIGURATOR``, has been imported. By
    default it replaces the handlers of the root logger with its own text handler
    (``worker_hijack_root_logger``). Even with that setting off it still sets the
    root level to the worker's ``--loglevel`` (``WARNING`` when the option is
    omitted), adds a text handler to the ``celery.task`` logger and stops that
    logger from propagating, so records from ``celery.utils.log.get_task_logger``
    bypass the configured handlers, and adds a text handler to the
    ``multiprocessing`` logger.

    When ``CELERY_SKIP_LOGGING_SETUP`` is enabled, a receiver is connected to the
    ``setup_logging`` signal, which makes Celery skip that setup entirely, so the
    configured logging is kept as is. In exchange the ``--loglevel`` and
    ``--logfile`` options of ``celery worker`` and ``celery beat`` and the
    ``worker_redirect_stdouts`` setting are not applied: levels and destinations
    come from ``LOG_LEVEL``, ``ENABLE_TIME_ROTATE`` and the related settings, or
    from a custom configurator, as they do for the web server. Records from task
    loggers are then formatted by the configured handlers, without Celery's task
    name and id fields unless the formatter adds them. The receiver cannot honour
    ``--loglevel`` instead, because Celery passes its command-line default
    (``WARNING``) when the option is omitted, which cannot be told apart from an
    explicit ``-l WARNING``.

    This has to run before Celery builds the worker; the Celery entrypoint
    (``superset.tasks.celery_app``) calls it right after ``create_app()``.

    :param app_config: The app config, with ``superset_config`` already applied
    :returns: Whether the receiver was connected
    """
    if not app_config.get("CELERY_SKIP_LOGGING_SETUP"):
        return False

    # Connecting the same receiver twice is a no-op for Celery
    setup_logging.connect(keep_configured_logging)
    return True
