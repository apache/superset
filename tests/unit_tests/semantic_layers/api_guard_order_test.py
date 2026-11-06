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

"""Semantic API authorization precedes the runtime feature decision."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any
from unittest.mock import MagicMock

import pytest
from flask.testing import FlaskClient
from flask_appbuilder.security.sqla.models import (
    Permission,
    PermissionView,
    Role,
    User,
    ViewMenu,
)
from flask_login import AnonymousUserMixin, LoginManager
from pytest_mock import MockerFixture
from werkzeug.routing import Rule
from werkzeug.test import TestResponse

from superset import feature_flag_manager, security_manager
from superset.app import SupersetApp
from superset.security.guest_token import GuestToken, GuestUser
from superset.semantic_layers.models import SemanticView

# Each method/path pair is exercised through Flask, including implicit HEAD.
ROUTES: tuple[tuple[str, str], ...] = (
    ("GET", "/api/v1/semantic_view/17/structure"),
    ("HEAD", "/api/v1/semantic_view/17/structure"),
    ("POST", "/api/v1/semantic_view/"),
    ("PUT", "/api/v1/semantic_view/17"),
    ("DELETE", "/api/v1/semantic_view/17"),
    ("DELETE", "/api/v1/semantic_view/"),
    ("GET", "/api/v1/semantic_layer/types"),
    ("HEAD", "/api/v1/semantic_layer/types"),
    ("POST", "/api/v1/semantic_layer/schema/configuration"),
    ("POST", "/api/v1/semantic_layer/test-layer/schema/runtime"),
    ("POST", "/api/v1/semantic_layer/test-layer/views"),
    ("POST", "/api/v1/semantic_layer/"),
    ("PUT", "/api/v1/semantic_layer/test-layer"),
    ("POST", "/api/v1/semantic_layer/test-layer/clear_cache"),
    ("DELETE", "/api/v1/semantic_layer/test-layer"),
    ("GET", "/api/v1/semantic_layer/connections/"),
    ("HEAD", "/api/v1/semantic_layer/connections/"),
    ("GET", "/api/v1/semantic_layer/"),
    ("HEAD", "/api/v1/semantic_layer/"),
    ("GET", "/api/v1/semantic_layer/test-layer"),
    ("HEAD", "/api/v1/semantic_layer/test-layer"),
)


@pytest.fixture
def semantic_decision(mocker: MockerFixture) -> MagicMock:
    """Exercise the real feature manager's host callback on every request."""
    decision: MagicMock = MagicMock(return_value=False)

    def resolve(name: str, default: bool) -> bool:
        return bool(decision()) if name == "SEMANTIC_LAYERS" else default

    # Patch the host callback, preserving the real feature manager resolution.
    mocker.patch.object(feature_flag_manager, "_is_feature_enabled_func", resolve)
    return decision


@pytest.fixture
def set_principal(
    mocker: MockerFixture,
) -> Callable[[str, bool], None]:
    """Supply identities and grants without replacing FAB's permission checks."""

    def configure(kind: str, permitted: bool) -> None:
        role: Role = Role(name="SemanticReader", permissions=[])
        public: Role = Role(name="Public", permissions=[])
        if kind == "public" and permitted:
            public.permissions = [
                PermissionView(
                    permission=Permission(name="can_read"),
                    view_menu=ViewMenu(name="SemanticView"),
                )
            ]
        mocker.patch.object(security_manager, "get_public_role", return_value=public)
        mocker.patch.object(
            security_manager,
            "get_public_permissions",
            return_value=public.permissions,
        )
        # FAB's real built-in role matcher avoids persisting users in a unit test.
        mocker.patch.dict(
            security_manager.builtin_roles,
            {
                role.name: [
                    ("^(SemanticView|SemanticLayer|Database)$", "^can_(read|write)$")
                ],
            },
        )
        roles: list[Role] = [role] if permitted else []
        user: User | AnonymousUserMixin
        if kind == "guest":
            token: GuestToken = {
                "user": {"username": "embedded"},
                "resources": [],
                "rls_rules": [],
                "iat": 0,
                "exp": 1,
            }
            user = GuestUser(token, roles)
        elif kind == "signed_in":
            user = User(id=17, username="reader", active=True, roles=roles)
        else:
            user = AnonymousUserMixin()
        # Replace only identity loading; keep real FAB authorization and restore
        # the callback after each test instead of accumulating public loaders.
        login_manager: LoginManager = security_manager.lm
        mocker.patch.object(login_manager, "_request_callback", return_value=user)

    return configure


