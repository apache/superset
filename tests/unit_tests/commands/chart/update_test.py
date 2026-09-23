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
from typing import Any
from unittest.mock import MagicMock, Mock

import pytest
from flask import g
from pytest_mock import MockerFixture

from superset.commands.chart.exceptions import (
    ChartForbiddenError,
    ChartInvalidError,
    DatasourceTypeUpdateRequiredValidationError,
)
from superset.commands.chart.update import UpdateChartCommand
from superset.commands.exceptions import (
    DatasourceNotFoundValidationError,
    DatasourceTypeInvalidError,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.utils import json


@pytest.mark.parametrize("datasource_type", ["table", "semantic_view"])
@pytest.mark.parametrize(
    "outcome", ["allowed", "denied", "missing", "no_id", "null_id"]
)
def test_type_only_update_checks_retained_datasource(
    mocker: MockerFixture, datasource_type: str, outcome: str
) -> None:
    """Changing only type must authorize the new kind at the stored ID."""
    chart: Mock = Mock(
        id=1,
        datasource_id=None if outcome == "no_id" else 42,
        datasource_type="table",
        is_managed_externally=False,
        tags=[],
        dashboards=[],
    )
    mocker.patch(
        "superset.commands.chart.update.ChartDAO.find_by_id", return_value=chart
    )
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_editorship")
    mocker.patch("superset.commands.chart.update.compute_subjects")
    datasource: Mock = Mock()
    datasource.name = "semantic name"
    lookup: Mock = mocker.patch(
        "superset.commands.chart.update.get_datasource_by_id",
        return_value=datasource,
        side_effect=DatasourceNotFoundValidationError()
        if outcome == "missing"
        else None,
    )
    access: Mock = mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_access",
        side_effect=_access_exc() if outcome == "denied" else None,
    )
    command: UpdateChartCommand = UpdateChartCommand(
        1,
        {
            "datasource_type": datasource_type,
            **({"datasource_id": None} if outcome == "null_id" else {}),
        },
    )
    if outcome in {"missing", "no_id", "null_id"}:
        error: pytest.ExceptionInfo[ChartInvalidError]
        with pytest.raises(ChartInvalidError) as error:
            command.validate()
        assert any(
            isinstance(exception, DatasourceNotFoundValidationError)
            for exception in error.value._exceptions
        )
        access.assert_not_called()
    elif outcome == "denied":
        with pytest.raises(ChartForbiddenError):
            command.validate()
    else:
        command.validate()
        assert command._properties["datasource_name"] == "semantic name"
    if outcome in {"no_id", "null_id"}:
        lookup.assert_not_called()
    else:
        lookup.assert_called_once_with(42, datasource_type)
    if outcome in {"allowed", "denied"}:
        access.assert_called_once_with(datasource=datasource)


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
    find_by_id.return_value = mocker.MagicMock(
        is_managed_externally=False, id=1, tags=[], dashboards=[]
    )
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
    find_by_id.return_value = mocker.MagicMock(
        is_managed_externally=False, id=1, tags=[], dashboards=[]
    )
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
    find_by_id.return_value = mocker.MagicMock(
        is_managed_externally=False, id=1, tags=[], dashboards=[]
    )
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
    find_by_id.return_value = mocker.MagicMock(
        is_managed_externally=False, id=1, tags=[], dashboards=[]
    )
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
    chart = mocker.MagicMock(
        is_managed_externally=False, id=1, tags=[], dashboards=[], editors=[editor]
    )
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
        "semantic_view",
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
        is_managed_externally=False,
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
        is_managed_externally=False,
        id=1,
        tags=[],
        dashboards=[],
        datasource_id=42,
        datasource_type="table",
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
        is_managed_externally=False,
        id=1,
        tags=[],
        dashboards=[],
        datasource_id=42,
        datasource_type="table",
    )
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_editorship")
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_access")

    UpdateChartCommand(
        1,
        {"query_context": query_context, "query_context_generation": True},
    ).validate()


