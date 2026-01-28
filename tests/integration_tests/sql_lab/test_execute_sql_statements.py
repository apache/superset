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
from unittest.mock import MagicMock, patch

from flask import current_app

from superset import db
from superset.common.db_query_status import QueryStatus
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql_lab import execute_sql_statements
from superset.utils.dates import now_as_float


def test_non_async_execute(non_async_example_db: Database, example_query: Query):
    """Test query.tracking_url is attached for Presto and Hive queries"""
    result = execute_sql_statements(
        example_query.id,
        "select 1 as foo;",
        store_results=False,
        return_results=True,
        start_time=now_as_float(),
        expand_data=True,
        log_params=dict(),  # noqa: C408
    )
    assert result
    assert result["query_id"] == example_query.id
    assert result["status"] == QueryStatus.SUCCESS
    assert result["data"] == [{"foo": 1}]

    # should attach apply tracking URL for Presto & Hive
    if non_async_example_db.db_engine_spec.engine == "presto":
        assert example_query.tracking_url
        assert "/ui/query.html?" in example_query.tracking_url

        current_app.config["TRACKING_URL_TRANSFORMER"] = lambda url, query: url.replace(
            "/ui/query.html?", f"/{query.client_id}/"
        )
        assert f"/{example_query.client_id}/" in example_query.tracking_url

        current_app.config["TRACKING_URL_TRANSFORMER"] = lambda url: url + "&foo=bar"
        assert example_query.tracking_url.endswith("&foo=bar")

    if non_async_example_db.db_engine_spec.engine_name == "hive":
        assert example_query.tracking_url_raw


@patch("superset.sql_lab.results_backend")
def test_results_backend_write_failure(
    mock_results_backend: MagicMock,
    async_example_db: Database,
    example_query: Query,
):
    """Test async query marked FAILED when results_backend.set() False"""
    import pytest

    from superset.exceptions import SupersetErrorException

    # Mock results backend to simulate write failure
    mock_results_backend.set.return_value = False

    # Execute query with store_results=True, return_results=False (async mode)
    # Should raise exception because results can't be stored
    with pytest.raises(SupersetErrorException) as exc_info:
        execute_sql_statements(
            example_query.id,
            "select 1 as foo;",
            store_results=True,
            return_results=False,
            start_time=now_as_float(),
            expand_data=False,
            log_params=dict(),  # noqa: C408
        )

    # Verify exception message
    assert "Failed to store query results" in str(exc_info.value.error.message)

    # Refresh query from database to get updated state
    db.session.refresh(example_query)

    # Assert query status is FAILED (results inaccessible for async queries)
    assert example_query.status == QueryStatus.FAILED

    # Assert results_key is None (because backend write failed)
    assert example_query.results_key is None

    # Assert error message is set
    assert "Failed to store query results" in example_query.error_message

    # Assert backend.set() was called
    assert mock_results_backend.set.called


@patch("superset.sql_lab.results_backend")
def test_results_backend_write_success(
    mock_results_backend: MagicMock,
    async_example_db: Database,
    example_query: Query,
):
    """Test that query.results_key is set when results_backend.set() True"""
    # Mock results backend to simulate successful write
    mock_results_backend.set.return_value = True

    # Execute query with store_results=True (async mode)
    execute_sql_statements(
        example_query.id,
        "select 1 as foo;",
        store_results=True,
        return_results=False,
        start_time=now_as_float(),
        expand_data=False,
        log_params=dict(),  # noqa: C408
    )

    # Refresh query from database to get updated state
    db.session.refresh(example_query)

    # Assert query status is SUCCESS
    assert example_query.status == QueryStatus.SUCCESS

    # Assert results_key is set (UUID format)
    assert example_query.results_key is not None
    assert len(example_query.results_key) == 36  # UUID length with dashes

    # Assert backend.set() was called
    assert mock_results_backend.set.called


@patch("superset.sql_lab.results_backend")
def test_results_backend_write_failure_sync_mode(
    mock_results_backend: MagicMock,
    non_async_example_db: Database,
    example_query: Query,
):
    """Test sync query SUCCESS when cache write fails (results inline)"""
    # Mock results backend to simulate write failure
    mock_results_backend.set.return_value = False

    # Execute query with return_results=True (sync mode - results returned inline)
    result = execute_sql_statements(
        example_query.id,
        "select 1 as foo;",
        store_results=True,
        return_results=True,
        start_time=now_as_float(),
        expand_data=True,
        log_params=dict(),  # noqa: C408
    )

    # Should return results inline even when cache write fails
    assert result
    assert result["query_id"] == example_query.id
    assert result["status"] == QueryStatus.SUCCESS
    assert result["data"] == [{"foo": 1}]

    # Refresh query from database to get updated state
    db.session.refresh(example_query)

    # Assert query status is SUCCESS (results were returned inline)
    assert example_query.status == QueryStatus.SUCCESS

    # Assert results_key is None (because backend write failed)
    assert example_query.results_key is None

    # Assert backend.set() was called
    assert mock_results_backend.set.called
