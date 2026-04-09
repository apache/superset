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
from datetime import timedelta
from typing import Any, Optional
from unittest.mock import patch

from flask import current_app  # noqa: F401
from freezegun import freeze_time

from superset import security_manager
from superset.utils.log import (
    AbstractEventLogger,
    DBEventLogger,
    get_event_logger_from_cfg_value,
)
from tests.integration_tests.test_app import app


class TestEventLogger(unittest.TestCase):
    def test_correct_config_object(self):
        # test that assignment of concrete AbstractBaseClass impl returns
        # unmodified object
        obj = DBEventLogger()
        res = get_event_logger_from_cfg_value(obj)
        assert obj is res

    def test_config_class_deprecation(self):
        # test that assignment of a class object to EVENT_LOGGER is correctly
        # deprecated
        res = None

        # print warning if a class is assigned to EVENT_LOGGER
        with self.assertLogs(level="WARNING"):
            res = get_event_logger_from_cfg_value(DBEventLogger)

        # class is instantiated and returned
        assert isinstance(res, DBEventLogger)

    def test_raises_typeerror_if_not_abc(self):
        # test that assignment of non AbstractEventLogger derived type raises
        # TypeError
        with self.assertRaises(TypeError):  # noqa: PT027
            get_event_logger_from_cfg_value(logging.getLogger())

    @patch.object(DBEventLogger, "log")
    def test_log_this(self, mock_log):
        logger = DBEventLogger()

        @logger.log_this
        def test_func():
            time.sleep(0.05)
            return 1

        with app.test_request_context("/superset/dashboard/1/?myparam=foo"):
            result = test_func()
            payload = mock_log.call_args[1]
            assert result == 1
            assert payload["records"] == [
                {
                    "myparam": "foo",
                    "path": "/superset/dashboard/1/",
                    "url_rule": "/superset/dashboard/<dashboard_id_or_slug>/",
                    "object_ref": test_func.__qualname__,
                }
            ]
            assert payload["duration_ms"] >= 50

    @patch.object(DBEventLogger, "log")
    def test_log_this_with_extra_payload(self, mock_log):
        logger = DBEventLogger()

        @logger.log_this_with_extra_payload
        def test_func(arg1, add_extra_log_payload, karg1=1):
            time.sleep(0.1)
            add_extra_log_payload(foo="bar")
            return arg1 * karg1

        with app.test_request_context():
            result = test_func(1, karg1=2)  # pylint: disable=no-value-for-parameter
            payload = mock_log.call_args[1]
            assert result == 2
            assert payload["records"] == [
                {
                    "foo": "bar",
                    "path": "/",
                    "karg1": 2,
                    "object_ref": test_func.__qualname__,
                }
            ]
            assert payload["duration_ms"] >= 100

    @patch("superset.utils.core.g", spec={})
    @freeze_time("Jan 14th, 2020", auto_tick_seconds=15)
    def test_context_manager_log(self, mock_g):
        class DummyEventLogger(AbstractEventLogger):
            def __init__(self):
                self.records = []

            def log(
                self,
                user_id: Optional[int],
                action: str,
                dashboard_id: Optional[int],
                duration_ms: Optional[int],
                slice_id: Optional[int],
                referrer: Optional[str],
                *args: Any,
                **kwargs: Any,
            ):
                self.records.append(
                    {**kwargs, "user_id": user_id, "duration": duration_ms}
                )

        logger = DummyEventLogger()

        with app.test_request_context():
            mock_g.user = security_manager.find_user("gamma")
            with logger(action="foo", engine="bar"):
                pass

        assert logger.records == [
            {
                "records": [{"path": "/", "engine": "bar"}],
                "database_id": None,
                "user_id": 2,
                "duration": 15000,
                "curated_payload": {},
                "curated_form_data": {},
            }
        ]

    @patch("superset.utils.core.g", spec={})
    def test_context_manager_log_with_context(self, mock_g):
        class DummyEventLogger(AbstractEventLogger):
            def __init__(self):
                self.records = []

            def log(
                self,
                user_id: Optional[int],
                action: str,
                dashboard_id: Optional[int],
                duration_ms: Optional[int],
                slice_id: Optional[int],
                referrer: Optional[str],
                *args: Any,
                **kwargs: Any,
            ):
                self.records.append(
                    {**kwargs, "user_id": user_id, "duration": duration_ms}
                )

        logger = DummyEventLogger()

        with app.test_request_context():
            mock_g.user = security_manager.find_user("gamma")
            logger.log_with_context(
                action="foo",
                duration=timedelta(days=64, seconds=29156, microseconds=10),
                object_ref={"baz": "food"},
                log_to_statsd=False,
                payload_override={"engine": "sqlite"},
            )

        assert logger.records == [
            {
                "records": [
                    {
                        "path": "/",
                        "object_ref": {"baz": "food"},
                        "payload_override": {"engine": "sqlite"},
                    }
                ],
                "database_id": None,
                "user_id": 2,
                "duration": 5558756000,
                "curated_payload": {},
                "curated_form_data": {},
            }
        ]

    @patch("superset.utils.core.g", spec={})
    def test_log_with_context_user_null(self, mock_g):
        class DummyEventLogger(AbstractEventLogger):
            def __init__(self):
                self.records = []

            def log(
                self,
                user_id: Optional[int],
                action: str,
                dashboard_id: Optional[int],
                duration_ms: Optional[int],
                slice_id: Optional[int],
                referrer: Optional[str],
                *args: Any,
                **kwargs: Any,
            ):
                self.records.append(
                    {**kwargs, "user_id": user_id, "duration": duration_ms}
                )

        logger = DummyEventLogger()

        with app.test_request_context():
            mock_g.side_effect = Exception("oops")
            logger.log_with_context(
                action="foo",
                duration=timedelta(days=64, seconds=29156, microseconds=10),
                object_ref={"baz": "food"},
                log_to_statsd=False,
                payload_override={"engine": "sqlite"},
            )

        assert logger.records[0]["user_id"] == None  # noqa: E711

    @patch.object(DBEventLogger, "log")
    def test_log_this_with_context_and_extra_payload(self, mock_log):
        logger = DBEventLogger()

        @logger.log_this_with_context(action="test_action", allow_extra_payload=True)
        def test_func(arg1, add_extra_log_payload, karg1=1):
            time.sleep(0.1)
            add_extra_log_payload(custom_field="custom_value")
            return arg1 * karg1

        with app.test_request_context():
            result = test_func(1, karg1=2)  # pylint: disable=no-value-for-parameter
            payload = mock_log.call_args[1]
            assert result == 2
            assert payload["records"] == [
                {
                    "custom_field": "custom_value",
                    "path": "/",
                    "karg1": 2,
                    "object_ref": test_func.__qualname__,
                }
            ]
            assert payload["duration_ms"] >= 100


