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

from datetime import datetime
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from flask import Flask, g
from flask.testing import FlaskClient
from flask_appbuilder.security.sqla.models import (
    Permission,
    PermissionView,
    Role,
    User,
    ViewMenu,
)
from pytest_mock import MockerFixture
from sqlalchemy import event
from sqlalchemy.orm import Session
from werkzeug.test import TestResponse

from superset import security_manager
from superset.commands.datasource.list import GetCombinedDatasourceListCommand
from superset.daos.datasource import DatasourceDAO
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.subjects import utils as subject_utils


@pytest.mark.parametrize(
    "admin,creator,extra_editor,write,data_access,expected",
    [
        (True, False, False, True, True, True),
        (False, True, False, True, True, True),
        (False, False, False, True, True, False),
        (False, False, True, True, True, True),
        (False, True, True, False, True, False),
        (False, True, True, True, False, False),
    ],
    ids=[
        "admin",
        "creator",
        "unrelated-alpha",
        "extra-editor",
        "no-write",
        "no-data-access",
    ],
)
def test_combined_api_semantic_modify_eligibility(
    app: Flask,
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    admin: bool,
    creator: bool,
    extra_editor: bool,
    write: bool,
    data_access: bool,
    expected: bool,
) -> None:
    """The list uses real editorship/creator rules, not an admin-only proxy."""
    user: User = User(id=42, username="reader")
    view: SemanticView = SemanticView(
        id=7,
        uuid=uuid4(),
        name="orders",
        configuration="{}",
        created_by=user if creator else User(id=43, username="creator"),
        changed_on=datetime(2026, 1, 1),
        semantic_layer=SemanticLayer(uuid=uuid4(), name="layer", type="test"),
    )
    mocker.patch("superset.datasource.api.is_feature_enabled", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=admin)
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    mocker.patch.object(security_manager, "raise_for_unsupported_guest_rls")
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=data_access
    )
    mocker.patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, resource: (
            permission == "can_read"
            or (permission == "can_write" and resource == "SemanticView" and write)
        ),
    )
    mocker.patch("superset.security.manager.get_user_id", return_value=42)
    mocker.patch("superset.subjects.utils.get_user_subject_ids", return_value=[71])
    # Keep the real write-command helper and security manager editorship path.
    mocker.patch(
        "superset.commands.utils.security_manager",
        SimpleNamespace(
            current_user=user,
            raise_for_editorship=security_manager.raise_for_editorship,
        ),
    )
    resolver: MagicMock = MagicMock(return_value=[71] if extra_editor else [])
    mocker.patch.dict(app.config, {"EXTRA_EDITORS_RESOLVER": resolver})
    mocker.patch.object(DatasourceDAO, "build_dataset_query", return_value=MagicMock())
    mocker.patch.object(
        DatasourceDAO, "build_semantic_view_query", return_value=MagicMock()
    )
    mocker.patch.object(
        DatasourceDAO,
        "paginate_combined_query",
        return_value=(1, [SimpleNamespace(item_id=7, source_type="semantic_layer")]),
    )
    mocker.patch.object(DatasourceDAO, "fetch_datasets_by_ids", return_value={})
    mocker.patch.object(
        DatasourceDAO, "fetch_semantic_views_by_ids", return_value={7: view}
    )

    response: TestResponse = client.get(
        '/api/v1/datasource/?q={"filters":[{"col":"source_type","opr":"eq","value":"semantic_layer"}]}'
    )

    assert response.status_code == 200
    assert response.json is not None
    row: dict[str, object] = response.json["result"][0]
    assert row["can_modify"] is expected
    assert "created_by" not in row
    assert "extra_editors" not in row
    if extra_editor and write and data_access:
        resolver.assert_called_once_with(view)


