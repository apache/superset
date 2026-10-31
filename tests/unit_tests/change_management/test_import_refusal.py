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
"""Which imports review refuses, and how the refusal travels.

Two things are pinned here. An overwriting import is refused only where it
would really land on a live asset -- a bundle of entirely new assets creates
nothing a viewer can already see, so V1 does not gate it (SOW 8), and
refusing it blocked a first-time import outright (S-06). And a refusal that
does fire must not be folded into the importer's generic "failed for an
unknown reason" error: the API has to answer it with a 4xx carrying the
refusal's own message.
"""

from __future__ import annotations

from io import BytesIO
from typing import Any
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from asset_approval.exceptions import ImportOverwriteRefusedError

REFUSAL = "Importing over an existing {kind} needs review"

#: Where each kind's own models live in a bundle, and what a collision there
#: is called. Mirrors the importers' ``prefix``.
PREFIX = {"dashboard": "dashboards/", "chart": "charts/", "dataset": "datasets/"}


def _importers() -> list[tuple[str, Any]]:
    # pylint: disable=import-outside-toplevel
    from superset.commands.chart.importers.v1 import ImportChartsCommand
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.dataset.importers.v1 import ImportDatasetsCommand

    return [
        ("dashboard", ImportDashboardsCommand),
        ("chart", ImportChartsCommand),
        ("dataset", ImportDatasetsCommand),
    ]


def _create_tables(session: Session) -> None:
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())


def _live(session: Session, kind: str) -> str:
    """Put one asset of this kind in the database and return its uuid."""
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    _create_tables(session)
    if kind == "dashboard":
        model: Any = Dashboard(dashboard_title="live", uuid=uuid4())
    elif kind == "chart":
        model = Slice(slice_name="live", uuid=uuid4())
    else:
        model = SqlaTable(
            table_name="live",
            uuid=uuid4(),
            database=Database(database_name="db", sqlalchemy_uri="sqlite://"),
        )
    session.add(model)
    session.flush()
    return str(model.uuid)


def _bundle(kind: str, uuid: str) -> dict[str, str]:
    """A one-file bundle under the kind's own prefix, as uploaded."""
    return {f"{PREFIX[kind]}x.yaml": f"uuid: {uuid}\n"}


@pytest.mark.parametrize("kind", ["dashboard", "chart", "dataset"])
def test_overwrite_refusal_is_not_wrapped(
    mocker: MockerFixture, session: Session, kind: str
) -> None:
    command_cls = dict(_importers())[kind]
    live = _live(session, kind)
    mocker.patch("asset_approval.gate.is_enabled", return_value=True)
    mocker.patch.object(command_cls, "validate")

    command = command_cls(_bundle(kind, live), overwrite=True)
    with pytest.raises(ImportOverwriteRefusedError) as excinfo:
        command.run()

    assert str(excinfo.value).startswith(REFUSAL.format(kind=kind))
    assert excinfo.value.status == 422


@pytest.mark.parametrize("kind", ["dashboard", "chart", "dataset"])
def test_overwrite_import_of_new_assets_proceeds(
    mocker: MockerFixture, session: Session, kind: str
) -> None:
    """An overwrite flag is not by itself a governed write.

    The bundle carries a uuid nothing in the database has, so the import
    creates rather than replaces -- which V1 does not gate. Refusing on the
    flag alone is what made ``superset import-dashboards`` unusable: its CLI
    hardcodes ``overwrite=True``, so even a first import into an empty
    instance was turned away (S-06).
    """
    command_cls = dict(_importers())[kind]
    _live(session, kind)
    mocker.patch("asset_approval.gate.is_enabled", return_value=True)
    mocker.patch.object(command_cls, "validate")
    body = mocker.patch.object(command_cls, "_import")

    command_cls(_bundle(kind, str(uuid4())), overwrite=True).run()

    body.assert_called_once()


@pytest.mark.parametrize("kind", ["dashboard", "chart", "dataset"])
def test_overwrite_import_into_an_empty_instance_proceeds(
    mocker: MockerFixture, session: Session, kind: str
) -> None:
    """Nothing is stored yet, so there is nothing review could be protecting."""
    command_cls = dict(_importers())[kind]
    _create_tables(session)
    mocker.patch("asset_approval.gate.is_enabled", return_value=True)
    mocker.patch.object(command_cls, "validate")
    body = mocker.patch.object(command_cls, "_import")

    command_cls(_bundle(kind, str(uuid4())), overwrite=True).run()

    body.assert_called_once()


