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
"""Every save of a canvas is a version, which its editors can restore."""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest
from flask_appbuilder import Model
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

from superset.canvas.data import PlacementData
from superset.canvas.definition.schemas import empty_definition
from superset.exceptions import SupersetSecurityException
from superset.extensions import db
from superset.models.canvas import Canvas, CanvasOp
from superset.utils import json
from tests.unit_tests.canvas.fixtures import FakeResolver, ops

pytestmark = pytest.mark.parametrize(
    "app",
    [
        {
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "FEATURE_FLAGS": {"CANVAS": True, "VERSION_HISTORY": True},
        }
    ],
    indirect=True,
)

BASE = "/api/v1/canvas"
BINDING = {"datasetId": 13, "metrics": ["count"], "dimensions": ["country"]}


@pytest.fixture
def canvas(
    app: Any, mocker: MockerFixture, widget_types: FakeResolver
) -> Iterator[Canvas]:
    """A canvas in a database with version capture, which the user edits."""
    Model.metadata.create_all(db.engine)
    session: Session = db.session()
    canvas = Canvas(
        title="Exec overview",
        definition=json.dumps(empty_definition()),
        definition_version=1,
        revision=1,
    )
    session.add(canvas)
    session.commit()
    mocker.patch("superset.canvas.filters.security_manager.is_admin", return_value=True)
    mocker.patch("superset.security_manager.raise_for_editorship")
    mocker.patch("superset.security_manager.is_editor", return_value=True)
    mocker.patch("superset.commands.canvas.apply_ops.publish_realtime")
    yield canvas
    db.session.remove()
    Model.metadata.drop_all(db.engine)


def save(canvas: Canvas, *operations: dict[str, Any]) -> None:
    """Publish ``operations``, as committing a draft does."""
    from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand

    ApplyCanvasOperationsCommand(
        canvas.id, canvas.revision, ops(*operations), strict=True
    ).run()


def versions(client: Any, canvas: Canvas) -> list[dict[str, Any]]:
    response = client.get(f"{BASE}/{canvas.uuid}/versions/")
    assert response.status_code == 200
    return response.json["result"]


def changes(entry: dict[str, Any]) -> list[tuple[str, str, list[Any]]]:
    return [(c["kind"], c["operation"], c["path"]) for c in entry["changes"]]


def test_each_save_is_a_version_with_its_changes(
    client: Any, full_api_access: None, canvas: Canvas
) -> None:
    save(canvas, {"op": "add", "id": "notes", "widgetType": "markdown"})
    save(canvas, {"op": "set_props", "id": "notes", "props": {"title": "Notes"}})
    assert (
        client.put(f"{BASE}/{canvas.id}", json={"title": "Renamed"}).status_code == 200
    )

    history = versions(client, canvas)

    assert [entry["operation_type"] for entry in history] == [
        "baseline",
        "update",
        "update",
        "update",
    ]
    added, edited, renamed = history[1:]
    assert changes(added) == [("widget", "add", ["notes"])]
    assert added["changes"][0]["to_value"] == {
        "parent": None,
        "widgetType": "markdown",
    }
    assert changes(edited) == [("widget", "add", ["notes", "props", "title"])]
    assert changes(renamed) == [("field", "edit", ["title"])]


def test_a_version_renders_as_it_was_saved(
    client: Any, full_api_access: None, canvas: Canvas
) -> None:
    save(canvas, {"op": "add", "id": "notes", "widgetType": "markdown"})
    first = versions(client, canvas)[1]["version_uuid"]
    save(canvas, {"op": "remove", "id": "notes"})

    response = client.get(f"{BASE}/{canvas.uuid}/versions/{first}/")

    assert response.status_code == 200
    result = response.json["result"]
    assert result["_version"]["version_uuid"] == first
    assert result["rendered"]["revision"] == 2
    assert result["rendered"]["definition"]["root"]["children"] == ["notes"]
    assert result["rendered"]["widgetTypes"] == {"notes": "markdown"}
    assert "notes" in result["rendered"]["placements"]


def test_restore_is_a_new_save_that_drafts_cannot_overwrite(
    client: Any, full_api_access: None, canvas: Canvas
) -> None:
    from superset.commands.canvas.apply_ops import ApplyCanvasOperationsCommand
    from superset.commands.canvas.exceptions import DraftConflictError

    save(canvas, {"op": "add", "id": "notes", "widgetType": "markdown"})
    first = versions(client, canvas)[1]
    save(canvas, {"op": "remove", "id": "notes"})
    stale_revision = canvas.revision

    response = client.post(
        f"{BASE}/{canvas.uuid}/versions/{first['version_uuid']}/restore"
    )

    assert response.status_code == 200
    assert response.json["result"] == {"revision": 4, "skippedPlacements": []}
    assert json.loads(canvas.definition)["root"]["children"] == ["notes"]
    history = versions(client, canvas)
    assert len(history) == 4
    meta, *rest = history[-1]["changes"]
    assert meta["kind"] == "__meta__"
    assert meta["to_value"]["version_number"] == first["version_number"]
    assert ("widget", "add", ["notes"]) in changes({"changes": rest})
    # Changes from before the restore can no longer replay onto it.
    assert db.session.query(CanvasOp).filter_by(canvas_id=canvas.id).count() == 0
    with pytest.raises(DraftConflictError):
        ApplyCanvasOperationsCommand(canvas.id, stale_revision, [], strict=True).run()


