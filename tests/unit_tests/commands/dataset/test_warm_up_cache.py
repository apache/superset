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
"""Unit tests for DatasetWarmUpCacheCommand access control."""

from unittest.mock import MagicMock, patch

import pytest

from superset.commands.dataset.exceptions import (
    DatasetAccessDeniedError,
    WarmUpCacheTableNotFoundError,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException


def _security_exception() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            message="Access denied to table",
            level=ErrorLevel.ERROR,
        )
    )


def _mock_table() -> MagicMock:
    table = MagicMock()
    table.id = 1
    table.type = "table"
    return table


def test_warm_up_cache_raises_not_found_when_table_missing() -> None:
    """validate() must raise WarmUpCacheTableNotFoundError when the table
    does not exist in the given database."""
    from superset.commands.dataset.warm_up_cache import DatasetWarmUpCacheCommand

    with patch("superset.commands.dataset.warm_up_cache.db") as mock_db:
        q = mock_db.session.query.return_value
        q.join.return_value.filter.return_value.one_or_none.return_value = None

        command = DatasetWarmUpCacheCommand(
            db_name="mydb",
            table_name="nonexistent",
            dashboard_id=None,
            extra_filters=None,
        )
        with pytest.raises(WarmUpCacheTableNotFoundError):
            command.validate()


def test_warm_up_cache_raises_access_denied_when_no_permission() -> None:
    """validate() must raise DatasetAccessDeniedError when the caller lacks
    access to the dataset."""
    from superset.commands.dataset.warm_up_cache import DatasetWarmUpCacheCommand

    mock_table = _mock_table()

    with patch("superset.commands.dataset.warm_up_cache.db") as mock_db:
        q = mock_db.session.query.return_value
        q.join.return_value.filter.return_value.one_or_none.return_value = mock_table

        with patch(
            "superset.commands.dataset.warm_up_cache.security_manager.raise_for_access",
            side_effect=_security_exception(),
        ):
            command = DatasetWarmUpCacheCommand(
                db_name="mydb",
                table_name="secret_table",
                dashboard_id=None,
                extra_filters=None,
            )
            with pytest.raises(DatasetAccessDeniedError):
                command.validate()


def test_warm_up_cache_populates_charts_when_access_granted() -> None:
    """validate() must populate _charts when the caller has access."""
    from superset.commands.dataset.warm_up_cache import DatasetWarmUpCacheCommand

    mock_table = _mock_table()
    mock_charts = [MagicMock(), MagicMock()]

    with patch("superset.commands.dataset.warm_up_cache.db") as mock_db:
        # First query() call returns table; second returns chart list
        q = mock_db.session.query.return_value
        q.join.return_value.filter.return_value.one_or_none.return_value = mock_table
        q.filter_by.return_value.all.return_value = mock_charts

        with patch(
            "superset.commands.dataset.warm_up_cache.security_manager.raise_for_access"
        ):
            command = DatasetWarmUpCacheCommand(
                db_name="mydb",
                table_name="allowed_table",
                dashboard_id=None,
                extra_filters=None,
            )
            command.validate()
            assert command._charts == mock_charts
