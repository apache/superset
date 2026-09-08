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
"""sc-120011: mutating commands refuse externally managed entities.

``is_managed_externally`` marks an entity whose source of truth lives
outside Superset; an in-app write would be overwritten on the next
external sync, so the browser hides the edit affordances. These tests pin
the server-side refusals: the chart/dashboard/dataset update commands
(including the chart's relaxed-editorship query-context-only save), the
dataset refresh command, and the narrowing of the dashboard colors-config
exemption to derived values only. The ``is_managed_externally`` flag
itself is discarded by the ordinary PUT schemas so it cannot be set (and
thereby self-locked) through the API. The representative real-endpoint
case is
``tests/integration_tests/charts/api_tests.py::test_update_chart_refuses_externally_managed``.
"""

import contextlib
from typing import Any, Final
from unittest.mock import MagicMock

import pytest
from marshmallow import Schema
from pytest_mock import MockerFixture

from superset.charts.schemas import ChartPutSchema
from superset.commands.chart.exceptions import ChartForbiddenError
from superset.commands.chart.update import UpdateChartCommand
from superset.commands.dashboard.exceptions import DashboardForbiddenError
from superset.commands.dashboard.update import (
    UpdateDashboardColorsConfigCommand,
    UpdateDashboardCommand,
)
from superset.commands.dataset.exceptions import DatasetForbiddenError
from superset.commands.dataset.refresh import RefreshDatasetCommand
from superset.commands.dataset.update import UpdateDatasetCommand
from superset.commands.utils import raise_if_managed_externally
from superset.dashboards.schemas import DashboardPutSchema
from superset.datasets.schemas import DatasetPutSchema

ENTITY_CASES: Final = [
    pytest.param(
        UpdateChartCommand,
        "superset.commands.chart.update",
        "ChartDAO",
        ChartForbiddenError,
        id="chart",
    ),
    pytest.param(
        UpdateDashboardCommand,
        "superset.commands.dashboard.update",
        "DashboardDAO",
        DashboardForbiddenError,
        id="dashboard",
    ),
    pytest.param(
        UpdateDatasetCommand,
        "superset.commands.dataset.update",
        "DatasetDAO",
        DatasetForbiddenError,
        id="dataset",
    ),
]


def _wire_module_mocks(
    mocker: MockerFixture, module: str, dao_name: str, entity: MagicMock
) -> MagicMock:
    """Replace the command module's collaborators with explicit MagicMocks.

    ``security_manager`` is a werkzeug LocalProxy at module level; a bare
    ``mocker.patch`` would replace it with an AsyncMock (``mock.patch``'s
    async-object detection is fooled by the proxy's attribute forwarding)
    whose raising side_effects silently never fire, so an explicit
    ``MagicMock`` is passed as the replacement.
    """
    sm = MagicMock()
    sm.raise_for_editorship.return_value = None
    mocker.patch(f"{module}.security_manager", new=sm)
    dao = MagicMock()
    dao.find_by_id.return_value = entity
    mocker.patch(f"{module}.{dao_name}", new=dao)
    mocker.patch(f"{module}.compute_subjects", new=MagicMock())
    return sm


def _managed_entity() -> MagicMock:
    entity = MagicMock()
    entity.is_managed_externally = True
    return entity


@pytest.mark.parametrize(("command_cls", "module", "dao_name", "exc"), ENTITY_CASES)
def test_update_refuses_externally_managed_entity(
    mocker: MockerFixture,
    command_cls: type,
    module: str,
    dao_name: str,
    exc: type[Exception],
) -> None:
    """An editor-passing update of a managed entity is refused with 403.

    The refusal reuses the entity's editorship-denial exception (mapped to
    HTTP 403 by the API layer) so the response discloses nothing new.
    """
    entity = _managed_entity()
    sm = _wire_module_mocks(mocker, module, dao_name, entity)

    with pytest.raises(exc):
        command_cls(1, {"description": "changed"}).validate()

    # This also pins the order: had the gate run first and raised, the
    # editorship check would never have been reached, so a caller with no
    # edit rights keeps receiving the plain editorship denial.
    sm.raise_for_editorship.assert_called_once_with(entity)


@pytest.mark.parametrize(("command_cls", "module", "dao_name", "exc"), ENTITY_CASES)
def test_update_command_passes_entity_and_exception_to_gate(
    mocker: MockerFixture,
    command_cls: type,
    module: str,
    dao_name: str,
    exc: type[Exception],
) -> None:
    """Pins the call-site wiring of the shared gate.

    validate() hands the loaded entity and the entity's 403 exception class
    to the gate. The inertness half of the contract (flag False -> no
    raise) is pinned by test_helper_refuses_only_externally_managed below.
    """
    entity = MagicMock()
    entity.is_managed_externally = False
    _wire_module_mocks(mocker, module, dao_name, entity)
    gate = mocker.patch(f"{module}.raise_if_managed_externally")

    # Downstream validation may trip over the MagicMock entity; the gate
    # call (with the right entity and exception class) is the signal under
    # test, and the gate itself is patched so it cannot be the raiser.
    with contextlib.suppress(Exception):
        command_cls(1, {"description": "changed"}).validate()

    gate.assert_called_once_with(entity, exc)


