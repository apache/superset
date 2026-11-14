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
"""Tests for the Celery part of ``superset.utils.logging_configurator``."""

import logging
import os
import sys
import warnings
from collections.abc import Iterator
from pathlib import Path
from unittest import mock

import pytest
from celery import Celery
from celery.app.log import Logging
from celery.signals import setup_logging

from superset.utils.logging_configurator import keep_configured_logging

# Loggers that Celery's logging setup touches
LOGGERS = ("", "celery", "celery.task", "multiprocessing")


def _logger_state(name: str) -> tuple[list[logging.Handler], int, bool]:
    logger = logging.getLogger(name)
    return list(logger.handlers), logger.level, bool(logger.propagate)


@pytest.fixture
def celery_instance(monkeypatch: pytest.MonkeyPatch) -> Iterator[Celery]:
    """
    A Celery app whose logging setup can run in this process, plus a reset of
    everything that setup touches once the test is over.
    """
    # Celery configures logging once per process and remembers that in a class
    # attribute; start from a clean slate and leave no receivers behind.
    monkeypatch.setattr(Logging, "_setup", False)
    monkeypatch.setattr(setup_logging, "receivers", [])
    monkeypatch.setattr(sys, "stdout", sys.stdout)
    monkeypatch.setattr(sys, "stderr", sys.stderr)
    before = {name: _logger_state(name) for name in LOGGERS}
    # A known root level, so the tests can tell whether Celery changed it
    logging.getLogger().setLevel(logging.INFO)

    app = Celery("superset_logging_test", set_as_current=False)
    # The setting people reach for first. It does not keep Celery from adding
    # its task-logger handler or from changing the root level.
    app.conf.worker_hijack_root_logger = False

    # ``Logging.setup()`` also exports CELERY_LOG_* / _MP_FORK_* variables for
    # prefork children and adds warning filters; undo both.
    with mock.patch.dict(os.environ), warnings.catch_warnings():
        yield app

    for name, (handlers, level, propagate) in before.items():
        logger = logging.getLogger(name)
        # Drop what Celery added and keep what was there, including the capture
        # handlers pytest attaches to the root logger around every test phase.
        for handler in list(logger.handlers):
            if handler not in handlers:
                logger.removeHandler(handler)
        logger.setLevel(level)
        logger.propagate = propagate


def test_celery_reconfigures_logging_by_default(celery_instance: Celery) -> None:
    """
    Without a receiver Celery still adds a handler to the task logger and
    overrides the root level, even with ``worker_hijack_root_logger`` off.
    """
    task_logger = logging.getLogger("celery.task")
    task_handlers = list(task_logger.handlers)

    handled = celery_instance.log.setup(loglevel=logging.ERROR, logfile=None)

    assert not handled
    assert logging.getLogger().level == logging.ERROR
    assert len(task_logger.handlers) == len(task_handlers) + 1
    assert not task_logger.propagate


def test_receiver_keeps_configured_logging(
    celery_instance: Celery,
    tmp_path: Path,
) -> None:
    """
    With the receiver connected, Celery leaves every logger as the application
    configured it, opens no log file and skips the stdout/stderr redirection.
    """
    setup_logging.connect(keep_configured_logging)
    setup_logging.connect(keep_configured_logging)  # a second connect is a no-op
    assert len(setup_logging.receivers) == 1

    before = {name: _logger_state(name) for name in LOGGERS}
    stdout, stderr = sys.stdout, sys.stderr
    logfile = tmp_path / "worker.log"

    # What ``celery worker -l ERROR --logfile ...`` and ``celery beat`` run on
    # start-up; a prefork child runs it again when the file name contains ``%i``
    for _ in range(2):
        celery_instance.log.already_setup = False
        handled = celery_instance.log.setup(
            loglevel=logging.ERROR, logfile=str(logfile), redirect_stdouts=True
        )
        # Celery hands back (receiver, return value) pairs; an exception raised
        # by the receiver would show up here instead of None
        assert handled == [(keep_configured_logging, None)]

    assert {name: _logger_state(name) for name in LOGGERS} == before
    assert not logfile.exists()
    assert sys.stdout is stdout
    assert sys.stderr is stderr
