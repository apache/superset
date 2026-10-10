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
"""Tests for superset.views.datasource.utils module."""

from unittest.mock import MagicMock, patch

import pytest
from flask import current_app

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.views.datasource.utils import get_limit_clause


@patch("superset.views.datasource.utils.get_limit_clause")
def test_get_samples_raises_security_exception_when_access_denied(
    mock_get_limit_clause: MagicMock,
):
    """
    Test that get_samples() enforces access control by calling raise_for_access().
    This verifies the fix for issue #31944 where users with "can samples on Datasource"
    permission could read samples from datasets they don't have access to.
    """
    mock_get_limit_clause.return_value = {"row_offset": 0, "row_limit": 100}

    mock_datasource = MagicMock()
    mock_datasource.type = "table"
    mock_datasource.id = 1
    mock_datasource.columns = []

    mock_samples_context = MagicMock()
    mock_count_context = MagicMock()

    # Simulate security exception when raise_for_access is called
    mock_samples_context.raise_for_access.side_effect = SupersetSecurityException(
        SupersetError(
            message="Access denied",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.WARNING,
        )
    )

    with (
        patch(
            "superset.views.datasource.utils.DatasourceDAO.get_datasource",
            return_value=mock_datasource,
        ),
        patch(
            "superset.views.datasource.utils.QueryContextFactory"
        ) as mock_factory_class,
    ):
        mock_factory = MagicMock()
        mock_factory_class.return_value = mock_factory

        # Return different mock contexts for samples vs count queries
        mock_factory.create.side_effect = [mock_samples_context, mock_count_context]

        from superset.views.datasource.utils import get_samples

        with pytest.raises(SupersetSecurityException) as exc_info:
            get_samples(
                datasource_type="table",
                datasource_id=1,
                force=False,
                page=1,
                per_page=100,
            )

        assert exc_info.value.error.error_type == (
            SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR
        )
        # Verify raise_for_access was called on the samples context
        mock_samples_context.raise_for_access.assert_called_once()


@patch("superset.views.datasource.utils.get_limit_clause")
def test_get_samples_calls_raise_for_access_on_both_contexts(
    mock_get_limit_clause: MagicMock,
):
    """
    Test that get_samples() calls raise_for_access() on both the samples
    and count_star query contexts before fetching data.
    """
    mock_get_limit_clause.return_value = {"row_offset": 0, "row_limit": 100}

    mock_datasource = MagicMock()
    mock_datasource.type = "table"
    mock_datasource.id = 1
    mock_datasource.columns = []

    mock_samples_context = MagicMock()
    mock_count_context = MagicMock()

    # Set up successful access check
    mock_samples_context.raise_for_access.return_value = None
    mock_count_context.raise_for_access.return_value = None

    # Set up successful payload responses
    mock_count_context.get_payload.return_value = {
        "queries": [{"data": [{"COUNT(*)": 100}], "status": "success"}]
    }
    mock_samples_context.get_payload.return_value = {
        "queries": [
            {
                "data": [{"col1": "val1"}],
                "status": "success",
                "cache_key": "test_key",
            }
        ]
    }

    with (
        patch(
            "superset.views.datasource.utils.DatasourceDAO.get_datasource",
            return_value=mock_datasource,
        ),
        patch(
            "superset.views.datasource.utils.QueryContextFactory"
        ) as mock_factory_class,
    ):
        mock_factory = MagicMock()
        mock_factory_class.return_value = mock_factory

        # Return different mock contexts for samples vs count queries
        mock_factory.create.side_effect = [mock_samples_context, mock_count_context]

        from superset.views.datasource.utils import get_samples

        result = get_samples(
            datasource_type="table",
            datasource_id=1,
            force=False,
            page=1,
            per_page=100,
        )

        # Verify both contexts had raise_for_access called
        mock_samples_context.raise_for_access.assert_called_once()
        mock_count_context.raise_for_access.assert_called_once()

        # Verify the result contains expected data
        assert result["data"] == [{"col1": "val1"}]
        assert result["total_count"] == 100