def test_the_gate_reads_the_bundle_and_not_the_validated_configs(
    mocker: MockerFixture, session: Session
) -> None:
    """The refusal has to be decided from ``contents``.

    ``_configs`` is written by ``validate()``, which runs inside ``run()``
    and therefore after the gate. A gate reading it saw an empty bundle on
    every call, which is why it could only ever decide on the overwrite
    flag. Left as a guard so a future refactor cannot quietly go back to
    reading state that does not exist yet.
    """
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand

    live = _live(session, "dashboard")
    mocker.patch("asset_approval.gate.is_enabled", return_value=True)
    mocker.patch.object(ImportDashboardsCommand, "validate")
    mocker.patch.object(ImportDashboardsCommand, "_import")

    command = ImportDashboardsCommand(_bundle("dashboard", live), overwrite=True)
    assert command._configs == {}

    with pytest.raises(ImportOverwriteRefusedError):
        command.run()


def test_a_bundled_dependency_is_in_scope_only_with_overwrite_all(
    mocker: MockerFixture, session: Session
) -> None:
    """A dashboard import replaces its charts only when asked to.

    ``overwrite`` alone replaces the dashboards; the charts, datasets and
    databases they are built on are reused unchanged unless ``overwrite_all``
    is set as well (``overwrite_assets = overwrite and overwrite_all``). The
    refusal follows that rule rather than the flag, and names what it found
    rather than what was being imported.
    """
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand

    live_chart = _live(session, "chart")
    mocker.patch("asset_approval.gate.is_enabled", return_value=True)
    mocker.patch.object(ImportDashboardsCommand, "validate")
    body = mocker.patch.object(ImportDashboardsCommand, "_import")
    bundle = {
        "dashboards/d.yaml": f"uuid: {uuid4()}\n",
        "charts/c.yaml": f"uuid: {live_chart}\n",
    }

    ImportDashboardsCommand(bundle, overwrite=True).run()
    body.assert_called_once()

    with pytest.raises(ImportOverwriteRefusedError) as excinfo:
        ImportDashboardsCommand(bundle, overwrite=True, overwrite_all=True).run()

    assert str(excinfo.value).startswith(REFUSAL.format(kind="chart"))


@pytest.mark.parametrize("kind", ["dashboard", "chart", "dataset"])
def test_overwrite_import_unchanged_with_flag_off(
    mocker: MockerFixture, session: Session, kind: str
) -> None:
    command_cls = dict(_importers())[kind]
    live = _live(session, kind)
    mocker.patch("asset_approval.gate.is_enabled", return_value=False)
    mocker.patch.object(command_cls, "validate")
    mocker.patch.object(command_cls, "_import")

    # The same bundle the gate would refuse with review on.
    command_cls(_bundle(kind, live), overwrite=True).run()


@pytest.mark.parametrize("kind", ["dashboard", "chart", "dataset"])
def test_other_failures_still_wrapped(
    mocker: MockerFixture, session: Session, kind: str
) -> None:
    """Only review refusals pass through; other errors keep the old wrapping."""
    command_cls = dict(_importers())[kind]
    mocker.patch.object(command_cls, "validate")
    mocker.patch.object(command_cls, "_import", side_effect=RuntimeError("boom"))

    with pytest.raises(command_cls.import_error):
        command_cls({}, overwrite=False).run()


@pytest.mark.parametrize(
    "kind,api_module,command_name",
    [
        ("dashboard", "superset.dashboards.api", "ImportDashboardsCommand"),
        ("chart", "superset.charts.api", "ImportChartsCommand"),
        ("dataset", "superset.datasets.api", "ImportDatasetsCommand"),
    ],
)
def test_import_api_answers_refusal_with_422(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    kind: str,
    api_module: str,
    command_name: str,
) -> None:
    mocker.patch(f"{api_module}.is_zipfile", return_value=True)
    # The endpoint reads the upload through open_import_bundle, not ZipFile.
    # Left unpatched, the real one rejects these few bytes as a corrupt
    # archive and the request never reaches the command under test.
    mocker.patch(f"{api_module}.open_import_bundle")
    mocker.patch(
        f"{api_module}.get_contents_from_bundle",
        return_value={"metadata.yaml": "x"},
    )
    command = mocker.patch(f"{api_module}.{command_name}")
    command.return_value.run.side_effect = ImportOverwriteRefusedError(kind)

    response = client.post(
        f"/api/v1/{kind}/import/",
        data={
            "formData": (BytesIO(b"test"), "test.zip"),
            "overwrite": "true",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 422
    assert response.json["message"].startswith(REFUSAL.format(kind=kind))