def test_restore_leaves_out_widgets_that_are_gone_or_not_placeable(
    client: Any,
    full_api_access: None,
    canvas: Canvas,
    widget_types: FakeResolver,
    mocker: MockerFixture,
) -> None:
    save(
        canvas,
        {"op": "add", "id": "kept", "widgetId": "chart-1"},
        {"op": "add", "id": "deleted", "widgetId": "chart-2"},
        {"op": "add", "id": "hidden", "widgetId": "chart-3"},
    )
    first = versions(client, canvas)[1]["version_uuid"]
    save(canvas, *({"op": "remove", "id": n} for n in ("kept", "deleted", "hidden")))
    exists = widget_types.widget_types

    def without_chart_2(widget_ids: Iterable[str]) -> dict[str, str]:
        return exists(set(widget_ids) - {"chart-2"})

    mocker.patch.object(widget_types, "widget_types", side_effect=without_chart_2)
    widget_types.hidden.add("chart-3")

    response = client.post(f"{BASE}/{canvas.uuid}/versions/{first}/restore")

    assert response.status_code == 200
    assert response.json["result"]["skippedPlacements"] == ["deleted", "hidden"]
    assert list(json.loads(canvas.definition)["nodes"]) == ["kept"]


def test_a_version_hides_widgets_the_canvas_no_longer_grants(
    client: Any,
    full_api_access: None,
    canvas: Canvas,
    widget_types: FakeResolver,
    mocker: MockerFixture,
) -> None:
    mocker.patch("superset.commands.canvas.placement_data.run_binding")
    widget_types.props["chart-3"] = {"dataBinding": BINDING}
    save(canvas, {"op": "add", "id": "secret", "widgetId": "chart-3"})
    first = versions(client, canvas)[1]["version_uuid"]
    save(canvas, {"op": "remove", "id": "secret"})
    widget_types.hidden.add("chart-3")

    result = client.get(f"{BASE}/{canvas.uuid}/versions/{first}/").json["result"]
    data = client.post(
        f"{BASE}/{canvas.id}/placement/secret/data",
        json={},
        headers={"X-Canvas-Version": first},
    )

    assert result["skippedPlacements"] == ["secret"]
    assert result["rendered"]["definition"]["nodes"] == {}
    assert result["rendered"]["widgets"] == {}
    assert data.status_code == 404


def test_only_editors_read_or_restore_versions(
    client: Any, full_api_access: None, canvas: Canvas, mocker: MockerFixture
) -> None:
    save(canvas, {"op": "add", "id": "notes", "widgetType": "markdown"})
    first = versions(client, canvas)[1]["version_uuid"]
    mocker.patch("superset.security_manager.is_editor", return_value=False)
    mocker.patch(
        "superset.security_manager.raise_for_editorship",
        side_effect=SupersetSecurityException(MagicMock()),
    )

    assert client.get(f"{BASE}/{canvas.uuid}/versions/").status_code == 403
    assert client.get(f"{BASE}/{canvas.uuid}/versions/{first}/").status_code == 403
    restore = client.post(f"{BASE}/{canvas.uuid}/versions/{first}/restore")
    assert restore.status_code == 403
    assert json.loads(canvas.definition)["root"]["children"] == ["notes"]


def test_placement_data_reads_a_version(
    client: Any,
    full_api_access: None,
    canvas: Canvas,
    widget_types: FakeResolver,
    mocker: MockerFixture,
) -> None:
    run_binding = mocker.patch(
        "superset.commands.canvas.placement_data.run_binding",
        return_value=PlacementData([{"country": "FR", "count": 3}], None, None),
    )
    widget_types.props["chart-1"] = {"dataBinding": BINDING}
    save(canvas, {"op": "add", "id": "sales", "widgetId": "chart-1"})
    first = versions(client, canvas)[1]["version_uuid"]
    save(canvas, {"op": "remove", "id": "sales"})
    url = f"{BASE}/{canvas.id}/placement/sales/data"

    assert client.post(url, json={}).status_code == 404
    response = client.post(url, json={}, headers={"X-Canvas-Version": first})

    assert response.status_code == 200
    assert run_binding.call_args.args[0] == BINDING
    bad = client.post(url, json={}, headers={"X-Canvas-Version": "nope"})
    assert bad.status_code == 400