@patch("superset.views.datasource.utils.get_limit_clause")
def test_get_samples_count_star_access_denied(mock_get_limit_clause: MagicMock):
    """
    Test that get_samples() raises security exception when access to count_star
    query context is denied.
    """
    mock_get_limit_clause.return_value = {"row_offset": 0, "row_limit": 100}

    mock_datasource = MagicMock()
    mock_datasource.type = "table"
    mock_datasource.id = 1
    mock_datasource.columns = []

    mock_samples_context = MagicMock()
    mock_count_context = MagicMock()

    # Samples context allows access
    mock_samples_context.raise_for_access.return_value = None

    # Count context denies access
    mock_count_context.raise_for_access.side_effect = SupersetSecurityException(
        SupersetError(
            message="Access denied to count query",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.WARNING,
        )
    )

    with (
        patch(
            "superset.views.datasource.utils.DatasourceDAO.get_datasource",
            return_value=mock_datasource,
        ),
        patch(
            "superset.views.datasource.utils.QueryContextFactory"
        ) as mock_factory_class,
    ):
        mock_factory = MagicMock()
        mock_factory_class.return_value = mock_factory

        mock_factory.create.side_effect = [mock_samples_context, mock_count_context]

        from superset.views.datasource.utils import get_samples

        with pytest.raises(SupersetSecurityException) as exc_info:
            get_samples(
                datasource_type="table",
                datasource_id=1,
                force=False,
                page=1,
                per_page=100,
            )

        assert exc_info.value.error.error_type == (
            SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR
        )
        # Verify samples context was checked first
        mock_samples_context.raise_for_access.assert_called_once()
        # Verify count context was also checked
        mock_count_context.raise_for_access.assert_called_once()


@pytest.mark.parametrize("per_page", [5000, 10000])
def test_get_limit_clause_honors_per_page_above_samples_row_limit(
    per_page: int,
) -> None:
    """Regression guard: the Explore Data panel "Samples" tab silently caps at
    ``SAMPLES_ROW_LIMIT`` (config default 1000).

    The samples row-limit dropdown offers 5k/10k options and the samples
    endpoint's ``SamplesRequestSchema`` accepts ``per_page`` up to 10000, yet
    ``get_limit_clause`` resets any ``per_page`` above ``SAMPLES_ROW_LIMIT``
    back down to it. A user who selects 5k/10k therefore silently receives at
    most 1000 rows, with no signal that the requested limit was overridden.

    The rows a user is allowed to request and the rows actually returned must
    stay consistent: a ``per_page`` the endpoint accepts must not be silently
    reduced below the request.
    """
    assert get_limit_clause(page=1, per_page=per_page) == {
        "row_offset": 0,
        "row_limit": per_page,
    }


@pytest.mark.parametrize(
    "per_page,expected_row_limit",
    [
        (0, 0),
        (-1, 1000),
    ],
)
def test_get_limit_clause_preserves_zero_and_negative_per_page(
    per_page: int,
    expected_row_limit: int,
) -> None:
    assert get_limit_clause(page=1, per_page=per_page) == {
        "row_offset": 0,
        "row_limit": expected_row_limit,
    }


def test_get_limit_clause_caps_per_page_at_sql_max_row(
    app_context: None,
) -> None:
    """When an operator configures ``SQL_MAX_ROW`` below the schema's
    ``per_page`` maximum, ``apply_max_row_limit`` still reduces the
    requested limit, and the offset for subsequent pages must be computed
    from that reduced (effective) limit, not the raw request.
    """
    with patch.dict(current_app.config, {"SQL_MAX_ROW": 2000}):
        assert get_limit_clause(page=1, per_page=10000) == {
            "row_offset": 0,
            "row_limit": 2000,
        }
        assert get_limit_clause(page=2, per_page=10000) == {
            "row_offset": 2000,
            "row_limit": 2000,
        }
