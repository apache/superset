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
from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.exceptions import SupersetSecurityException
from superset.utils import json
from tests.unit_tests.canvas.fixtures import FakeResolver

# The canvas API only exists while its feature flag is on.
pytestmark = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)

BASE = "/api/v1/canvas"
URL = f"{BASE}/100/definition"


@pytest.fixture
def canvas(
    session: Session, mocker: MockerFixture, widget_types: FakeResolver
) -> Iterator[Any]:
    from superset.canvas.definition.schemas import empty_definition
    from superset.models.canvas import Canvas

    Canvas.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    canvas = Canvas(
        id=100,
        title="Exec overview",
        definition=json.dumps(empty_definition()),
        definition_version=1,
        revision=1,
    )
    session.add(canvas)
    session.commit()

    # Admins see every canvas; access rules have their own test below.
    mocker.patch("superset.canvas.filters.security_manager.is_admin", return_value=True)
    mocker.patch("superset.security_manager.raise_for_editorship")
    yield canvas
    session.rollback()


@pytest.fixture
def published(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("superset.commands.canvas.apply_ops.publish_realtime")


def patch_ops(client: Any, base_revision: int, *ops: dict[str, Any]) -> Any:
    return client.patch(URL, json={"base_revision": base_revision, "ops": list(ops)})


def add(widget: str, **extra: Any) -> dict[str, Any]:
    return {"op": "add", "widgetId": widget, **extra}


def test_create_and_read_a_canvas(
    client: Any,
    full_api_access: None,
    canvas: Any,
    mocker: MockerFixture,
) -> None:
    mocker.patch("superset.commands.canvas.create.populate_subjects")

    response = client.post(BASE + "/", json={"title": "Ops breakdown"})

    assert response.status_code == 201
    new_id = response.json["id"]
    definition = client.get(f"{BASE}/{new_id}/definition").json["result"]
    assert definition["revision"] == 1
    assert definition["definition"]["nodes"] == {}


def test_metadata_and_slug(
    client: Any,
    full_api_access: None,
    canvas: Any,
    mocker: MockerFixture,
    session: Session,
) -> None:
    from superset.models.canvas import Canvas

    mocker.patch("superset.commands.canvas.create.populate_subjects")
    metadata = {
        "slug": "sales-overview",
        "css": ".x { color: red; }",
        "certified_by": "Data team",
        "certification_details": "Reviewed weekly",
        "external_url": "https://example.com/canvas.yaml",
        "is_managed_externally": True,
    }

    response = client.post(BASE + "/", json={"title": "Sales", **metadata})

    assert response.status_code == 201
    created = session.get(Canvas, response.json["id"])
    assert {key: getattr(created, key) for key in metadata} == metadata
    assert created.url == "/canvas/sales-overview/"

    taken = client.put(f"{BASE}/100", json={"slug": "sales-overview"})
    assert taken.status_code == 422
    assert taken.json["message"] == {"slug": ["Must be unique"]}
    for slug in ("123", "list", "has space"):
        assert client.put(f"{BASE}/100", json={"slug": slug}).status_code == 400
    missing_theme = client.put(f"{BASE}/100", json={"theme_id": 999})
    assert missing_theme.json["message"] == {"theme_id": ["Theme does not exist"]}


def test_create_validates_the_body(
    client: Any, full_api_access: None, canvas: Any
) -> None:
    assert client.post(BASE + "/", json={}).status_code == 400


def test_update_and_delete(client: Any, full_api_access: None, canvas: Any) -> None:
    response = client.put(f"{BASE}/100", json={"title": "Renamed"})

    assert response.status_code == 200
    assert canvas.title == "Renamed"
    assert client.delete(f"{BASE}/100").status_code == 200
    assert client.get(URL).status_code == 404


def test_get_definition(client: Any, full_api_access: None, canvas: Any) -> None:
    response = client.get(URL)

    assert response.status_code == 200
    assert response.json["result"]["revision"] == 1
    assert response.json["result"]["definition"]["nodes"] == {}
    assert response.json["result"]["filterScopes"] == {}
    assert response.json["result"]["crossFilterScopes"] == {}
    assert response.json["result"]["customizationScopes"] == {}
    assert response.json["result"]["placements"] == {}
    assert response.json["result"]["widgetTypes"] == {}
    assert response.json["result"]["gridColumns"] == {}


def test_apply_operations_bumps_revision_logs_and_publishes(
    client: Any, full_api_access: None, canvas: Any, published: MagicMock
) -> None:
    response = patch_ops(client, 1, add("filter"), add("chart-1"))

    assert response.status_code == 200
    result = response.json["result"]
    assert result["revision"] == 2
    filter_id, chart_id = (op["id"] for op in result["ops"])
    assert result["filterScopes"] == {filter_id: [chart_id]}
    assert json.loads(canvas.definition)["root"]["children"] == [filter_id, chart_id]
    assert canvas.revision == 2
    published.assert_called_once_with(
        topic="entity.changed",
        scope="authenticated_global",
        payload={"entity_type": "canvas", "id": 100},
    )

    changes = client.get(f"{URL}/changes?since=1").json["result"]
    assert changes["revision"] == 2
    assert [op["id"] for op in changes["changes"][0]["ops"]] == [filter_id, chart_id]


def test_non_overlapping_stale_write_is_merged(
    client: Any, full_api_access: None, canvas: Any, published: MagicMock
) -> None:
    first, second = (
        op["id"]
        for op in patch_ops(client, 1, add("chart-1"), add("chart-2")).json["result"][
            "ops"
        ]
    )
    place_first = {"op": "place", "id": first, "layout": {"colSpan": 8}}
    assert patch_ops(client, 2, place_first).status_code == 200

    # A second writer still at revision 2 resizes the other node.
    response = patch_ops(
        client, 2, {"op": "place", "id": second, "layout": {"colSpan": 16}}
    )

    assert response.status_code == 200
    nodes = json.loads(canvas.definition)["nodes"]
    assert nodes[first]["layout"] == {"colSpan": 8}
    assert nodes[second]["layout"] == {"colSpan": 16}


def test_overlapping_stale_write_is_rejected(
    client: Any, full_api_access: None, canvas: Any, published: MagicMock
) -> None:
    node_id = patch_ops(client, 1, add("chart-1")).json["result"]["ops"][0]["id"]
    assert patch_ops(client, 2, {"op": "remove", "id": node_id}).status_code == 200

    response = patch_ops(
        client, 2, {"op": "place", "id": node_id, "layout": {"colSpan": 8}}
    )

    assert response.status_code == 409
    assert response.json == {
        "message": "Placements you edited were changed since your revision.",
        "revision": 3,
        "conflicts": [node_id],
        "stale": False,
    }


def test_write_from_the_future_is_stale(
    client: Any, full_api_access: None, canvas: Any, published: MagicMock
) -> None:
    response = patch_ops(client, 7, add("chart-1"))

    assert response.status_code == 409
    assert response.json["stale"] is True


def test_caller_ids_let_one_request_build_a_nested_layout(
    client: Any, full_api_access: None, canvas: Any, published: MagicMock
) -> None:
    group_id = "6f1c2b7e-2d4a-4c1e-9a53-0f3b8d2e7a10"

    response = patch_ops(
        client,
        1,
        add("group", id=group_id),
        add("chart-1", parent=group_id),
        add("chart-2", parent=group_id),
    )

    assert response.status_code == 200
    assert response.json["result"]["revision"] == 2
    assert response.json["result"]["ops"][0]["id"] == group_id
    nodes = json.loads(canvas.definition)["nodes"]
    assert len(nodes[group_id]["children"]) == 2

    retried = patch_ops(client, 2, add("group", id=group_id))
    assert retried.status_code == 422
    assert canvas.revision == 2


def test_invalid_operation_reports_its_index(
    client: Any, full_api_access: None, canvas: Any, published: MagicMock
) -> None:
    response = patch_ops(client, 1, add("chart-1"), {"op": "remove", "id": "ghost"})

    assert response.status_code == 422
    assert response.json["operation"] == 1
    assert response.json["errors"] == [
        {"path": "/ops/1", "message": "unknown node 'ghost'"}
    ]
    assert canvas.revision == 1
    published.assert_not_called()


def test_invalid_result_reports_paths(
    client: Any, full_api_access: None, canvas: Any, published: MagicMock
) -> None:
    response = patch_ops(client, 1, add("tab"))

    assert response.status_code == 422
    assert response.json["errors"][0]["message"] == (
        "a tab widget cannot be placed in root"
    )


def test_widgets_the_author_cannot_place_are_rejected(
    client: Any, full_api_access: None, canvas: Any, published: MagicMock
) -> None:
    response = patch_ops(client, 1, add("chart-1"), add("chart-secret"))

    assert response.status_code == 422
    assert response.json["errors"] == [
        {
            "path": "/ops/1/widgetId",
            "message": "unknown widget, or no access to it",
        }
    ]


def test_malformed_body(client: Any, full_api_access: None, canvas: Any) -> None:
    response = client.patch(URL, json={"ops": [{"op": "explode"}]})

    assert response.status_code == 400
    paths = {error["path"] for error in response.json["message"]}
    assert "/base_revision" in paths


def test_malformed_op_paths_point_into_the_body(
    client: Any, full_api_access: None, canvas: Any
) -> None:
    response = patch_ops(client, 1, add("chart-1", layout=[]))

    assert response.status_code == 400
    assert response.json["message"][0]["path"] == "/ops/0/layout"


def test_non_editors_cannot_write(
    client: Any,
    full_api_access: None,
    canvas: Any,
    mocker: MockerFixture,
    published: MagicMock,
) -> None:
    mocker.patch(
        "superset.security_manager.raise_for_editorship",
        side_effect=SupersetSecurityException(MagicMock()),
    )

    assert patch_ops(client, 1, add("chart-1")).status_code == 403
    assert client.put(f"{BASE}/100", json={"title": "x"}).status_code == 403
    assert client.delete(f"{BASE}/100").status_code == 403
    assert canvas.revision == 1


def test_users_without_access_see_nothing(
    client: Any,
    full_api_access: None,
    canvas: Any,
    mocker: MockerFixture,
    published: MagicMock,
) -> None:
    patch_ops(client, 1, add("chart-1"))
    # Not an admin, and not an editor or viewer of this canvas.
    mocker.patch(
        "superset.canvas.filters.security_manager.is_admin", return_value=False
    )

    assert client.get(URL).status_code == 404
    assert client.get(f"{URL}/changes?since=1").status_code == 404
    assert patch_ops(client, 2, add("chart-2")).status_code == 404


def test_changes_since_a_pruned_revision_are_stale(
    client: Any,
    full_api_access: None,
    canvas: Any,
    mocker: MockerFixture,
    published: MagicMock,
) -> None:
    mocker.patch("superset.commands.canvas.apply_ops.OP_LOG_RETAINED_REVISIONS", 1)
    patch_ops(client, 1, add("chart-1"))
    patch_ops(client, 2, add("chart-2"))

    assert client.get(f"{URL}/changes?since=1").status_code == 409
    assert client.get(f"{URL}/changes?since=2").status_code == 200
    assert client.get(f"{URL}/changes?since=3").json["result"]["changes"] == []


def test_definition_from_a_newer_superset_is_refused(
    client: Any, full_api_access: None, canvas: Any, published: MagicMock
) -> None:
    canvas.definition = json.dumps({**json.loads(canvas.definition), "version": 99})

    for response in (client.get(URL), patch_ops(client, 1, add("chart-1"))):
        assert response.status_code == 422
        assert "Upgrade Superset" in response.json["message"]
    assert canvas.revision == 1


def test_definition_routes_take_the_canvas_uuid(
    client: Any, full_api_access: None, canvas: Any, published: MagicMock
) -> None:
    url = f"{BASE}/{canvas.uuid}/definition"

    assert client.get(url).status_code == 200
    response = client.patch(url, json={"base_revision": 1, "ops": [add("chart-1")]})
    assert response.status_code == 200
    assert client.get(f"{url}/changes?since=1").json["result"]["revision"] == 2


def test_a_definition_from_a_newer_server_is_refused(
    client: Any,
    full_api_access: None,
    canvas: Any,
    published: MagicMock,
    session: Session,
) -> None:
    canvas.definition = json.dumps({**json.loads(canvas.definition), "version": 2})
    session.commit()

    read = client.get(URL)
    write = patch_ops(client, 1, add("chart-1"))

    assert read.status_code == 422
    assert "Upgrade Superset" in read.json["message"]
    assert write.status_code == 422
    assert canvas.revision == 1


def test_schema_is_published(
    client: Any, full_api_access: None, widget_types: FakeResolver
) -> None:
    result = client.get(f"{BASE}/schema").json["result"]

    assert result["version"] == 1
    assert "interactions" in result["definition"]["properties"]
    assert result["operation"]["discriminator"]["propertyName"] == "op"
    assert "colSpan" in result["gridPlacement"]["properties"]
    by_id = {widget["id"]: widget for widget in result["widgets"]}
    assert by_id["tabs"]["acceptedChildren"] == ["tab"]
    assert by_id["filterbar"]["boundsFilterScope"] is False
    assert by_id["chart"]["filterable"] is True
    assert by_id["chart"]["schemaVersion"] == 1
