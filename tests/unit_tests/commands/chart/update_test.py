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
import pytest
from pytest_mock import MockerFixture

from superset.commands.chart.exceptions import ChartForbiddenError, ChartInvalidError
from superset.commands.chart.update import UpdateChartCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.utils import json


def _editorship_exc() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
            message="User is not an editor of this chart",
            level=ErrorLevel.ERROR,
        )
    )


def _access_exc() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.CHART_SECURITY_ACCESS_ERROR,
            message="User does not have access to this chart",
            level=ErrorLevel.ERROR,
        )
    )


def test_update_chart_editorship_enforced_for_regular_update(
    mocker: MockerFixture,
) -> None:
    """Non-editors must not be able to update a chart via a regular payload."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(id=1, tags=[], dashboards=[])
    raise_for_editorship = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
        side_effect=_editorship_exc(),
    )

    with pytest.raises(ChartForbiddenError):
        UpdateChartCommand(1, {"slice_name": "My Chart"}).validate()

    find_by_id.assert_called_once_with(1)
    raise_for_editorship.assert_called_once()


def test_update_chart_query_context_skips_editorship_check(
    mocker: MockerFixture,
) -> None:
    """Query-context-only updates skip editorship but still require chart access."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(id=1, tags=[], dashboards=[])
    raise_for_editorship = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
        side_effect=_editorship_exc(),
    )
    raise_for_access = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_access",
    )

    UpdateChartCommand(
        1, {"query_context": "{}", "query_context_generation": True}
    ).validate()

    find_by_id.assert_called_once_with(1)
    raise_for_editorship.assert_not_called()
    raise_for_access.assert_called_once_with(chart=find_by_id.return_value)


def test_update_chart_query_context_requires_chart_access(
    mocker: MockerFixture,
) -> None:
    """A query-context-only update by someone without access to the chart is
    rejected, even though the editorship check is relaxed for this path."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(id=1, tags=[], dashboards=[])
    mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_access",
        side_effect=_access_exc(),
    )

    with pytest.raises(ChartForbiddenError):
        UpdateChartCommand(
            1, {"query_context": "{}", "query_context_generation": True}
        ).validate()


def test_update_chart_query_context_non_editor_with_access_allowed(
    mocker: MockerFixture,
) -> None:
    """A non-editor who has access to the chart (e.g. an alpha user with
    datasource access, or a report worker) can perform a query-context-only
    backfill: editorship is relaxed and ``raise_for_access`` does not deny."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(id=1, tags=[], dashboards=[])
    raise_for_editorship = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
        side_effect=_editorship_exc(),
    )
    # access check passes (no exception) -> the non-editor is permitted
    raise_for_access = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_access",
    )

    UpdateChartCommand(
        1, {"query_context": "{}", "query_context_generation": True}
    ).validate()

    raise_for_editorship.assert_not_called()
    raise_for_access.assert_called_once_with(chart=find_by_id.return_value)


def test_update_chart_editor_can_perform_regular_update(
    mocker: MockerFixture,
) -> None:
    """Chart editors can perform regular updates and pass editor changes."""
    editor = mocker.MagicMock(id=1)
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    chart = mocker.MagicMock(id=1, tags=[], dashboards=[], editors=[editor])
    find_by_id.return_value = chart
    raise_for_editorship = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship"
    )
    compute_subjects = mocker.patch("superset.commands.chart.update.compute_subjects")

    UpdateChartCommand(1, {"slice_name": "Renamed Chart", "editors": [2]}).validate()

    find_by_id.assert_called_once_with(1)
    raise_for_editorship.assert_called_once()
    compute_subjects.assert_called_once()
    properties = compute_subjects.call_args.args[1]
    exceptions = compute_subjects.call_args.args[2]
    assert properties["editors"] == [2]
    assert exceptions == []


def _query_context_payload(datasource: object) -> dict[str, object]:
    """Build a query-context-only update payload targeting ``datasource``."""
    return {
        "query_context": json.dumps({"datasource": datasource, "queries": []}),
        "query_context_generation": True,
    }


@pytest.mark.parametrize(
    "datasource_type",
    [
        "table",
        "query",  # non-table datasource types must also be accepted when matching
    ],
)
def test_update_chart_query_context_matching_datasource_is_allowed(
    mocker: MockerFixture,
    datasource_type: str,
) -> None:
    """A query context that targets the chart's own datasource is accepted."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(
        id=1,
        tags=[],
        dashboards=[],
        datasource_id=42,
        datasource_type=datasource_type,
    )
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_editorship")
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_access")

    UpdateChartCommand(
        1, _query_context_payload({"id": 42, "type": datasource_type})
    ).validate()


@pytest.mark.parametrize(
    "datasource",
    [
        {"id": 99, "type": "table"},  # different id
        {"id": 42, "type": "query"},  # different type
        {"id": "99", "type": "table"},  # different id as string
        {"id": 42},  # matching id but missing type
        {"id": "5f7b3c1a-...-uuid", "type": "table"},  # non-numeric id
    ],
)
def test_update_chart_query_context_mismatched_datasource_is_rejected(
    mocker: MockerFixture,
    datasource: dict[str, object],
) -> None:
    """A query context pointing at a different datasource is rejected with a 4xx."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(
        id=1, tags=[], dashboards=[], datasource_id=42, datasource_type="table"
    )
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_editorship")
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_access")

    with pytest.raises(ChartInvalidError):
        UpdateChartCommand(1, _query_context_payload(datasource)).validate()


@pytest.mark.parametrize(
    "query_context",
    [
        "{}",  # no datasource key
        '{"datasource": null}',  # null datasource
        "not-json",  # unparseable payload
    ],
)
def test_update_chart_query_context_without_datasource_is_allowed(
    mocker: MockerFixture,
    query_context: str,
) -> None:
    """Payloads with no verifiable datasource fall back to the chart's own."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(
        id=1, tags=[], dashboards=[], datasource_id=42, datasource_type="table"
    )
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_editorship")
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_access")

    UpdateChartCommand(
        1,
        {"query_context": query_context, "query_context_generation": True},
    ).validate()
