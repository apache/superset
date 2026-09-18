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

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session
from werkzeug.test import TestResponse

from superset import security_manager
from superset.models.core import Database
from superset.semantic_layers.api import SemanticLayerRestApi


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize(
    "grants", [{"Database"}, {"SemanticLayer"}, {"Database", "SemanticLayer"}, set()]
)
@pytest.mark.parametrize("source_type", ["all", "database", "semantic_layer"])
def test_connections_independent_read_permissions(
    client: FlaskClient, mocker: MockerFixture, grants: set[str], source_type: str
) -> None:
    """Denied sources are never queried and cannot contribute metadata or counts."""
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    mocker.patch(
        "superset.views.base_api.current_user", SimpleNamespace(is_authenticated=True)
    )
    mocker.patch(
        "flask_appbuilder.security.decorators.current_user",
        SimpleNamespace(is_authenticated=True),
    )
    mocker.patch.object(
        security_manager,
        "has_access",
        side_effect=lambda permission, view: (
            permission == "can_read" and view in grants
        ),
    )
    query: MagicMock = mocker.patch("superset.semantic_layers.api.db.session.query")
    query.return_value.options.return_value.all.return_value = []
    query.return_value.options.return_value.filter.return_value.all.return_value = []
    mocker.patch.object(security_manager, "can_access_all_databases", return_value=True)
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    )
    response: TestResponse = client.get(
        f"/api/v1/semantic_layer/connections/?q=(filters:!((col:source_type,opr:eq,value:{source_type})))"
    )
    assert response.status_code == (200 if grants else 403)
    if grants:
        assert response.json == {"count": 0, "result": []}
    expected: int = int(
        "Database" in grants and source_type in {"all", "database"}
    ) + int("SemanticLayer" in grants and source_type in {"all", "semantic_layer"})
    assert query.call_count == expected


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize(
    "grant_kind",
    [
        "database_access",
        "catalog_access",
        "schema_access",
        "datasource_access",
        "admin",
        "none",
    ],
)
def test_connections_database_scope_and_admin_dynamic_filter(
    app_context: None, session: Session, mocker: MockerFixture, grant_kind: str
) -> None:
    """Execute the ordinary DatabaseFilter against real A/B rows, including Admin."""
    from flask import current_app

    Database.metadata.create_all(session.get_bind())
    allowed: Database = Database(database_name="allowed_a", sqlalchemy_uri="sqlite://")
    denied: Database = Database(database_name="denied_b", sqlalchemy_uri="sqlite://")
    session.add_all([allowed, denied])
    session.flush()
    mocker.patch("superset.semantic_layers.api.db.session", session)
    mocker.patch.object(
        security_manager,
        "has_access",
        side_effect=lambda permission, view: view == "Database",
    )
    mocker.patch.object(
        security_manager, "can_access_all_databases", return_value=grant_kind == "admin"
    )
    permissions: dict[str, set[str]] = {
        "database_access": {allowed.perm},
        "catalog_access": {"[allowed_a].[catalog]"},
        "schema_access": {"[allowed_a].[catalog].[schema]"},
        "datasource_access": {"[allowed_a].[catalog].[schema].[table](id:1)"},
    }
    mocker.patch.object(
        security_manager,
        "user_view_menu_names",
        side_effect=lambda permission: (
            permissions.get(permission, set()) if permission == grant_kind else set()
        ),
    )
    mocker.patch.dict(
        current_app.config,
        {
            "EXTRA_DYNAMIC_QUERY_FILTERS": {
                "databases": lambda query: query.filter(
                    Database.database_name == "allowed_a"
                )
            }
            if grant_kind == "admin"
            else {}
        },
    )
    items: list[tuple[str, Database]] = SemanticLayerRestApi._fetch_connection_items(
        "database", None
    )
    assert [row.database_name for _, row in items] == (
        [] if grant_kind == "none" else ["allowed_a"]
    )
    session.rollback()


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": False}}], indirect=True
)
def test_connections_feature_off(client: FlaskClient, full_api_access: None) -> None:
    """The combined connection API remains unavailable with the flag disabled."""
    assert client.get("/api/v1/semantic_layer/connections/").status_code == 404


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize(
    "mode", ["session", "jwt", "key", "invalid_key", "public", "authenticated_no_grant"]
)
def test_connections_authentication_paths(
    app_context: None, client: FlaskClient, mocker: MockerFixture, mode: str
) -> None:
    """The OR gate preserves FAB authentication and rejects invalid credentials."""
    from flask import current_app

    mocker.patch.object(
        security_manager,
        "is_item_public",
        side_effect=lambda permission, view: (
            mode == "public" and view == "SemanticLayer"
        ),
    )
    mocker.patch.object(
        security_manager,
        "has_access",
        side_effect=lambda permission, view: (
            mode != "authenticated_no_grant" and view == "SemanticLayer"
        ),
    )
    mocker.patch(
        "superset.views.base_api.current_user",
        SimpleNamespace(is_authenticated=mode in {"session", "authenticated_no_grant"}),
    )
    verify: MagicMock = mocker.patch("superset.views.base_api.verify_jwt_in_request")
    mocker.patch.dict(
        current_app.config, {"FAB_API_KEY_ENABLED": mode in {"key", "invalid_key"}}
    )
    mocker.patch.object(
        security_manager,
        "extract_api_key_from_request",
        return_value="synthetic-invalid-token",
    )
    validate: MagicMock = mocker.patch.object(
        security_manager, "validate_api_key", return_value=mode == "key"
    )
    fetch: MagicMock = mocker.patch.object(
        SemanticLayerRestApi, "_fetch_connection_items", return_value=[]
    )
    response: TestResponse = client.get("/api/v1/semantic_layer/connections/")
    assert response.status_code == (
        401
        if mode == "invalid_key"
        else 403
        if mode == "authenticated_no_grant"
        else 200
    )
    assert fetch.call_count == int(
        mode not in {"invalid_key", "authenticated_no_grant"}
    )
    assert verify.call_count == int(mode == "jwt")
    assert validate.call_count == int(mode in {"key", "invalid_key"})


