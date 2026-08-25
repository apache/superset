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
"""Unit tests for CreateChartCommand.

Regression coverage for apache/superset#29697: POST /api/v1/chart/ with
datasource_type="saved_query" (or "query") crashes with an unhandled
AttributeError -- reported to API clients as an opaque 500 "Fatal error" --
because SavedQuery and Query models have no ``.name`` attribute, and because
Slice.datasource only ever resolves a ``table``-typed datasource, so even a
successfully created chart of another type could never actually render.
"""

import pytest
from pytest_mock import MockerFixture

from superset.commands.chart.create import CreateChartCommand
from superset.commands.chart.exceptions import ChartForbiddenError, ChartInvalidError
from superset.commands.exceptions import DatasourceTypeInvalidError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException


def _base_mocks(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.commands.chart.create.DashboardDAO.find_by_ids", return_value=[]
    )
    mocker.patch(
        "superset.commands.chart.create.populate_subjects",
        side_effect=lambda properties, exceptions: None,
    )


@pytest.mark.parametrize("datasource_type", ["saved_query", "query"])
def test_create_chart_rejects_non_table_datasource_type(
    mocker: MockerFixture, datasource_type: str
) -> None:
    """A chart can only ever query a table-backed datasource -- Slice.datasource
    only ever resolves the ``table`` relationship, so any other type would
    produce a chart that "creates" successfully but can never render.

    The two types fail differently before this fix, which is exactly why
    both are covered here:
    - "saved_query": SavedQuery has no ``.name`` attribute, so validation
      crashes with an unhandled AttributeError -- surfaced to API clients as
      an opaque 500 "Fatal error" (apache/superset#29697).
    - "query": Query *does* define a synthetic ``.name`` property (used for
      CTAS table naming, not as a real display name), so this one doesn't
      crash -- it silently "succeeds" and creates a chart with a nonsense
      name and a datasource that Slice.datasource can never resolve.

    ``get_datasource_by_id`` is mocked with ``spec=`` the real model classes
    so accessing ``.name`` on the mock behaves exactly like the real ORM
    objects do if the new guard doesn't stop the code from getting there;
    ``raise_for_access`` is mocked to a no-op so nothing downstream masks
    that behavior.
    """
    from superset.models.sql_lab import Query, SavedQuery

    _base_mocks(mocker)
    model_cls = SavedQuery if datasource_type == "saved_query" else Query
    get_datasource_by_id = mocker.patch(
        "superset.commands.chart.create.get_datasource_by_id",
        return_value=mocker.MagicMock(spec=model_cls),
    )
    mocker.patch("superset.commands.chart.create.security_manager.raise_for_access")

    with pytest.raises(ChartInvalidError) as exc_info:
        CreateChartCommand(
            {
                "datasource_id": 11,
                "datasource_type": datasource_type,
                "slice_name": "some_name",
                "viz_type": "table",
            }
        ).validate()

    assert any(
        isinstance(ex, DatasourceTypeInvalidError) for ex in exc_info.value._exceptions
    )
    # The invalid type must be rejected before ever touching the datasource
    # lookup, not caught incidentally by some downstream failure.
    get_datasource_by_id.assert_not_called()


def test_create_chart_accepts_table_datasource(mocker: MockerFixture) -> None:
    """The one supported datasource_type must keep working."""
    _base_mocks(mocker)
    datasource = mocker.MagicMock(name="table_datasource")
    datasource.name = "my_table"
    mocker.patch(
        "superset.commands.chart.create.get_datasource_by_id",
        return_value=datasource,
    )
    mocker.patch("superset.commands.chart.create.security_manager.raise_for_access")

    cmd = CreateChartCommand(
        {
            "datasource_id": 11,
            "datasource_type": "table",
            "slice_name": "some_name",
            "viz_type": "table",
        }
    )
    cmd.validate()

    assert cmd._properties["datasource_name"] == "my_table"


def test_create_chart_datasource_access_denied_still_raises_forbidden(
    mocker: MockerFixture,
) -> None:
    """The invalid-type guard must not shadow the existing access-denied path
    for a legitimately table-typed datasource the user can't access."""
    _base_mocks(mocker)
    datasource = mocker.MagicMock()
    datasource.name = "my_table"
    mocker.patch(
        "superset.commands.chart.create.get_datasource_by_id",
        return_value=datasource,
    )
    mocker.patch(
        "superset.commands.chart.create.security_manager.raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                message="No access",
                level=ErrorLevel.ERROR,
            )
        ),
    )

    with pytest.raises(ChartForbiddenError):
        CreateChartCommand(
            {
                "datasource_id": 11,
                "datasource_type": "table",
                "slice_name": "some_name",
                "viz_type": "table",
            }
        ).validate()
