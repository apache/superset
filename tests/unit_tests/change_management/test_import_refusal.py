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
"""An import refused by review reaches the caller as itself.

The refusal must not be folded into the importer's generic "failed for an
unknown reason" error, and the API must answer it with a 4xx carrying the
refusal's own message.
"""

from __future__ import annotations

from io import BytesIO
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from asset_approval.exceptions import ImportOverwriteRefusedError

REFUSAL = "Importing over an existing {kind} needs review"


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


@pytest.mark.parametrize("kind", ["dashboard", "chart", "dataset"])
def test_overwrite_refusal_is_not_wrapped(
    mocker: MockerFixture, session: Session, kind: str
) -> None:
    command_cls = dict(_importers())[kind]
    mocker.patch("asset_approval.gate.is_enabled", return_value=True)
    mocker.patch.object(command_cls, "validate")

    command = command_cls({}, overwrite=True)
    with pytest.raises(ImportOverwriteRefusedError) as excinfo:
        command.run()

    assert str(excinfo.value).startswith(REFUSAL.format(kind=kind))
    assert excinfo.value.status == 422


@pytest.mark.parametrize("kind", ["dashboard", "chart", "dataset"])
def test_overwrite_import_unchanged_with_flag_off(
    mocker: MockerFixture, session: Session, kind: str
) -> None:
    command_cls = dict(_importers())[kind]
    mocker.patch("asset_approval.gate.is_enabled", return_value=False)
    mocker.patch.object(command_cls, "validate")

    # Nothing to import: the run completes without the gate intervening.
    command_cls({}, overwrite=True).run()


@pytest.mark.parametrize("kind", ["dashboard", "chart", "dataset"])
def test_other_failures_still_wrapped(
    mocker: MockerFixture, session: Session, kind: str
) -> None:
    """Only review refusals pass through; other errors keep the old wrapping.

    Imported without overwriting, because that is the only import that
    reaches ``_import`` while review is on: the refusal is raised ahead of
    ``run``, so an overwriting import never gets as far as the body this
    is making fail.
    """
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