def test_query_context_only_update_refuses_externally_managed_chart(
    mocker: MockerFixture,
) -> None:
    """The relaxed-editorship query-context-only save is gated too.

    Stored query context is executable state -- report execution loads and
    runs it -- so a client-supplied context on a managed chart is a
    behavior change, not derived state. Explore's background context save
    simply receives a 403 for such charts.
    """
    entity = _managed_entity()
    _wire_module_mocks(mocker, "superset.commands.chart.update", "ChartDAO", entity)

    with pytest.raises(ChartForbiddenError):
        UpdateChartCommand(
            1, {"query_context": "{}", "query_context_generation": True}
        ).validate()


def test_dashboard_colors_config_derived_only_update_is_exempt(
    mocker: MockerFixture,
) -> None:
    """Derived-only colors payloads stay writable on managed dashboards.

    UpdateDashboardColorsConfigCommand persists color metadata in the
    background while a dashboard is merely viewed (fire-and-forget from the
    frontend); a payload that leaves the authoritative inputs unchanged
    must not start failing with 403s. Control: the parametrized refusal
    test above proves the parent UpdateDashboardCommand *does* refuse the
    same entity, and the test below proves changed authoritative inputs
    are refused.
    """
    entity = _managed_entity()
    entity.json_metadata = '{"color_scheme": "blues", "label_colors": {"a": "#000"}}'
    _wire_module_mocks(
        mocker, "superset.commands.dashboard.update", "DashboardDAO", entity
    )
    payload = {
        "color_scheme": "blues",
        "label_colors": {"a": "#000"},
        "color_scheme_domain": ["#000"],
        "shared_label_colors": ["a"],
        "map_label_colors": {"a": "#000"},
    }

    try:
        UpdateDashboardColorsConfigCommand(1, payload).validate()
    except DashboardForbiddenError:
        pytest.fail("derived-only colors save refused for a managed dashboard")


@pytest.mark.parametrize("key", ["color_scheme", "label_colors"])
def test_dashboard_colors_config_refuses_changing_authoritative_colors(
    mocker: MockerFixture, key: str
) -> None:
    """Changing an authoritative color input on a managed dashboard is 403.

    color_scheme and label_colors are the dashboard's real content (the
    other accepted keys are derived from them); letting the colors PUT
    rewrite them would reopen the integrity gap the update gate closes.
    """
    entity = _managed_entity()
    entity.json_metadata = '{"color_scheme": "blues", "label_colors": {"a": "#000"}}'
    _wire_module_mocks(
        mocker, "superset.commands.dashboard.update", "DashboardDAO", entity
    )

    with pytest.raises(DashboardForbiddenError):
        UpdateDashboardColorsConfigCommand(1, {key: "changed"}).validate()


def test_refresh_refuses_externally_managed_dataset(mocker: MockerFixture) -> None:
    """PUT /dataset/<pk>/refresh is gated after the editorship check.

    Refresh persists fetched column metadata onto the dataset; a managed
    dataset's columns are owned by the external sync.
    """
    entity = _managed_entity()
    sm = MagicMock()
    sm.raise_for_editorship.return_value = None
    mocker.patch("superset.commands.dataset.refresh.security_manager", new=sm)
    dao = MagicMock()
    dao.find_by_id.return_value = entity
    mocker.patch("superset.commands.dataset.refresh.DatasetDAO", new=dao)

    with pytest.raises(DatasetForbiddenError):
        RefreshDatasetCommand(1).validate()

    sm.raise_for_editorship.assert_called_once_with(entity)


@pytest.mark.parametrize(
    "schema_cls", [ChartPutSchema, DashboardPutSchema, DatasetPutSchema]
)
def test_put_schemas_discard_is_managed_externally(schema_cls: type[Schema]) -> None:
    """The flag is not client-writable, and echoing it back is harmless.

    A client-set True would be irreversible via the API once the gate
    refuses edits of flagged entities, so the ordinary PUT schemas drop
    the key in a pre_load hook. The field stays DECLARED so the published
    OpenAPI contract (and generated clients) keep the property, and
    echoing it back never 422s -- but because pre_load runs before field
    loading, the key can never reach the loaded payload.
    """
    assert "is_managed_externally" in schema_cls().fields
    loaded: dict[str, Any] = schema_cls().load({"is_managed_externally": True})
    assert "is_managed_externally" not in loaded


def test_helper_refuses_only_externally_managed() -> None:
    """The helper raises the supplied exception iff the flag is set."""
    with pytest.raises(ChartForbiddenError):
        raise_if_managed_externally(_managed_entity(), ChartForbiddenError)

    local = MagicMock()
    local.is_managed_externally = False
    raise_if_managed_externally(local, ChartForbiddenError)  # must not raise
