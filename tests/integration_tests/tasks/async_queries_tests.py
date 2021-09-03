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
"""Unit tests for async query celery jobs in Superset"""
from unittest import mock
from uuid import uuid4

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from flask import g

from superset import db
from superset.charts.commands.data import ChartDataCommand
from superset.charts.commands.exceptions import ChartDataQueryFailedError
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import SupersetException
from superset.extensions import async_query_manager, security_manager
from superset.tasks import async_queries
from superset.tasks.async_queries import (
    ensure_user_is_set,
    load_chart_data_into_cache,
    load_explore_json_into_cache,
)
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
)
from tests.integration_tests.fixtures.query_context import get_query_context
from tests.integration_tests.test_app import app


class TestAsyncQueries(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.object(async_query_manager, "update_job")
    @mock.patch.object(async_queries, "set_form_data")
    def test_load_chart_data_into_cache(self, mock_set_form_data, mock_update_job):
        async_query_manager.init_app(app)
        query_context = get_query_context("birth_names")
        user = security_manager.find_user("gamma")
        job_metadata = {
            "channel_id": str(uuid4()),
            "job_id": str(uuid4()),
            "user_id": user.id,
            "status": "pending",
            "errors": [],
        }

        with mock.patch.object(
            async_queries, "ensure_user_is_set"
        ) as ensure_user_is_set:
            load_chart_data_into_cache(job_metadata, query_context)

        ensure_user_is_set.assert_called_once_with(user.id)
        mock_set_form_data.assert_called_once_with(query_context)
        mock_update_job.assert_called_once_with(
            job_metadata, "done", result_url=mock.ANY
        )

    @mock.patch.object(
        ChartDataCommand, "run", side_effect=ChartDataQueryFailedError("Error: foo")
    )
    @mock.patch.object(async_query_manager, "update_job")
    def test_load_chart_data_into_cache_error(self, mock_update_job, mock_run_command):
        async_query_manager.init_app(app)
        query_context = get_query_context("birth_names")
        user = security_manager.find_user("gamma")
        job_metadata = {
            "channel_id": str(uuid4()),
            "job_id": str(uuid4()),
            "user_id": user.id,
            "status": "pending",
            "errors": [],
        }
        with pytest.raises(ChartDataQueryFailedError):
            with mock.patch.object(
                async_queries, "ensure_user_is_set"
            ) as ensure_user_is_set:
                load_chart_data_into_cache(job_metadata, query_context)
            ensure_user_is_set.assert_called_once_with(user.id)

        mock_run_command.assert_called_once_with(cache=True)
        errors = [{"message": "Error: foo"}]
        mock_update_job.assert_called_once_with(job_metadata, "error", errors=errors)

    @mock.patch.object(ChartDataCommand, "run")
    @mock.patch.object(async_query_manager, "update_job")
    def test_soft_timeout_load_chart_data_into_cache(
        self, mock_update_job, mock_run_command
    ):
        async_query_manager.init_app(app)
        user = security_manager.find_user("gamma")
        form_data = {}
        job_metadata = {
            "channel_id": str(uuid4()),
            "job_id": str(uuid4()),
            "user_id": user.id,
            "status": "pending",
            "errors": [],
        }
        errors = ["A timeout occurred while loading chart data"]

        with pytest.raises(SoftTimeLimitExceeded):
            with mock.patch.object(
                async_queries, "ensure_user_is_set",
            ) as ensure_user_is_set:
                ensure_user_is_set.side_effect = SoftTimeLimitExceeded()
                load_chart_data_into_cache(job_metadata, form_data)
            ensure_user_is_set.assert_called_once_with(user.id, "error", errors=errors)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.object(async_query_manager, "update_job")
    def test_load_explore_json_into_cache(self, mock_update_job):
        async_query_manager.init_app(app)
        table = self.get_table(name="birth_names")
        user = security_manager.find_user("gamma")
        form_data = {
            "datasource": f"{table.id}__table",
            "viz_type": "dist_bar",
            "time_range_endpoints": ["inclusive", "exclusive"],
            "granularity_sqla": "ds",
            "time_range": "No filter",
            "metrics": ["count"],
            "adhoc_filters": [],
            "groupby": ["gender"],
            "row_limit": 100,
        }
        job_metadata = {
            "channel_id": str(uuid4()),
            "job_id": str(uuid4()),
            "user_id": user.id,
            "status": "pending",
            "errors": [],
        }

        with mock.patch.object(
            async_queries, "ensure_user_is_set"
        ) as ensure_user_is_set:
            load_explore_json_into_cache(job_metadata, form_data)

        ensure_user_is_set.assert_called_once_with(user.id)
        mock_update_job.assert_called_once_with(
            job_metadata, "done", result_url=mock.ANY
        )

    @mock.patch.object(async_query_manager, "update_job")
    @mock.patch.object(async_queries, "set_form_data")
    def test_load_explore_json_into_cache_error(
        self, mock_set_form_data, mock_update_job
    ):
        async_query_manager.init_app(app)
        user = security_manager.find_user("gamma")
        form_data = {}
        job_metadata = {
            "channel_id": str(uuid4()),
            "job_id": str(uuid4()),
            "user_id": user.id,
            "status": "pending",
            "errors": [],
        }

        with pytest.raises(SupersetException):
            with mock.patch.object(
                async_queries, "ensure_user_is_set"
            ) as ensure_user_is_set:
                load_explore_json_into_cache(job_metadata, form_data)
            ensure_user_is_set.assert_called_once_with(user.id)

        mock_set_form_data.assert_called_once_with(form_data)
        errors = ["The dataset associated with this chart no longer exists"]
        mock_update_job.assert_called_once_with(job_metadata, "error", errors=errors)

    @mock.patch.object(ChartDataCommand, "run")
    @mock.patch.object(async_query_manager, "update_job")
    def test_soft_timeout_load_explore_json_into_cache(
        self, mock_update_job, mock_run_command
    ):
        async_query_manager.init_app(app)
        user = security_manager.find_user("gamma")
        form_data = {}
        job_metadata = {
            "channel_id": str(uuid4()),
            "job_id": str(uuid4()),
            "user_id": user.id,
            "status": "pending",
            "errors": [],
        }
        errors = ["A timeout occurred while loading explore json, error"]

        with pytest.raises(SoftTimeLimitExceeded):
            with mock.patch.object(
                async_queries, "ensure_user_is_set",
            ) as ensure_user_is_set:
                ensure_user_is_set.side_effect = SoftTimeLimitExceeded()
                load_explore_json_into_cache(job_metadata, form_data)
            ensure_user_is_set.assert_called_once_with(user.id, "error", errors=errors)

    def test_ensure_user_is_set(self):
        g_user_is_set = hasattr(g, "user")
        original_g_user = g.user if g_user_is_set else None

        if g_user_is_set:
            del g.user

        self.assertFalse(hasattr(g, "user"))
        ensure_user_is_set(1)
        self.assertTrue(hasattr(g, "user"))
        self.assertFalse(g.user.is_anonymous)
        self.assertEqual("1", g.user.get_id())

        del g.user

        self.assertFalse(hasattr(g, "user"))
        ensure_user_is_set(None)
        self.assertTrue(hasattr(g, "user"))
        self.assertTrue(g.user.is_anonymous)
        self.assertEqual(None, g.user.get_id())

        del g.user

        g.user = security_manager.get_user_by_id(2)
        self.assertEqual("2", g.user.get_id())

        ensure_user_is_set(1)
        self.assertTrue(hasattr(g, "user"))
        self.assertFalse(g.user.is_anonymous)
        self.assertEqual("2", g.user.get_id())

        ensure_user_is_set(None)
        self.assertTrue(hasattr(g, "user"))
        self.assertFalse(g.user.is_anonymous)
        self.assertEqual("2", g.user.get_id())

        if g_user_is_set:
            g.user = original_g_user
        else:
            del g.user