@pytest.mark.parametrize("method,path", ROUTES)
@pytest.mark.parametrize(
    "kind,status", [("anonymous", 401), ("signed_in", 403), ("guest", 403)]
)
def test_denied_request_never_reads_feature_state(
    client: FlaskClient[Any],
    set_principal: Callable[[str, bool], None],
    semantic_decision: MagicMock,
    method: str,
    path: str,
    kind: str,
    status: int,
) -> None:
    """Every exposed route denies before observing semantic availability."""
    set_principal(kind, False)
    responses: list[TestResponse] = []
    enabled: bool
    for enabled in (True, False):
        semantic_decision.return_value = enabled
        responses.append(client.open(path, method=method))
    assert [response.status_code for response in responses] == [status, status]
    assert responses[0].data == responses[1].data
    semantic_decision.assert_not_called()


@pytest.mark.parametrize("method,path", ROUTES)
def test_permitted_disabled_request_never_queries_metadata(
    client: FlaskClient[Any],
    set_principal: Callable[[str, bool], None],
    semantic_decision: MagicMock,
    mocker: MockerFixture,
    method: str,
    path: str,
) -> None:
    """All registered handlers refuse before parsing or looking up resources."""
    set_principal("signed_in", True)
    query: MagicMock = mocker.patch("superset.semantic_layers.api.db.session.query")
    response: TestResponse = client.open(path, method=method)
    assert response.status_code == 404
    if method != "HEAD":
        assert response.json == {"message": "Not found"}
    query.assert_not_called()
    semantic_decision.assert_called_once_with()


def test_every_registered_route_is_in_guard_matrix(app: SupersetApp) -> None:
    """The matrix covers every exposed method, including inherited FAB routes."""
    expected: set[tuple[str, str]] = set()
    rule: Rule
    method: str
    for rule in app.url_map.iter_rules():
        if rule.endpoint.split(".")[0] in {
            "SemanticViewRestApi",
            "SemanticLayerRestApi",
        }:
            for method in rule.methods or set():
                if method != "OPTIONS":
                    expected.add(
                        (
                            method,
                            rule.rule.replace("<int:pk>", "17").replace(
                                "<uuid>", "test-layer"
                            ),
                        )
                    )
    assert set(ROUTES) == expected


@pytest.mark.parametrize("path", sorted({path for _, path in ROUTES}))
def test_automatic_options_is_independent_of_feature_state(
    client: FlaskClient[Any],
    semantic_decision: MagicMock,
    path: str,
) -> None:
    """Flask's automatic OPTIONS reports methods without dispatching a handler."""
    enabled: bool
    responses: list[TestResponse] = []
    for enabled in (True, False):
        semantic_decision.return_value = enabled
        responses.append(client.options(path))
    assert [response.status_code for response in responses] == [200, 200]
    assert responses[0].headers["Allow"] == responses[1].headers["Allow"]
    assert responses[0].data == responses[1].data == b""
    semantic_decision.assert_not_called()


@pytest.mark.parametrize("kind", ["public", "signed_in", "guest"])
def test_permitted_structure_tracks_runtime_toggle(
    client: FlaskClient[Any],
    set_principal: Callable[[str, bool], None],
    semantic_decision: MagicMock,
    mocker: MockerFixture,
    kind: str,
) -> None:
    """A Public grant and authenticated grants reach the same guarded handler."""
    set_principal(kind, True)
    view: MagicMock = MagicMock(spec=SemanticView)
    view.name = "orders"
    view.description = None
    view.cache_timeout = None
    view.implementation.selection_identity_version = 1
    view.implementation.get_dimensions.return_value = []
    view.implementation.get_metrics.return_value = []
    query: MagicMock = mocker.patch("superset.semantic_layers.api.db.session.query")
    query.return_value.filter_by.return_value.first.return_value = view
    semantic_decision.return_value = True
    response: TestResponse = client.get("/api/v1/semantic_view/17/structure")
    assert response.status_code == 200
    assert response.json["result"]["name"] == "orders"
    view.raise_for_access.assert_called_once_with()
    semantic_decision.assert_called_once_with()
    semantic_decision.reset_mock()
    query.reset_mock()
    view.reset_mock()
    semantic_decision.return_value = False
    response = client.get("/api/v1/semantic_view/17/structure")
    assert response.status_code == 404
    assert response.json == {"message": "Not found"}
    query.assert_not_called()
    view.raise_for_access.assert_not_called()
    semantic_decision.assert_called_once_with()


