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
"""The semantic layer list shows only layers the caller can open."""

from __future__ import annotations

import uuid
from types import ModuleType
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.dialects import mysql, postgresql, sqlite
from sqlalchemy.orm import Query, Session

from superset import security_manager
from superset.daos.semantic_layer import SemanticLayerDAO
from superset.semantic_layers.models import SemanticLayer

SEMANTIC_LAYERS_APP = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)


def _layers(session: Session) -> tuple[SemanticLayer, SemanticLayer]:
    SemanticLayer.metadata.create_all(session.get_bind())
    allowed: SemanticLayer = SemanticLayer(
        uuid=uuid.uuid4(), name="allowed", type="test", configuration="{}"
    )
    denied: SemanticLayer = SemanticLayer(
        uuid=uuid.uuid4(), name="denied", type="test", configuration="{}"
    )
    session.add_all([allowed, denied])
    session.flush()
    allowed.perm = allowed.get_perm()
    denied.perm = denied.get_perm()
    session.flush()
    return allowed, denied


def _grant(mocker: MockerFixture, grant: str, perms: set[str]) -> None:
    """Patch the caller's grants without touching the access predicate itself."""
    mocker.patch.object(
        security_manager, "can_access_all_databases", return_value=grant == "admin"
    )
    mocker.patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, view: (
            (grant == "all_datasource_access" and permission == view)
            or (permission == "datasource_access" and view in perms)
        ),
    )
    mocker.patch.object(
        security_manager,
        "user_view_menu_names",
        side_effect=lambda permission: (
            perms if permission == "datasource_access" else set()
        ),
    )


@SEMANTIC_LAYERS_APP
@pytest.mark.parametrize(
    "grant, expected",
    [
        ("one_layer", ["allowed"]),
        ("none", []),
        ("admin", ["allowed", "denied"]),
        ("all_datasource_access", ["allowed", "denied"]),
    ],
)
def test_layer_list_matches_layer_access(
    client: Any,
    full_api_access: None,
    session: Session,
    mocker: MockerFixture,
    grant: str,
    expected: list[str],
) -> None:
    """List, connections and detail agree on which layers a caller can see."""
    allowed, denied = _layers(session)
    _grant(mocker, grant, {allowed.perm} if grant == "one_layer" else set())

    response = client.get("/api/v1/semantic_layer/")
    assert response.status_code == 200
    names: list[str] = sorted(row["name"] for row in response.json["result"])
    assert names == expected
    assert len(response.json["result"]) == len(expected)

    connections = client.get(
        "/api/v1/semantic_layer/connections/"
        "?q=(filters:!((col:source_type,opr:eq,value:semantic_layer)))"
    )
    assert connections.status_code == 200
    assert connections.json["count"] == len(expected)
    assert sorted(row["database_name"] for row in connections.json["result"]) == (
        expected
    )

    for layer in (allowed, denied):
        detail = client.get(f"/api/v1/semantic_layer/{layer.uuid}")
        assert detail.status_code == (200 if layer.name in expected else 403)


@pytest.mark.parametrize(
    "grant, expected", [("one_layer", []), ("admin", ["allowed", "denied"])]
)
def test_layer_without_permission_name_listed_only_for_full_access(
    app_context: None,
    session: Session,
    mocker: MockerFixture,
    grant: str,
    expected: list[str],
) -> None:
    """A layer whose permission name is unset is listed only for full access."""
    allowed, _ = _layers(session)
    perm: str = allowed.get_perm()
    allowed.perm = None
    session.flush()
    _grant(mocker, grant, {perm})

    assert sorted(layer.name for layer in SemanticLayerDAO.find_all()) == expected


@pytest.mark.parametrize("perms", [{"[allowed](id:1)"}, set()])
@pytest.mark.parametrize("dialect", [sqlite, postgresql, mysql])
def test_layer_list_query_compiles_for_metadata_databases(
    app_context: None,
    session: Session,
    mocker: MockerFixture,
    dialect: ModuleType,
    perms: set[str],
) -> None:
    """The scoped list query, including an empty grant set, compiles everywhere."""
    _grant(mocker, "one_layer", perms)
    captured: list[Query] = []
    mocker.patch.object(
        Query, "all", autospec=True, side_effect=lambda query: captured.append(query)
    )
    SemanticLayerDAO.find_all()
    assert len(captured) == 1
    assert captured[0].column_descriptions[0]["entity"] is SemanticLayer
    sql: str = str(
        captured[0].statement.compile(
            dialect=dialect.dialect(), compile_kwargs={"literal_binds": True}
        )
    )
    assert "semantic_layers.perm IN" in sql
    if perms:
        assert "'[allowed](id:1)'" in sql


def test_layer_list_and_detail_agree_for_real_role_grants(
    app_context: None, session: Session, mocker: MockerFixture
) -> None:
    """Unmocked role lookups give the list and the detail check the same answer."""
    from flask import g
    from flask_appbuilder.security.sqla.models import (
        Permission,
        PermissionView,
        Role,
        User,
        ViewMenu,
    )

    from superset.exceptions import SupersetSecurityException

    User.metadata.create_all(session.get_bind())
    allowed, denied = _layers(session)
    grant: PermissionView | None = (
        session.query(PermissionView)
        .join(Permission)
        .join(ViewMenu)
        .filter(Permission.name == "datasource_access", ViewMenu.name == allowed.perm)
        .one_or_none()
    )
    assert grant is not None, "creating a layer registers its access permission"
    reader: Role = Role(name="layer_reader", permissions=[grant])
    user: User = User(
        username="layer_reader",
        first_name="Layer",
        last_name="Reader",
        email="layer_reader@example.test",
        active=True,
        roles=[reader],
    )
    session.add(user)
    session.flush()
    mocker.patch("flask_login.utils._get_user", return_value=user)
    g.user = user

    assert [layer.name for layer in SemanticLayerDAO.find_all()] == ["allowed"]
    allowed.raise_for_access()
    with pytest.raises(SupersetSecurityException):
        denied.raise_for_access()