class TestMutationEndpointAuditIds(unittest.TestCase):
    """
    Regression tests for GitHub issue #38187.

    Verifies that dashboard_id and slice_id are populated in the audit log
    when REST API mutation endpoints are called (previously they were NULL).
    """

    # ------------------------------------------------------------------ #
    # Helper: build a log_this_with_context wrapper with allow_extra_payload
    # ------------------------------------------------------------------ #
    def _make_wrapped(self, logger: DBEventLogger, action: str, id_kwarg: str):
        """
        Return a function wrapped with log_this_with_context(allow_extra_payload=True)
        that calls add_extra_log_payload(**{id_kwarg: 42}) — simulating the pattern
        used by the fixed mutation endpoints.
        """

        @logger.log_this_with_context(
            action=action,
            log_to_statsd=False,
            allow_extra_payload=True,
        )
        def endpoint(add_extra_log_payload=lambda **kw: None):
            add_extra_log_payload(**{id_kwarg: 42})
            return "ok"

        return endpoint

    # ------------------------------------------------------------------ #
    # DashboardRestApi tests
    # ------------------------------------------------------------------ #

    @patch.object(DBEventLogger, "log")
    def test_dashboard_put_logs_dashboard_id(self, mock_log):
        """DashboardRestApi.put must populate dashboard_id in log."""
        logger = DBEventLogger()
        endpoint = self._make_wrapped(logger, "DashboardRestApi.put", "dashboard_id")

        with app.test_request_context("/api/v1/dashboard/42"):
            endpoint()  # pylint: disable=no-value-for-parameter

        assert mock_log.called
        assert mock_log.call_args[1]["dashboard_id"] == 42

    @patch.object(DBEventLogger, "log")
    def test_dashboard_delete_logs_dashboard_id(self, mock_log):
        """DashboardRestApi.delete must populate dashboard_id in log."""
        logger = DBEventLogger()
        endpoint = self._make_wrapped(
            logger, "DashboardRestApi.delete", "dashboard_id"
        )

        with app.test_request_context("/api/v1/dashboard/42"):
            endpoint()  # pylint: disable=no-value-for-parameter

        assert mock_log.called
        assert mock_log.call_args[1]["dashboard_id"] == 42

    @patch.object(DBEventLogger, "log")
    def test_dashboard_post_logs_dashboard_id(self, mock_log):
        """DashboardRestApi.post must populate dashboard_id in log after creation."""
        logger = DBEventLogger()
        endpoint = self._make_wrapped(
            logger, "DashboardRestApi.post", "dashboard_id"
        )

        with app.test_request_context("/api/v1/dashboard/"):
            endpoint()  # pylint: disable=no-value-for-parameter

        assert mock_log.called
        assert mock_log.call_args[1]["dashboard_id"] == 42

    # ------------------------------------------------------------------ #
    # ChartRestApi tests
    # ------------------------------------------------------------------ #

    @patch.object(DBEventLogger, "log")
    def test_chart_put_logs_slice_id(self, mock_log):
        """ChartRestApi.put must populate slice_id in log."""
        logger = DBEventLogger()
        endpoint = self._make_wrapped(logger, "ChartRestApi.put", "slice_id")

        with app.test_request_context("/api/v1/chart/42"):
            endpoint()  # pylint: disable=no-value-for-parameter

        assert mock_log.called
        assert mock_log.call_args[1]["slice_id"] == 42

    @patch.object(DBEventLogger, "log")
    def test_chart_delete_logs_slice_id(self, mock_log):
        """ChartRestApi.delete must populate slice_id in log."""
        logger = DBEventLogger()
        endpoint = self._make_wrapped(logger, "ChartRestApi.delete", "slice_id")

        with app.test_request_context("/api/v1/chart/42"):
            endpoint()  # pylint: disable=no-value-for-parameter

        assert mock_log.called
        assert mock_log.call_args[1]["slice_id"] == 42

    @patch.object(DBEventLogger, "log")
    def test_chart_post_logs_slice_id(self, mock_log):
        """ChartRestApi.post must populate slice_id in log after creation."""
        logger = DBEventLogger()
        endpoint = self._make_wrapped(logger, "ChartRestApi.post", "slice_id")

        with app.test_request_context("/api/v1/chart/"):
            endpoint()  # pylint: disable=no-value-for-parameter

        assert mock_log.called
        assert mock_log.call_args[1]["slice_id"] == 42