@pytest.mark.parametrize(
    "app",
    [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": enabled}} for enabled in (False, True)],
    indirect=True,
)
@pytest.mark.parametrize("view", ["Dataset", "SemanticView", "Datasource"])
def test_combined_discovery_requires_source_read_and_semantic_flag(
    client: FlaskClient, mocker: MockerFixture, view: str
) -> None:
    """Dataset reads are flag-independent; semantic discovery requires the flag."""
    from flask import current_app

    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    mocker.patch(
        "superset.views.base_api.current_user", SimpleNamespace(is_authenticated=True)
    )
    mocker.patch(
        "flask_appbuilder.security.decorators.current_user",
        SimpleNamespace(is_authenticated=True),
    )
    mocker.patch.object(
        security_manager,
        "has_access",
        side_effect=lambda permission, name: name == view,
    )
    mocker.patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, name: name == view,
    )
    command: MagicMock = mocker.patch(
        "superset.datasource.api.GetCombinedDatasourceListCommand"
    )
    command.return_value.run.return_value = {"count": 0, "result": []}
    response: TestResponse = client.get("/api/v1/datasource/")
    if view == "Datasource" or (
        view == "SemanticView"
        and not current_app.config["FEATURE_FLAGS"]["SEMANTIC_LAYERS"]
    ):
        assert response.status_code == 403
        command.assert_not_called()
        return
    assert response.status_code == 200
    command.assert_called_once_with(
        args={},
        can_read_datasets=view == "Dataset",
        can_read_semantic_views=view == "SemanticView",
    )


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
def test_connections_response_counts_only_permitted_rows(
    app_context: None, client: FlaskClient, session: Session, mocker: MockerFixture
) -> None:
    """Database and layer restrictions apply before combined counts and pagination."""
    from superset.semantic_layers.models import SemanticLayer

    Database.metadata.create_all(session.get_bind())
    allowed: Database = Database(database_name="allowed_a", sqlalchemy_uri="sqlite://")
    denied: Database = Database(database_name="denied_b", sqlalchemy_uri="sqlite://")
    allowed_layer: SemanticLayer = SemanticLayer(
        name="allowed_layer",
        type="unregistered",
        configuration="{}",
        perm="[allowed_layer]",
    )
    denied_layer: SemanticLayer = SemanticLayer(
        name="denied_layer",
        type="unregistered",
        configuration="{}",
        perm="[denied_layer]",
    )
    session.add_all([allowed, denied, allowed_layer, denied_layer])
    session.flush()
    mocker.patch("superset.semantic_layers.api.db.session", session)
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    mocker.patch(
        "superset.views.base_api.current_user", SimpleNamespace(is_authenticated=True)
    )
    mocker.patch(
        "flask_appbuilder.security.decorators.current_user",
        SimpleNamespace(is_authenticated=True),
    )
    mocker.patch.object(security_manager, "has_access", return_value=True)
    mocker.patch.object(
        security_manager, "can_access_all_databases", return_value=False
    )
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=False
    )
    grants: dict[str, set[str]] = {
        "database_access": {allowed.perm},
        "datasource_access": {allowed_layer.perm},
    }
    mocker.patch.object(
        security_manager,
        "user_view_menu_names",
        side_effect=lambda permission: grants.get(permission, set()),
    )
    response: TestResponse = client.get(
        "/api/v1/semantic_layer/connections/?q=(order_column:database_name,order_direction:asc,page_size:1)"
    )
    assert response.status_code == 200
    assert response.json["count"] == 2
    assert [item["database_name"] for item in response.json["result"]] == ["allowed_a"]
    assert "denied" not in response.get_data(as_text=True)
    assert "configuration" not in response.json["result"][0]
    session.rollback()


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
def test_connections_without_session_or_bearer_returns_401(
    client: FlaskClient, mocker: MockerFixture
) -> None:
    """Exercise real JWT verification, distinguishing authentication from a 403."""
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    fetch: MagicMock = mocker.patch.object(
        SemanticLayerRestApi, "_fetch_connection_items"
    )
    response: TestResponse = client.get("/api/v1/semantic_layer/connections/")
    assert response.status_code == 401
    fetch.assert_not_called()


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
def test_connections_combines_read_grants_from_separate_roles(
    client: FlaskClient, session: Session, mocker: MockerFixture
) -> None:
    """Real FAB permission lookup combines grants across non-Admin roles."""
    from flask import g
    from flask_appbuilder.security.sqla.models import (
        Permission,
        PermissionView,
        Role,
        User,
        ViewMenu,
    )

    from superset.semantic_layers.models import SemanticLayer

    User.metadata.create_all(session.get_bind())
    read: Permission = Permission(name="can_read")
    database_role: Role = Role(
        name="database_reader",
        permissions=[
            PermissionView(permission=read, view_menu=ViewMenu(name="Database"))
        ],
    )
    layer_role: Role = Role(
        name="layer_reader",
        permissions=[
            PermissionView(permission=read, view_menu=ViewMenu(name="SemanticLayer"))
        ],
    )
    user: User = User(
        username="split_reader",
        first_name="Split",
        last_name="Reader",
        email="split@example.test",
        active=True,
        roles=[database_role, layer_role],
    )
    session.add(user)
    session.flush()
    mocker.patch("flask_login.utils._get_user", return_value=user)
    g.user = user
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    mocker.patch.object(security_manager, "can_access_all_databases", return_value=True)
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    )
    query: MagicMock = MagicMock()
    query.return_value.options.return_value.all.return_value = []
    query.return_value.options.return_value.filter.return_value.all.return_value = []
    mocker.patch(
        "superset.semantic_layers.api.db",
        SimpleNamespace(session=SimpleNamespace(query=query)),
    )
    response: TestResponse = client.get("/api/v1/semantic_layer/connections/")
    assert response.status_code == 200
    assert response.json == {"count": 0, "result": []}
    assert {call.args[0] for call in query.call_args_list} == {Database, SemanticLayer}
    assert query.call_count == 2
    session.rollback()
