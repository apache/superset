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
"""sc-120011: the chart/dashboard/dataset update commands refuse externally
managed entities server-side.

`is_managed_externally` marks an entity whose source of truth lives outside
Superset; an in-app write would be overwritten on the next external sync, so
the browser hides the edit affordances. These tests pin that the refusal is
also enforced in ``UpdateCommand.validate()`` -- an otherwise-authorized
editor calling ``PUT /api/v1/{chart,dashboard,dataset}/<id>`` directly gets
the same 403 the editorship denial produces. The representative
real-endpoint case is
``tests/integration_tests/charts/api_tests.py::test_update_chart_refuses_externally_managed``.
"""

import contextlib
from unittest.mock import MagicMock

import pytest

from superset.commands.chart.exceptions import ChartForbiddenError
from superset.commands.chart.update import UpdateChartCommand
from superset.commands.dashboard.exceptions import DashboardForbiddenError
from superset.commands.dashboard.update import (
    UpdateDashboardColorsConfigCommand,
    UpdateDashboardCommand,
)
from superset.commands.dataset.exceptions import DatasetForbiddenError
from superset.commands.dataset.update import UpdateDatasetCommand
from superset.commands.utils import raise_if_managed_externally

ENTITY_CASES = [
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


def _wire_module_mocks(mocker, module, dao_name, entity):
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


@pytest.mark.parametrize(("command_cls", "module", "dao_name", "exc"), ENTITY_CASES)
def test_update_refuses_externally_managed_entity(
    mocker, command_cls, module, dao_name, exc
):
    """An editor-passing update of an externally managed entity is refused
    with the entity's editorship-denial exception (mapped to HTTP 403 by the
    API layer), after the editorship check has been consulted."""
    entity = MagicMock()
    entity.is_managed_externally = True
    sm = _wire_module_mocks(mocker, module, dao_name, entity)

    with pytest.raises(exc):
        command_cls(1, {"description": "changed"}).validate()

    # This also pins the order: had the gate run first and raised, the
    # editorship check would never have been reached, so a caller with no
    # edit rights keeps receiving the plain editorship denial.
    sm.raise_for_editorship.assert_called_once_with(entity)


@pytest.mark.parametrize(("command_cls", "module", "dao_name", "exc"), ENTITY_CASES)
def test_update_command_passes_entity_and_exception_to_gate(
    mocker, command_cls, module, dao_name, exc
):
    """Pins the call-site wiring: validate() hands the loaded entity and the
    entity's 403 exception class to the gate. The inertness half of the
    contract (flag False -> no raise) is pinned by
    test_helper_refuses_only_externally_managed below."""
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


def test_dashboard_colors_config_update_is_exempt(mocker):
    """UpdateDashboardColorsConfigCommand persists derived color metadata in
    the background while a dashboard is merely viewed (fire-and-forget from
    the frontend); an externally managed dashboard must not start failing
    those background saves with 403s. Control: the parametrized refusal test
    above proves the parent UpdateDashboardCommand *does* refuse the same
    entity."""
    entity = MagicMock()
    entity.is_managed_externally = True
    _wire_module_mocks(
        mocker, "superset.commands.dashboard.update", "DashboardDAO", entity
    )

    try:
        UpdateDashboardColorsConfigCommand(1, {}).validate()
    except DashboardForbiddenError:
        pytest.fail("colors-config update refused for an externally managed dashboard")


def test_helper_refuses_only_externally_managed():
    """The shared helper raises the supplied exception exactly when
    ``is_managed_externally`` is set."""
    managed = MagicMock()
    managed.is_managed_externally = True
    with pytest.raises(ChartForbiddenError):
        raise_if_managed_externally(managed, ChartForbiddenError)

    local = MagicMock()
    local.is_managed_externally = False
    assert raise_if_managed_externally(local, ChartForbiddenError) is None
