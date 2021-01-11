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
import re
from unittest import mock
from uuid import uuid4

import pytest

from superset import db
from superset.charts.commands.data import ChartDataCommand
from superset.charts.commands.exceptions import ChartDataQueryFailedError
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import SupersetException
from superset.extensions import async_query_manager
from superset.tasks.async_queries import (
    load_chart_data_into_cache,
    load_explore_json_into_cache,
)
from tests.base_tests import SupersetTestCase
from tests.fixtures.query_context import get_query_context
from tests.test_app import app


def get_table_by_name(name: str) -> SqlaTable:
    with app.app_context():
        return db.session.query(SqlaTable).filter_by(table_name=name).one()


class TestAsyncQueries(SupersetTestCase):
    @mock.patch.object(async_query_manager, "update_job")
    def test_load_chart_data_into_cache(self, mock_update_job):
        async_query_manager.init_app(app)
        query_context = get_query_context("birth_names")
        job_metadata = {
            "channel_id": str(uuid4()),
            "job_id": str(uuid4()),
            "user_id": 1,
            "status": "pending",
            "errors": [],
        }

        load_chart_data_into_cache(job_metadata, query_context)

        mock_update_job.assert_called_with(job_metadata, "done", result_url=mock.ANY)

    @mock.patch.object(
        ChartDataCommand, "run", side_effect=ChartDataQueryFailedError("Error: foo")
    )
    @mock.patch.object(async_query_manager, "update_job")
    def test_load_chart_data_into_cache_error(self, mock_update_job, mock_run_command):
        async_query_manager.init_app(app)
        query_context = get_query_context("birth_names")
        job_metadata = {
            "channel_id": str(uuid4()),
            "job_id": str(uuid4()),
            "user_id": 1,
            "status": "pending",
            "errors": [],
        }
        with pytest.raises(ChartDataQueryFailedError):
            load_chart_data_into_cache(job_metadata, query_context)

        mock_run_command.assert_called_with(cache=True)
        errors = [{"message": "Error: foo"}]
        mock_update_job.assert_called_with(job_metadata, "error", errors=errors)

    @mock.patch.object(async_query_manager, "update_job")
    def test_load_explore_json_into_cache(self, mock_update_job):
        async_query_manager.init_app(app)
        table = get_table_by_name("birth_names")
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
            "user_id": 1,
            "status": "pending",
            "errors": [],
        }

        load_explore_json_into_cache(job_metadata, form_data)

        mock_update_job.assert_called_with(job_metadata, "done", result_url=mock.ANY)

    @mock.patch.object(async_query_manager, "update_job")
    def test_load_explore_json_into_cache_error(self, mock_update_job):
        async_query_manager.init_app(app)
        form_data = {}
        job_metadata = {
            "channel_id": str(uuid4()),
            "job_id": str(uuid4()),
            "user_id": 1,
            "status": "pending",
            "errors": [],
        }

        with pytest.raises(SupersetException):
            load_explore_json_into_cache(job_metadata, form_data)

        errors = ["The datasource associated with this chart no longer exists"]
        mock_update_job.assert_called_with(job_metadata, "error", errors=errors)