@pytest.mark.parametrize("kind,status", [("anonymous", 401), ("signed_in", 403)])
@pytest.mark.parametrize("ids", ["!(17,18)", "!(17,999)", "[17.0,18]", "invalid"])
def test_bulk_denial_never_inspects_rows(
    client: FlaskClient[Any],
    set_principal: Callable[[str, bool], None],
    semantic_decision: MagicMock,
    mocker: MockerFixture,
    kind: str,
    status: int,
    ids: str,
) -> None:
    """Mixed or missing IDs and malformed payloads cannot change a route denial."""
    set_principal(kind, False)
    command: MagicMock = mocker.patch(
        "superset.semantic_layers.api.BulkDeleteSemanticViewCommand"
    )
    query: MagicMock = mocker.patch("superset.semantic_layers.api.db.session.query")
    enabled: bool
    for enabled in (True, False):
        semantic_decision.return_value = enabled
        response: TestResponse = client.delete(
            "/api/v1/semantic_view/", query_string={"q": ids}
        )
        assert response.status_code == status
    command.assert_not_called()
    query.assert_not_called()
    semantic_decision.assert_not_called()


@pytest.mark.parametrize("kind", ["public", "signed_in", "guest"])
def test_route_grant_does_not_bypass_view_access(
    client: FlaskClient[Any],
    set_principal: Callable[[str, bool], None],
    semantic_decision: MagicMock,
    mocker: MockerFixture,
    kind: str,
) -> None:
    """An admitted caller still needs the semantic view's datasource permission."""
    set_principal(kind, True)
    semantic_decision.return_value = True
    view: SemanticView = SemanticView(id=17, name="restricted")
    query: MagicMock = mocker.patch("superset.semantic_layers.api.db.session.query")
    query.return_value.filter_by.return_value.first.return_value = view
    response: TestResponse = client.get("/api/v1/semantic_view/17/structure")
    assert response.status_code == 403
    assert "restricted" not in response.get_data(as_text=True)


def test_permitted_bulk_delete_keeps_mixed_row_refusal(
    client: FlaskClient[Any],
    set_principal: Callable[[str, bool], None],
    semantic_decision: MagicMock,
    mocker: MockerFixture,
) -> None:
    """The real bulk command refuses a mixed editable/restricted batch atomically."""
    set_principal("signed_in", True)
    allowed: MagicMock = MagicMock(spec=SemanticView, id=17)
    denied: MagicMock = MagicMock(spec=SemanticView, id=18)
    find: MagicMock = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO.find_by_ids",
        return_value=[allowed, denied],
    )
    delete: MagicMock = mocker.patch(
        "superset.commands.semantic_layer.delete.SemanticViewDAO.delete"
    )

    def can_modify(model: SemanticView) -> bool:
        return model.id == allowed.id

    mocker.patch(
        "superset.commands.semantic_layer.delete.current_user_can_modify_object",
        side_effect=can_modify,
    )
    semantic_decision.return_value = True
    response: TestResponse = client.delete(
        "/api/v1/semantic_view/", query_string={"q": "!(17,18)"}
    )
    assert response.status_code == 403
    assert response.json == {"message": "Forbidden"}
    find.assert_called_once_with([17, 18], id_column="id")
    allowed.raise_for_access.assert_called_once_with()
    denied.raise_for_access.assert_called_once_with()
    delete.assert_not_called()
    find.reset_mock()
    semantic_decision.return_value = False
    response = client.delete("/api/v1/semantic_view/", query_string={"q": "!(17,18)"})
    assert response.status_code == 404
    assert response.json == {"message": "Not found"}
    find.assert_not_called()
    delete.assert_not_called()