@pytest.mark.parametrize("datasource_type", ["saved_query", "query"])
def test_update_chart_rejects_repointing_to_non_table_datasource(
    mocker: MockerFixture, datasource_type: str
) -> None:
    """Repointing a chart's datasource_id must be rejected the same way
    CreateChartCommand rejects it (apache/superset#29697): Slice.datasource
    only ever resolves the ``table`` relationship, so repointing at a
    saved_query or query datasource would "succeed" but leave the chart
    permanently unable to render -- or, for saved_query specifically, crash
    on SavedQuery's missing ``.name`` attribute before that point is even
    reached. This is a regular (non-query-context) update, so it goes
    through editorship + compute_subjects, unlike the query-context-only
    tests above."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(
        is_managed_externally=False, id=1, tags=[], dashboards=[]
    )
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_editorship")
    mocker.patch(
        "superset.commands.chart.update.compute_subjects",
        side_effect=lambda model, properties, exceptions: None,
    )
    get_datasource_by_id = mocker.patch(
        "superset.commands.chart.update.get_datasource_by_id"
    )

    with pytest.raises(ChartInvalidError) as exc_info:
        UpdateChartCommand(
            1, {"datasource_id": 11, "datasource_type": datasource_type}
        ).validate()

    assert any(
        isinstance(ex, DatasourceTypeInvalidError) for ex in exc_info.value._exceptions
    )
    get_datasource_by_id.assert_not_called()


def test_update_chart_missing_datasource_type_keeps_required_error(
    mocker: MockerFixture,
) -> None:
    """When datasource_id is given without datasource_type, the response
    must keep reporting DatasourceTypeUpdateRequiredValidationError
    ("Datasource type is required") rather than having it overwritten by
    DatasourceTypeInvalidError ("Datasource type is invalid") -- both
    exceptions key their message under ``datasource_type``, and
    normalized_messages() only keeps the last one written for a given key."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(
        is_managed_externally=False, id=1, tags=[], dashboards=[]
    )
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_editorship")
    mocker.patch(
        "superset.commands.chart.update.compute_subjects",
        side_effect=lambda model, properties, exceptions: None,
    )
    get_datasource_by_id = mocker.patch(
        "superset.commands.chart.update.get_datasource_by_id"
    )

    with pytest.raises(ChartInvalidError) as exc_info:
        UpdateChartCommand(1, {"datasource_id": 11}).validate()

    assert any(
        isinstance(ex, DatasourceTypeUpdateRequiredValidationError)
        for ex in exc_info.value._exceptions
    )
    assert not any(
        isinstance(ex, DatasourceTypeInvalidError) for ex in exc_info.value._exceptions
    )
    get_datasource_by_id.assert_not_called()


@pytest.mark.parametrize("datasource_type", ["saved_query", "query"])
def test_update_chart_rejects_type_only_non_table_datasource(
    mocker: MockerFixture, datasource_type: str
) -> None:
    """A type-only update (datasource_type given without datasource_id)
    must be rejected the same way a repointing update is: leaving
    datasource_id untouched while flipping datasource_type away from
    ``table`` would still break Slice.datasource, since its relationship
    only ever resolves the ``table`` type."""
    find_by_id = mocker.patch("superset.commands.chart.update.ChartDAO.find_by_id")
    find_by_id.return_value = mocker.MagicMock(
        is_managed_externally=False, id=1, tags=[], dashboards=[]
    )
    mocker.patch("superset.commands.chart.update.security_manager.raise_for_editorship")
    mocker.patch(
        "superset.commands.chart.update.compute_subjects",
        side_effect=lambda model, properties, exceptions: None,
    )
    get_datasource_by_id = mocker.patch(
        "superset.commands.chart.update.get_datasource_by_id"
    )

    with pytest.raises(ChartInvalidError) as exc_info:
        UpdateChartCommand(1, {"datasource_type": datasource_type}).validate()

    assert any(
        isinstance(ex, DatasourceTypeInvalidError) for ex in exc_info.value._exceptions
    )
    get_datasource_by_id.assert_not_called()


def test_update_chart_touches_newly_linked_dashboards(
    mocker: MockerFixture,
) -> None:
    """Issue #44305: Adding new dashboards to a chart touches audit metadata."""
    existing_dashboard = MagicMock(id=1, changed_on=None, changed_by=None)
    new_dashboard = MagicMock(
        id=2, is_managed_externally=False, changed_on=None, changed_by=None
    )

    chart = MagicMock(
        is_managed_externally=False,
        id=10,
        tags=[],
        dashboards=[existing_dashboard],
        datasource_id=42,
        datasource_type="table",
    )
    mocker.patch(
        "superset.commands.chart.update.ChartDAO.find_by_id",
        return_value=chart,
    )

    def _find_dashboards_by_ids(ids: list[int], **kwargs: Any) -> list[Any]:
        lookup = {1: existing_dashboard, 2: new_dashboard}
        return [lookup[i] for i in ids if i in lookup]

    mocker.patch(
        "superset.commands.chart.update.DashboardDAO.find_by_ids",
        side_effect=_find_dashboards_by_ids,
    )
    mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
    )
    mocker.patch(
        "superset.commands.chart.update.security_manager.is_editor",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.chart.update.compute_subjects",
        side_effect=lambda model, properties, exceptions: None,
    )
    mocker.patch(
        "superset.commands.chart.update.ChartDAO.update",
        return_value=chart,
    )

    user = MagicMock()
    g.user = user

    cmd = UpdateChartCommand(10, {"dashboards": [1, 2]})
    cmd.run()

    # The existing dashboard should NOT be touched
    assert existing_dashboard.changed_on is None
    # The newly linked dashboard MUST be touched
    assert new_dashboard.changed_on is not None
    assert new_dashboard.changed_by == user