@pytest.mark.parametrize("size", [1, 25])
def test_semantic_list_query_count(
    session: Session, app: Flask, mocker: MockerFixture, size: int
) -> None:
    """Distinct creators/layers must not introduce one lazy query per view."""
    SemanticView.metadata.create_all(session.get_bind())
    views: list[SemanticView] = [
        SemanticView(
            name=f"view-{i}",
            configuration="{}",
            created_by=User(
                username=f"creator-{i}",
                first_name="Creator",
                last_name=str(i),
                email=f"creator-{i}@example.com",
            ),
            semantic_layer=SemanticLayer(name=f"layer-{i}", type="test"),
        )
        for i in range(size)
    ]
    session.add_all(views)
    session.flush()
    session.expunge_all()
    mocker.patch.object(security_manager, "is_admin", return_value=False)
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    mocker.patch.object(security_manager, "raise_for_unsupported_guest_rls")
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    )
    mocker.patch("superset.security.manager.get_user_id", return_value=42)
    subject_query: MagicMock = mocker.spy(subject_utils, "_query_user_subject_ids")
    mocker.patch(
        "superset.commands.utils.security_manager",
        SimpleNamespace(
            current_user=User(id=9999),
            raise_for_editorship=security_manager.raise_for_editorship,
        ),
    )
    mocker.patch.dict(app.config, {"EXTRA_EDITORS_RESOLVER": None})
    statements: list[str] = []

    def record_sql(
        connection: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Count the complete paginated read, excluding fixture setup."""
        statements.append(statement)

    event.listen(session.get_bind(), "before_cursor_execute", record_sql)
    try:
        with app.test_request_context():
            result: dict[str, Any] = GetCombinedDatasourceListCommand(
                {"page_size": size}, False, True
            ).run()
    finally:
        event.remove(session.get_bind(), "before_cursor_execute", record_sql)
    assert len(result["result"]) == size
    assert all(row["can_modify"] is False for row in result["result"])
    assert len(statements) == 4, statements
    subject_query.assert_called_once_with(42)


@pytest.mark.parametrize("size", [1, 25])
def test_real_permission_query_count(
    session: Session, app: Flask, mocker: MockerFixture, size: int
) -> None:
    """Repeated FAB permission checks must not add SQL for every listed view."""
    SemanticView.metadata.create_all(session.get_bind())
    role: Role = Role(
        name="ListWriter",
        permissions=[
            PermissionView(
                permission=Permission(name=permission), view_menu=ViewMenu(name=view)
            )
            for permission, view in [
                ("can_write", "SemanticView"),
                ("all_datasource_access", "all_datasource_access"),
            ]
        ],
    )
    reader: User = User(
        username="reader",
        first_name="R",
        last_name="R",
        email="reader@example.com",
        roles=[role],
    )
    session.add(reader)
    views: list[SemanticView] = [
        SemanticView(
            name=f"view-{i}",
            configuration="{}",
            created_by=User(
                username=f"creator-{i}",
                first_name="C",
                last_name=str(i),
                email=f"c{i}@example.com",
            ),
            semantic_layer=SemanticLayer(name=f"layer-{i}", type="test"),
        )
        for i in range(size)
    ]
    session.add_all(views)
    session.flush()
    reader_id: int = reader.id
    session.expunge_all()
    mocker.patch.dict(app.config, {"EXTRA_EDITORS_RESOLVER": None})
    statements: list[str] = []

    def record_sql(
        connection: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Observe actual SQL, including all permission lookups."""
        statements.append(statement)

    with app.test_request_context():
        g.user = session.get(User, reader_id)
        # Authentication loads the principal before the measured list command.
        assert g.user is not None
        list(g.user.roles)
        list(g.user.groups)
        event.listen(session.get_bind(), "before_cursor_execute", record_sql)
        try:
            result: dict[str, Any] = GetCombinedDatasourceListCommand(
                {"page_size": size}, False, True
            ).run()
        finally:
            event.remove(session.get_bind(), "before_cursor_execute", record_sql)
    assert len(result["result"]) == size
    assert all(row["can_modify"] is False for row in result["result"])
    assert len(statements) <= 11, statements


def test_permission_memo_is_scoped_to_serialization_and_principal(
    app: Flask, mocker: MockerFixture
) -> None:
    """Cached grants cannot cross a principal switch or survive a failed read."""
    lookup: MagicMock = mocker.patch.object(
        security_manager, "_has_view_access", side_effect=[True, False, False, True]
    )
    first: User = User(id=41)
    second: User = User(id=42)

    def failing_serialization() -> None:
        """Exercise memo hits and a principal switch before an exception."""
        with security_manager.cache_permission_checks():
            assert security_manager.can_access("can_write", "SemanticView")
            assert security_manager.can_access("can_write", "SemanticView")
            g.user = second
            assert not security_manager.can_access("can_write", "SemanticView")
            g.user = first
            raise ValueError("serialization")

    with app.test_request_context():
        g.user = first
        with pytest.raises(ValueError, match="serialization"):
            failing_serialization()
        assert not hasattr(g, "_permission_check_cache")
        assert not security_manager.can_access("can_write", "SemanticView")
        with security_manager.cache_permission_checks():
            assert security_manager.can_access("can_write", "SemanticView")
    assert lookup.call_count == 4
