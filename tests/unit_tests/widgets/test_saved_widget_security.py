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

import uuid
from typing import Any
from unittest.mock import MagicMock

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset.exceptions import SupersetSecurityException
from superset.extensions import appbuilder
from superset.security.guest_token import (
    GuestToken,
    GuestTokenResourceType,
    GuestUser,
)
from superset.security.manager import (
    query_context_modified,
    SupersetSecurityManager,
    widget_context_grants_data_access,
)
from superset.widgets.data import WidgetContext

DATASET_ID = 17
WIDGET_UUID = str(uuid.uuid4())


def _guest(
    resources: list[dict[str, Any]], datasets: list[int] | None = None
) -> GuestUser:
    token: GuestToken = {
        "user": {},
        "resources": resources,  # type: ignore[typeddict-item]
        "rls_rules": [],
        "iat": 0,
        "exp": 9999999999,
    }
    if datasets is not None:
        token["datasets"] = datasets
    return GuestUser(token=token, roles=[])


def _widget_resource(widget_uuid: str = WIDGET_UUID) -> dict[str, Any]:
    return {"type": GuestTokenResourceType.WIDGET, "id": widget_uuid}


def _saved(dataset_id: int = DATASET_ID) -> WidgetContext:
    return WidgetContext(dataset_id, WIDGET_UUID)


def _inline(dataset_id: int = DATASET_ID) -> WidgetContext:
    return WidgetContext(dataset_id)


def _datasource(dataset_id: int = DATASET_ID) -> MagicMock:
    datasource = MagicMock()
    datasource.id = dataset_id
    datasource.type = "table"
    datasource.perm = f"[db].[table](id:{dataset_id})"
    return datasource


def _query_context(
    context: WidgetContext | Any,
    datasource: MagicMock,
    form_data: dict[str, Any] | None = None,
) -> MagicMock:
    query_context = MagicMock()
    query_context.slice_ = None
    query_context.form_data = form_data or {}
    query_context.datasource = datasource
    query_context.widget_context = context
    return query_context


@pytest.fixture
def sm(app_context: None) -> SupersetSecurityManager:
    return SupersetSecurityManager(appbuilder)


def _as_guest(
    mocker: MockerFixture, sm: SupersetSecurityManager, guest: GuestUser
) -> None:
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=guest)
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch.object(sm, "can_access_schema", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)


def test_widget_context_inline_flag() -> None:
    assert _inline().inline
    assert not _saved().inline


def test_saved_widget_grant_requires_named_resource(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    _as_guest(mocker, sm, _guest([_widget_resource(str(uuid.uuid4()))]))
    assert not sm.guest_widget_grants_datasource(_saved(), _datasource())

    _as_guest(mocker, sm, _guest([_widget_resource(WIDGET_UUID.upper())]))
    assert sm.guest_widget_grants_datasource(_saved(), _datasource())


def test_saved_widget_grant_ignores_datasets_claim(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    _as_guest(mocker, sm, _guest([], datasets=[DATASET_ID]))
    assert not sm.guest_widget_grants_datasource(_saved(), _datasource())


def test_inline_grant_requires_datasets_claim(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    _as_guest(mocker, sm, _guest([_widget_resource()]))
    assert not sm.guest_widget_grants_datasource(_inline(), _datasource())

    _as_guest(mocker, sm, _guest([], datasets=[99]))
    assert not sm.guest_widget_grants_datasource(_inline(), _datasource())

    _as_guest(mocker, sm, _guest([], datasets=[DATASET_ID]))
    assert sm.guest_widget_grants_datasource(_inline(), _datasource())


def test_grant_requires_matching_dataset(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    _as_guest(mocker, sm, _guest([_widget_resource()], datasets=[DATASET_ID, 99]))
    assert not sm.guest_widget_grants_datasource(_saved(), _datasource(99))
    assert not sm.guest_widget_grants_datasource(_inline(), _datasource(99))


def test_grant_is_guest_only(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    assert not sm.guest_widget_grants_datasource(_saved(), _datasource())


def test_server_built_context_is_not_a_modified_payload() -> None:
    assert not query_context_modified(_query_context(_saved(), _datasource()))


def test_raise_for_access_allows_saved_widget_context(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    _as_guest(mocker, sm, _guest([_widget_resource()]))
    sm.raise_for_access(query_context=_query_context(_saved(), _datasource()))


def test_raise_for_access_allows_inline_context_with_claim(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    _as_guest(mocker, sm, _guest([], datasets=[DATASET_ID]))
    sm.raise_for_access(query_context=_query_context(_inline(), _datasource()))


def test_raise_for_access_rejects_inline_without_claim(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    _as_guest(mocker, sm, _guest([_widget_resource()]))
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=_query_context(_inline(), _datasource()))


def test_raise_for_access_rejects_forged_form_data(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    _as_guest(mocker, sm, _guest([_widget_resource()], datasets=[DATASET_ID]))
    forged = _query_context(
        None,
        _datasource(),
        form_data={"widget_context": {"dataset_id": DATASET_ID, "saved": WIDGET_UUID}},
    )
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=forged)


def test_raise_for_access_rejects_duck_typed_marker(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    _as_guest(mocker, sm, _guest([], datasets=[DATASET_ID]))
    fake = MagicMock(dataset_id=DATASET_ID, saved_widget_uuid=None)

    assert not widget_context_grants_data_access(
        sm, _query_context(fake, _datasource()), _datasource()
    )
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=_query_context(fake, _datasource()))


def test_raise_for_access_respects_dataset_allowlist(
    mocker: MockerFixture, sm: SupersetSecurityManager
) -> None:
    _as_guest(mocker, sm, _guest([_widget_resource()], datasets=[99]))
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=_query_context(_saved(), _datasource()))


def test_validate_guest_token_resources_requires_saved_widget(
    mocker: MockerFixture, app_context: None
) -> None:
    find_by_uuid = mocker.patch(
        "superset.daos.saved_widget.SavedWidgetDAO.find_by_uuid", return_value=None
    )
    resources: Any = [{"type": "widget", "id": WIDGET_UUID}]
    with pytest.raises(ValidationError):
        SupersetSecurityManager.validate_guest_token_resources(resources)

    find_by_uuid.return_value = MagicMock()
    SupersetSecurityManager.validate_guest_token_resources(resources)
    SupersetSecurityManager.validate_guest_token_resources([])