def test_update_chart_does_not_touch_unchanged_dashboards(
    mocker: MockerFixture,
) -> None:
    """Updating a chart without changing dashboard attachments does not touch them."""
    existing_dashboard = MagicMock(id=1, changed_on=None, changed_by=None)

    chart = MagicMock(
        is_managed_externally=False,
        id=10,
        tags=[],
        dashboards=[existing_dashboard],
        datasource_id=42,
        datasource_type="table",
    )
    mocker.patch(
        "superset.commands.chart.update.ChartDAO.find_by_id",
        return_value=chart,
    )
    mocker.patch(
        "superset.commands.chart.update.DashboardDAO.find_by_ids",
        return_value=[existing_dashboard],
    )
    mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
    )
    mocker.patch(
        "superset.commands.chart.update.compute_subjects",
        side_effect=lambda model, properties, exceptions: None,
    )
    mocker.patch(
        "superset.commands.chart.update.ChartDAO.update",
        return_value=chart,
    )

    user = MagicMock()
    g.user = user

    cmd = UpdateChartCommand(10, {"dashboards": [1]})
    cmd.run()

    # The unchanged dashboard should remain untouched
    assert existing_dashboard.changed_on is None
    assert existing_dashboard.changed_by is None


def test_update_chart_removing_dashboards_does_not_touch_remaining(
    mocker: MockerFixture,
) -> None:
    """Removing a dashboard from a chart leaves remaining dashboards untouched."""
    d1 = MagicMock(id=1, changed_on=None, changed_by=None)
    d2 = MagicMock(id=2, changed_on=None, changed_by=None)

    chart = MagicMock(
        is_managed_externally=False,
        id=10,
        tags=[],
        dashboards=[d1, d2],
        datasource_id=42,
        datasource_type="table",
    )
    mocker.patch(
        "superset.commands.chart.update.ChartDAO.find_by_id",
        return_value=chart,
    )
    mocker.patch(
        "superset.commands.chart.update.DashboardDAO.find_by_ids",
        return_value=[d1],
    )
    mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
    )
    mocker.patch(
        "superset.commands.chart.update.compute_subjects",
        side_effect=lambda model, properties, exceptions: None,
    )
    mocker.patch(
        "superset.commands.chart.update.ChartDAO.update",
        return_value=chart,
    )

    user = MagicMock()
    g.user = user

    # Keep only d1, removing d2
    cmd = UpdateChartCommand(10, {"dashboards": [1]})
    cmd.run()

    assert d1.changed_on is None
    assert d1.changed_by is None
    assert d2.changed_on is None
    assert d2.changed_by is None


def test_update_chart_without_dashboards_in_payload_leaves_dashboards_untouched(
    mocker: MockerFixture,
) -> None:
    """Updates that do not alter dashboard links do not evaluate dashboard touches."""
    dashboard = MagicMock(id=1, changed_on=None, changed_by=None)
    chart = MagicMock(
        is_managed_externally=False,
        id=10,
        tags=[],
        dashboards=[dashboard],
        datasource_id=42,
        datasource_type="table",
    )
    mocker.patch(
        "superset.commands.chart.update.ChartDAO.find_by_id",
        return_value=chart,
    )
    mocker.patch(
        "superset.commands.chart.update.security_manager.raise_for_editorship",
    )
    mocker.patch(
        "superset.commands.chart.update.compute_subjects",
        side_effect=lambda model, properties, exceptions: None,
    )
    mocker.patch(
        "superset.commands.chart.update.ChartDAO.update",
        return_value=chart,
    )

    g.user = MagicMock()
    cmd = UpdateChartCommand(10, {"slice_name": "Renamed only"})
    cmd.run()

    assert dashboard.changed_on is None
    assert dashboard.changed_by is None
