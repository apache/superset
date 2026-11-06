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
"""Unit tests for resource-level authorization in superset/views/datasource/views.py.

Tests use ``inspect.unwrap`` to call the underlying view logic directly,
bypassing the Flask-AppBuilder permission decorator machinery.
"""

import inspect
from typing import Any
from unittest.mock import ANY, call, MagicMock, patch

import pytest
from flask import Flask

from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetSamplesFailedError,
)
from superset.connectors.sqla.models import SqlaTable
from superset.connectors.sqla.partition_mapping import MAX_TRANSFORM_LENGTH
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.sql.parse import Table
from superset.utils import json as superset_json
from superset.utils.error_sanitization import GENERIC_ERROR_MESSAGE
from superset.views.error_handling import handle_api_exception


def _identity_gettext(message: str, **variables: Any) -> str:
    """Typed stand-in for flask-babel's ``_`` in request-less unit tests.

    Interpolates like the real one so a caller passing variables is exercised
    rather than raising on the extra arguments.
    """
    return message % variables if variables else message


def _security_exception() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            message="Access denied",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.WARNING,
        )
    )


def _get_view_func(name: str):
    """Return the unwrapped body of a Datasource view method."""
    from superset.views.datasource.views import Datasource

    return inspect.unwrap(getattr(Datasource, name))


def _view_self() -> MagicMock:
    """Create a minimal stand-in for a Datasource view instance."""
    self = MagicMock()
    self.json_response = MagicMock(return_value="ok")
    return self


def _save_orm_dataset(**overrides: Any) -> MagicMock:
    """Stand-in for the dataset ``save`` loads, defaulting to a physical one.

    Specced on ``SqlaTable`` so it satisfies the dataset check in ``save``.
    """
    return MagicMock(
        spec=SqlaTable,
        **{
            "database_id": 1,
            "table_name": "my_table",
            "schema": "public",
            "catalog": None,
            "sql": None,
            "template_params": None,
            "is_virtual": False,
            "data": {"id": 1},
            **overrides,
        },
    )


def _assert_checked_target(table: Table, payload: dict[str, Any]) -> None:
    """Assert the check ran against the target ``update_from_object`` applies.

    An omitted key lands as ``None``, so the payload alone describes the
    target -- the dataset's stored values never feed into it.
    """
    assert (table.table, table.schema, table.catalog) == (
        payload.get("table_name"),
        payload.get("schema"),
        payload.get("catalog"),
    )


_SAVE_APP = Flask(__name__)


def _run_save(**payload: Any) -> Any:
    """Call the unwrapped ``save`` view with ``payload`` as the request body."""
    with _SAVE_APP.test_request_context(
        "/datasource/save/",
        method="POST",
        data={
            "data": superset_json.dumps(
                {"id": 1, "type": "table", "columns": [], **payload}
            )
        },
    ):
        return _get_view_func("save")(_view_self())


# ---------------------------------------------------------------------------
# Datasource.get
# ---------------------------------------------------------------------------


@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_get_raises_when_access_denied(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """raise_for_access is called and propagates for unauthorised callers."""
    mock_datasource = MagicMock()
    mock_get_datasource.return_value = mock_datasource
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    raw_get = _get_view_func("get")
    with pytest.raises(SupersetSecurityException):
        raw_get(_view_self(), "table", 1)

    mock_security_manager.raise_for_access.assert_called_once_with(
        datasource=mock_datasource
    )


@patch("superset.views.datasource.views.sanitize_datasource_data")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_get_succeeds_for_authorised_user(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_sanitize: MagicMock,
) -> None:
    """raise_for_access is called without raising; sanitized data is returned."""
    mock_datasource = MagicMock()
    mock_datasource.data = {"id": 1}
    mock_get_datasource.return_value = mock_datasource
    mock_security_manager.raise_for_access.return_value = None
    mock_sanitize.return_value = {"id": 1}

    view = _view_self()
    raw_get = _get_view_func("get")
    raw_get(view, "table", 1)

    mock_security_manager.raise_for_access.assert_called_once_with(
        datasource=mock_datasource
    )
    view.json_response.assert_called_once_with({"id": 1})


# ---------------------------------------------------------------------------
# Datasource.external_metadata
# ---------------------------------------------------------------------------


@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_external_metadata_raises_when_access_denied(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    mock_datasource = MagicMock()
    mock_get_datasource.return_value = mock_datasource
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    raw_fn = _get_view_func("external_metadata")
    with pytest.raises(SupersetSecurityException):
        raw_fn(_view_self(), "table", 1)

    mock_security_manager.raise_for_access.assert_called_once_with(
        datasource=mock_datasource
    )


@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_external_metadata_succeeds_for_authorised_user(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    mock_datasource = MagicMock()
    mock_datasource.external_metadata.return_value = [{"name": "col1"}]
    mock_get_datasource.return_value = mock_datasource
    mock_security_manager.raise_for_access.return_value = None

    view = _view_self()
    raw_fn = _get_view_func("external_metadata")
    raw_fn(view, "table", 1)

    mock_security_manager.raise_for_access.assert_called_once_with(
        datasource=mock_datasource
    )
    view.json_response.assert_called_once_with([{"name": "col1"}])


# ---------------------------------------------------------------------------
# Datasource.external_metadata_by_name
# ---------------------------------------------------------------------------


@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.SqlaTable.get_datasource_by_name")
@patch("superset.views.datasource.views.ExternalMetadataSchema")
def test_external_metadata_by_name_known_datasource_raises_when_access_denied(
    mock_schema_cls: MagicMock,
    mock_get_by_name: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """When a datasource exists, raise_for_access(datasource=...) is enforced."""
    params = {
        "database_name": "mydb",
        "schema_name": "public",
        "table_name": "private_table",
    }
    mock_schema_cls.return_value.load.return_value = params

    mock_datasource = MagicMock()
    mock_get_by_name.return_value = mock_datasource
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    raw_fn = _get_view_func("external_metadata_by_name")
    with pytest.raises(SupersetSecurityException):
        raw_fn(_view_self(), rison=params)

    mock_security_manager.raise_for_access.assert_called_once_with(
        datasource=mock_datasource
    )


@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.SqlaTable.get_datasource_by_name")
@patch("superset.views.datasource.views.ExternalMetadataSchema")
@patch("superset.views.datasource.views.db")
def test_external_metadata_by_name_no_datasource_raises_when_access_denied(
    mock_db: MagicMock,
    mock_schema_cls: MagicMock,
    mock_get_by_name: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """When no datasource exists, raise_for_access(database=..., table=...) runs."""
    params = {
        "database_name": "mydb",
        "schema_name": "public",
        "table_name": "new_table",
    }
    mock_schema_cls.return_value.load.return_value = params
    mock_get_by_name.return_value = None

    mock_database = MagicMock()
    mock_db.session.query.return_value.filter_by.return_value.one.return_value = (
        mock_database
    )
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    raw_fn = _get_view_func("external_metadata_by_name")
    with pytest.raises(SupersetSecurityException):
        raw_fn(_view_self(), rison=params)

    mock_security_manager.raise_for_access.assert_called_once()
    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_database
    assert call_kwargs["table"].table == "new_table"
    assert call_kwargs["table"].schema == "public"


# ---------------------------------------------------------------------------
# Datasource.save — editorship bypass prevention
# ---------------------------------------------------------------------------


@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_always_checks_editorship_even_without_editors_field(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """Editorship check runs even when 'editors' is absent from the payload."""
    mock_orm = MagicMock()
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.side_effect = SupersetSecurityException(
        SupersetError(
            message="Not an editor",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.WARNING,
        )
    )

    with pytest.raises(DatasetForbiddenError):
        # 'editors' intentionally omitted
        _run_save(database={"id": 1})

    mock_security_manager.raise_for_editorship.assert_called_once_with(mock_orm)


@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_non_editor_with_editors_field_is_rejected(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """A non-editor cannot use the save endpoint even when supplying an editors list."""
    mock_orm = MagicMock()
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.side_effect = SupersetSecurityException(
        SupersetError(
            message="Not an editor",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.WARNING,
        )
    )

    with pytest.raises(DatasetForbiddenError):
        # editors list supplied by the caller
        _run_save(database={"id": 1}, editors=[99])

    mock_security_manager.raise_for_editorship.assert_called_once_with(mock_orm)


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_rejects_repoint_to_database_without_access(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    ``save`` lets a dataset editor supply a different ``database.id`` in the
    request body. Ownership of the *dataset* being edited
    (``raise_for_editorship``) is not sufficient to repoint it to a new
    database -- the caller must also be authorised for the *new* database,
    checked via ``raise_for_access`` before ``database_id`` is reassigned.
    """
    mock_orm = _save_orm_dataset()
    mock_get_datasource.return_value = mock_orm

    mock_new_database = MagicMock()
    mock_get_database_by_id.return_value = mock_new_database
    # The caller owns the dataset but is not authorised for the new database.
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    payload = {"table_name": "my_table", "schema": "public"}
    with pytest.raises(DatasetForbiddenError):
        # database id 999 stands in for a database the caller has no explicit
        # grant on.
        _run_save(database={"id": 999}, **payload)

    # Ownership of the dataset was checked...
    mock_security_manager.raise_for_editorship.assert_called_once_with(mock_orm)
    # ...and access to the new database was checked too.
    mock_security_manager.raise_for_access.assert_called_once()
    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_new_database
    _assert_checked_target(call_kwargs["table"], payload)
    # The ORM object was NOT repointed since access was denied.
    assert mock_orm.database_id == 1


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize(
    "orm_overrides,payload",
    [
        # The same table carried across the repoint.
        pytest.param(
            {},
            {"table_name": "my_table", "schema": "public"},
            id="table_preserved",
        ),
        # A cross-database repoint can change the table in the same payload,
        # so the check must run against the requested table, not the stale one.
        pytest.param(
            {"table_name": "authorised_table"},
            {"table_name": "secret_table", "schema": "finance"},
            id="table_changed_too",
        ),
    ],
)
def test_save_allows_repoint_to_database_with_access(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
    orm_overrides: dict[str, Any],
    payload: dict[str, Any],
) -> None:
    """
    When the caller is authorised for the new database, ``save`` proceeds to
    repoint ``database_id``, having checked the target the request applies.
    """
    mock_orm = _save_orm_dataset(**orm_overrides)
    mock_get_datasource.return_value = mock_orm

    mock_new_database = MagicMock()
    mock_get_database_by_id.return_value = mock_new_database

    _run_save(database={"id": 999}, **payload)

    mock_security_manager.raise_for_access.assert_called_once()
    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_new_database
    _assert_checked_target(call_kwargs["table"], payload)
    assert mock_orm.database_id == 999


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize(
    "orm_overrides,payload",
    [
        # Keeping the same ``database.id`` while changing
        # ``table_name``/``schema``/``catalog`` still repoints the dataset via
        # ``update_from_object``: editorship of the dataset alone must not let
        # a caller point it at an unauthorised table in the same database.
        pytest.param(
            {"table_name": "authorised_table"},
            {"table_name": "secret_table", "schema": "finance"},
            id="same_database_repoint",
        ),
        # Dropping ``sql`` binds the label to a real table, so the conversion
        # is a repoint even when the label itself is unchanged.
        pytest.param(
            {
                "table_name": "secret_table",
                "schema": "finance",
                "sql": "SELECT 1",
                "is_virtual": True,
            },
            {"table_name": "secret_table", "schema": "finance"},
            id="virtual_becomes_physical",
        ),
        # An omitted key is applied as ``None`` rather than left alone, so it
        # must read as a change and be checked against the target that lands.
        pytest.param(
            {"table_name": "authorised_table"},
            {},
            id="table_key_omitted",
        ),
    ],
)
def test_save_rejects_same_database_repoint_without_access(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
    orm_overrides: dict[str, Any],
    payload: dict[str, Any],
) -> None:
    """
    A save that repoints the dataset within its current database must be
    authorised against the target table the request will actually apply.
    """
    mock_orm = _save_orm_dataset(**orm_overrides)
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    with pytest.raises(DatasetForbiddenError):
        _run_save(database={"id": 1}, **payload)

    mock_security_manager.raise_for_access.assert_called_once()
    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_orm.database
    _assert_checked_target(call_kwargs["table"], payload)
    # No cross-database lookup for a same-database repoint.
    mock_get_database_by_id.assert_not_called()


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize("field", ["sql", "table_name", "schema", "catalog"])
@pytest.mark.parametrize("value", [1, {"a": 1}, ["SELECT 1"], True])
def test_save_rejects_non_string_target_field(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    field: str,
    value: Any,
) -> None:
    """
    The target fields arrive as free-form JSON. A non-string is refused up
    front rather than reaching the access check, which parses ``sql`` and
    renders ``Table`` and so would fail on the type.
    """
    mock_orm = _save_orm_dataset()
    mock_get_datasource.return_value = mock_orm

    response = _run_save(database={"id": 1}, **{field: value})

    assert response.status_code == 422
    assert field in response.get_data(as_text=True)
    mock_security_manager.raise_for_access.assert_not_called()
    mock_orm.update_from_object.assert_not_called()


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_repoint_to_unknown_database_is_rejected(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    A repoint naming a database that does not exist is refused before any
    access check, rather than resolving to ``None`` and skipping one.
    """
    mock_orm = _save_orm_dataset()
    mock_get_datasource.return_value = mock_orm
    mock_get_database_by_id.return_value = None

    response = _run_save(database={"id": 999}, table_name="my_table")

    assert response.status_code == 422
    mock_security_manager.raise_for_access.assert_not_called()
    assert mock_orm.database_id == 1


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize(
    "orm_overrides,payload",
    [
        # A dataset that stays virtual keeps ``table_name`` as a label, so
        # renaming it is not a repoint.
        pytest.param(
            {
                "table_name": "my_virtual_dataset",
                "sql": "SELECT 1",
                "is_virtual": True,
            },
            {
                "table_name": "renamed_virtual_dataset",
                "schema": "public",
                "sql": "SELECT 1",
            },
            id="virtual_dataset_renamed",
        ),
        # ``BaseDatasource.data`` emits an empty schema as ``None``, so a
        # dataset stored with ``schema = ""`` round-trips through the editor as
        # ``None``. That is not a repoint.
        pytest.param(
            {"schema": "", "catalog": ""},
            {"table_name": "my_table", "schema": None, "catalog": None},
            id="empty_schema_round_trip",
        ),
        # A plain save that changes neither the database nor the table (e.g. a
        # column/metric edit); editorship already gates it, and re-checking
        # would be a behavior change.
        pytest.param(
            {},
            {"table_name": "my_table", "schema": "public"},
            id="unchanged_datasource",
        ),
        # Params are compared as execution reads them, so re-serialized JSON
        # with the same values is not a repoint.
        pytest.param(
            {
                "sql": "SELECT * FROM {{ t }}",
                "is_virtual": True,
                "template_params": '{"t": "public.orders"}',
            },
            {
                "table_name": "my_table",
                "schema": "public",
                "sql": "SELECT * FROM {{ t }}",
                "template_params": '{"t":"public.orders"}',
            },
            id="virtual_template_params_reserialized",
        ),
    ],
)
def test_save_skips_table_check_when_not_repointed(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
    orm_overrides: dict[str, Any],
    payload: dict[str, Any],
) -> None:
    """
    A save that does not repoint the dataset at a new physical table must not
    trigger a fresh datasource-access check.
    """
    mock_get_datasource.return_value = _save_orm_dataset(**orm_overrides)

    _run_save(database={"id": 1}, **payload)

    mock_security_manager.raise_for_access.assert_not_called()
    # No cross-database lookup for a same-database save.
    mock_get_database_by_id.assert_not_called()


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize(
    "orm_overrides,payload",
    [
        # Giving a physical dataset SQL converts it to a virtual one, since
        # ``is_virtual`` derives from whether ``sql`` is set.
        pytest.param(
            {},
            {"sql": "SELECT * FROM secret_table", "schema": "public"},
            id="physical_becomes_virtual",
        ),
        # Aiming an already-virtual dataset at different SQL is the same
        # repoint, minus the conversion.
        pytest.param(
            {"sql": "SELECT 1", "is_virtual": True},
            {"sql": "SELECT * FROM secret_table", "schema": "public"},
            id="virtual_sql_replaced",
        ),
        # Unchanged SQL still reads elsewhere when the schema it resolves
        # unqualified names against moves.
        pytest.param(
            {"sql": "SELECT * FROM t", "is_virtual": True},
            {"sql": "SELECT * FROM t", "schema": "finance"},
            id="virtual_schema_moved",
        ),
    ],
)
def test_save_rejects_sql_repoint_without_access(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
    orm_overrides: dict[str, Any],
    payload: dict[str, Any],
) -> None:
    """
    A save that aims the dataset's SQL somewhere new repoints it at whatever
    that SQL reads, so it must be authorised against the SQL rather than
    skipped because the table pointer is unchanged.
    """
    mock_orm = _save_orm_dataset(**orm_overrides)
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    with pytest.raises(DatasetForbiddenError):
        _run_save(database={"id": 1}, table_name="my_table", **payload)

    mock_security_manager.raise_for_access.assert_called_once_with(
        database=mock_orm.database,
        sql=payload["sql"],
        catalog=None,
        schema=payload["schema"],
        template_params={},
        allow_editorship=False,
    )
    mock_get_database_by_id.assert_not_called()


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_checks_both_table_and_sql_on_cross_database_repoint(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    The table and SQL checks are independent, as in ``UpdateDatasetCommand``:
    a save can move the dataset to another database and give it SQL at once,
    and both have to be authorised against the new connection.
    """
    mock_get_datasource.return_value = _save_orm_dataset()
    new_database = mock_get_database_by_id.return_value

    _run_save(
        database={"id": 2},
        table_name="my_table",
        schema="public",
        sql="SELECT * FROM secret_table",
    )

    assert mock_security_manager.raise_for_access.call_args_list == [
        call(database=new_database, table=ANY, allow_editorship=False),
        call(
            database=new_database,
            sql="SELECT * FROM secret_table",
            catalog=None,
            schema="public",
            template_params={},
            allow_editorship=False,
        ),
    ]


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_rejects_template_params_repoint_without_access(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    With the SQL, database, schema and catalog unchanged, new
    ``template_params`` still repoint a templated ``FROM``. The save is
    authorised against the SQL as rendered with the submitted params, without
    the editorship accept, and refused before anything is written.
    """
    mock_orm = _save_orm_dataset(
        sql="SELECT * FROM {{ t }}",
        is_virtual=True,
        template_params='{"t": "public.orders"}',
    )
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    with pytest.raises(DatasetForbiddenError):
        _run_save(
            database={"id": 1},
            table_name="my_table",
            schema="public",
            sql="SELECT * FROM {{ t }}",
            template_params='{"t": "private.secrets"}',
        )

    mock_security_manager.raise_for_access.assert_called_once_with(
        database=mock_orm.database,
        sql="SELECT * FROM {{ t }}",
        catalog=None,
        schema="public",
        template_params={"t": "private.secrets"},
        allow_editorship=False,
    )
    mock_orm.update_from_object.assert_not_called()
    mock_get_database_by_id.assert_not_called()


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize("legacy_params", ['[["t", "v"]]', "{bad", "   ", "42"])
def test_save_metadata_edit_keeps_legacy_template_params(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
    legacy_params: str,
) -> None:
    """
    A metadata-only save that echoes a legacy non-object ``template_params``
    back (unchanged SQL/schema/database) is not a repoint and must not be
    rejected -- no access check runs and nothing is written is blocked.
    """
    mock_orm = _save_orm_dataset(
        sql="SELECT * FROM {{ t }}", is_virtual=True, template_params=legacy_params
    )
    mock_get_datasource.return_value = mock_orm

    response = _run_save(
        database={"id": 1},
        table_name="my_table",
        schema="public",
        sql="SELECT * FROM {{ t }}",
        template_params=legacy_params,
    )

    # Not a repoint -> no access check, and the save proceeds (no 422).
    mock_security_manager.raise_for_access.assert_not_called()
    assert not (hasattr(response, "status_code") and response.status_code == 422)


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_template_params_type_change_is_rechecked(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    Changing only a param's JSON type (``1`` -> ``true``) repoints a templated
    ``FROM`` (Jinja distinguishes them), so the save is re-authorised rather
    than judged unchanged by Python dict equality.
    """
    mock_orm = _save_orm_dataset(
        sql="SELECT * FROM {{ t }}", is_virtual=True, template_params='{"t": 1}'
    )
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    with pytest.raises(DatasetForbiddenError):
        _run_save(
            database={"id": 1},
            table_name="my_table",
            schema="public",
            sql="SELECT * FROM {{ t }}",
            template_params='{"t": true}',
        )

    assert mock_security_manager.raise_for_access.call_args.kwargs[
        "template_params"
    ] == {"t": True}
    mock_orm.update_from_object.assert_not_called()


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_auth_check_drops_reserved_params(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    The repoint check renders with the submitted params minus the names the
    template processor consumes structurally, matching execution.
    """
    mock_orm = _save_orm_dataset(
        sql="SELECT * FROM {{ t }}", is_virtual=True, template_params='{"t": "a"}'
    )
    mock_get_datasource.return_value = mock_orm

    _run_save(
        database={"id": 1},
        table_name="my_table",
        schema="public",
        sql="SELECT * FROM {{ t }}",
        template_params='{"t": "b", "extra_cache_keys": [], "database": "z"}',
    )

    assert mock_security_manager.raise_for_access.call_args.kwargs[
        "template_params"
    ] == {"t": "b"}


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize(
    "template_params",
    ["{bad", '"t"', '["t"]', '[["t", "private.secrets"]]'],
)
def test_save_rejects_unreadable_template_params(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
    template_params: str,
) -> None:
    """
    Params that aren't a JSON object can't be read the way execution reads
    them, so a save carrying SQL refuses them with a 422 -- not a 500, and not
    an access decision made against a guess.
    """
    mock_orm = _save_orm_dataset(
        sql="SELECT * FROM {{ t }}",
        is_virtual=True,
        template_params='{"t": "public.orders"}',
    )
    mock_get_datasource.return_value = mock_orm

    response = _run_save(
        database={"id": 1},
        table_name="my_table",
        schema="public",
        sql="SELECT * FROM {{ t }}",
        template_params=template_params,
    )

    assert response.status_code == 422
    mock_security_manager.raise_for_access.assert_not_called()
    mock_orm.update_from_object.assert_not_called()


@patch("superset.commands.dataset.exceptions._", _identity_gettext)
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_render_error_is_rejected_as_invalid(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    SQL that can't be rendered with the submitted params can't be authorized:
    the save is refused with a 422 instead of surfacing a 500.
    """
    mock_orm = _save_orm_dataset(sql="SELECT {{ p + 1 }}", is_virtual=True)
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_access.side_effect = TypeError(
        'can only concatenate str (not "int") to str'
    )

    response = _run_save(
        database={"id": 1},
        table_name="my_table",
        schema="public",
        sql="SELECT {{ p + 1 }}",
        template_params='{"p": "a"}',
    )

    assert response.status_code == 422
    mock_orm.update_from_object.assert_not_called()


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize(
    "submitted, rendered_with",
    [
        ('{"t": "public.orders"}', {"t": "public.orders"}),
        # Omitted params land as ``None`` and replace the stored ones, which
        # changes what the SQL reads even though nothing was submitted.
        (None, {}),
    ],
)
def test_save_rechecks_when_stored_template_params_unreadable(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
    submitted: str | None,
    rendered_with: dict[str, Any],
) -> None:
    """
    Stored params execution reads differently (a list of pairs reaches Jinja
    through ``dict.update``) never count as unchanged, so the save is
    authorised against the params it applies.
    """
    mock_orm = _save_orm_dataset(
        sql="SELECT * FROM {{ t }}",
        is_virtual=True,
        template_params='[["t", "public.orders"]]',
    )
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    with pytest.raises(DatasetForbiddenError):
        _run_save(
            database={"id": 1},
            table_name="my_table",
            schema="public",
            sql="SELECT * FROM {{ t }}",
            template_params=submitted,
        )

    assert (
        mock_security_manager.raise_for_access.call_args.kwargs["template_params"]
        == rendered_with
    )
    mock_orm.update_from_object.assert_not_called()


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_of_non_dataset_datasource_skips_table_check(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    ``save`` also accepts queries, saved queries and semantic views. Those
    models have no ``table_name``/``is_virtual`` (a query carries a
    ``tmp_table_name`` instead), so the repoint check must not read them.
    """
    # Specced to a query's attribute surface: touching table_name or
    # is_virtual on this mock raises AttributeError.
    mock_orm = MagicMock(
        spec=["database_id", "database", "data", "tmp_table_name", "update_from_object"]
    )
    mock_orm.database_id = 1
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm

    _run_save(type="query", database={"id": 1})

    mock_security_manager.raise_for_access.assert_not_called()
    mock_get_database_by_id.assert_not_called()


def _save_with_transform(
    app: Flask,
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    transform: str,
    stored_transform: str | None = None,
) -> MagicMock:
    """
    Drive ``save`` with the mapped column carrying ``transform``.

    The payload names a partition column and leaves ``event_time`` as the
    default datetime column, so ``event_time`` is the column the mapping
    mirrors. That matters because `drop_unmapped_value_transforms` runs ahead
    of the gate under test: a transform on any *other* column is dropped rather
    than refused, which is its own test below. This asks about the transform the
    request would actually store.

    Takes the configured app rather than a bare ``Flask``, unlike its
    neighbours: a rejection renders a ``SupersetError``, whose issue codes are
    lazy translations, so the request context needs babel initialised.
    """
    from superset.models.core import Database

    stored_column = MagicMock()
    stored_column.column_name = "event_time"
    stored_column.partition_value_transform = stored_transform

    mock_orm = MagicMock()
    mock_orm.database_id = 1
    mock_orm.database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    mock_orm.table_name = "my_table"
    mock_orm.schema = "public"
    mock_orm.catalog = None
    mock_orm.columns = [stored_column]
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None

    raw_save = _get_view_func("save")
    with app.test_request_context(
        "/datasource/save/",
        method="POST",
        data={
            "data": superset_json.dumps(
                {
                    "id": 1,
                    "type": "table",
                    "database": {"id": 1},
                    "main_dttm_col": "event_time",
                    "partition_column": "dt_epoch",
                    "columns": [
                        {
                            "column_name": "event_time",
                            "partition_value_transform": transform,
                        },
                        {"column_name": "dt_epoch"},
                    ],
                }
            )
        },
    ):
        raw_save(_view_self())

    return mock_orm


def _save_with_mapping(
    app: Flask,
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    *,
    partition_column: str,
    partition_mapped_column: str | None = None,
    main_dttm_col: str | None = "event_time",
) -> MagicMock:
    """
    `_save_with_transform` for the mapping's column *references* rather than
    the transform. The feature flag is turned on because the gate under test is
    gated on it, the same way `UpdateDatasetCommand`'s call is.
    """
    from superset.models.core import Database

    stored_column = MagicMock()
    stored_column.column_name = "event_time"
    stored_column.partition_value_transform = None

    mock_orm = MagicMock()
    mock_orm.database_id = 1
    mock_orm.database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    mock_orm.table_name = "my_table"
    mock_orm.schema = "public"
    mock_orm.catalog = None
    mock_orm.columns = [stored_column]
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None

    raw_save = _get_view_func("save")
    original = app.config["DEFAULT_FEATURE_FLAGS"].get("PARTITION_FILTER_MAPPING")
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = True
    try:
        with app.test_request_context(
            "/datasource/save/",
            method="POST",
            data={
                "data": superset_json.dumps(
                    {
                        "id": 1,
                        "type": "table",
                        "database": {"id": 1},
                        "main_dttm_col": main_dttm_col,
                        "partition_column": partition_column,
                        "partition_mapped_column": partition_mapped_column,
                        "columns": [{"column_name": "event_time"}],
                    }
                )
            },
        ):
            raw_save(_view_self())
    finally:
        app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = original

    return mock_orm


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_refuses_a_non_deterministic_value_transform(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    mock_json_error_response: MagicMock,
    app: Flask,
) -> None:
    """
    `stored_expression_error` asks whether the expression may be *run*;
    `validate_transform`'s blocking tier asks whether it may be *stored*. The
    REST PUT and the importer reach both gates and this endpoint reached only
    the first, so `random() + :value` saved with a 200 -- and then failed
    `UpdateDatasetCommand`'s validation on every later edit, including a
    description-only PUT, leaving a dataset that could not be saved again until
    someone edited the transform.
    """
    mock_orm = _save_with_transform(
        app, mock_get_datasource, mock_security_manager, "random() + :value"
    )

    mock_json_error_response.assert_called_once()
    assert mock_json_error_response.call_args.kwargs["status"] == 422
    mock_orm.update_from_object.assert_not_called()


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_refuses_a_partition_column_the_dataset_does_not_have(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    mock_json_error_response: MagicMock,
    app: Flask,
) -> None:
    """
    Its transform sibling was only half the payload. `partition_column` and
    `partition_mapped_column` ride in on `update_from_object` as well, and
    nothing checked them -- so a payload naming a column the dataset does not
    have was stored and answered 200.

    Every later `PUT /api/v1/dataset/<pk>` then failed
    `_validate_partition_mapping` with a column-not-found error, including a
    description-only one, which carries no columns payload and so cannot reach
    the branch that forgives a stored-only dangle. The dataset could not be
    saved from again until someone repaired the reference by hand.
    """
    mock_orm = _save_with_mapping(
        app,
        mock_get_datasource,
        mock_security_manager,
        partition_column="no_such_column",
    )

    mock_json_error_response.assert_called_once()
    assert mock_json_error_response.call_args.kwargs["status"] == 422
    mock_orm.update_from_object.assert_not_called()


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_allows_an_implicit_self_mapping(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    mock_json_error_response: MagicMock,
    app: Flask,
) -> None:
    """
    Only the blocking issues refuse the write. A null override whose
    `main_dttm_col` happens to equal the partition column is Tier 2 in
    `validate_partition_mapping` by design -- blocking it would recreate the
    unsaveable dataset the gate exists to prevent, just from the other side.
    """
    mock_orm = _save_with_mapping(
        app,
        mock_get_datasource,
        mock_security_manager,
        partition_column="event_time",
        main_dttm_col="event_time",
    )

    mock_json_error_response.assert_not_called()
    mock_orm.update_from_object.assert_called_once()


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize(
    "transform",
    [
        "(SELECT password FROM ab_user LIMIT 1) || :value",
        "lower(:value) UNION ALL SELECT password FROM ab_user",
        "lower(:value); DROP TABLE ab_user",
    ],
    ids=["subquery", "set-operation", "multi-statement"],
)
def test_save_refuses_a_value_transform_that_is_not_a_storable_expression(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    mock_json_error_response: MagicMock,
    transform: str,
    app: Flask,
) -> None:
    """
    ``partition_value_transform`` rides in on ``update_from_object``, which
    writes it straight onto the column -- around ``UpdateDatasetCommand`` and
    the gate it applies. The partition probe later splices that value into SQL
    and runs it, so this deprecated endpoint would otherwise hand arbitrary
    SQL execution to anyone who can edit a dataset.
    """
    mock_orm = _save_with_transform(
        app, mock_get_datasource, mock_security_manager, transform
    )

    mock_json_error_response.assert_called_once()
    assert mock_json_error_response.call_args.kwargs["status"] == 422
    mock_orm.update_from_object.assert_not_called()


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_refuses_a_value_transform_past_the_length_bound(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    mock_json_error_response: MagicMock,
    app: Flask,
) -> None:
    """
    `MAX_TRANSFORM_LENGTH` reaches the other entry points through a marshmallow
    `Length` validator, and this endpoint loads no schema -- it reads
    `request.form["data"]` and writes straight through `update_from_object`.

    So a transform like `lower(` + 1,100 spaces + `:value)` saved here is one
    an export carries and the matching import then refuses on length, leaving a
    dataset that cannot round-trip through its own export. It is also exactly
    the cost the bound exists to prevent: `is_transform_active` parses the
    stored value on every Explore load.
    """
    transform = "lower(" + " " * 1100 + ":value)"
    assert len(transform) > MAX_TRANSFORM_LENGTH

    mock_orm = _save_with_transform(
        app, mock_get_datasource, mock_security_manager, transform
    )

    mock_json_error_response.assert_called_once()
    assert mock_json_error_response.call_args.kwargs["status"] == 422
    mock_orm.update_from_object.assert_not_called()


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_allows_an_ordinary_value_transform(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    mock_json_error_response: MagicMock,
    app: Flask,
) -> None:
    mock_orm = _save_with_transform(
        app, mock_get_datasource, mock_security_manager, "lower(:value)"
    )

    mock_json_error_response.assert_not_called()
    mock_orm.update_from_object.assert_called_once()


def _save_with_parked_transform(
    app: Flask,
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    transform: str,
    *,
    feature_enabled: bool,
    stored_transforms: dict[str, str | None] | None = None,
) -> MagicMock:
    """
    Drive ``save`` with a transform on a column the mapping does not mirror.

    ``event_time`` is the mapped column -- the default datetime column, with no
    override -- so the transform on ``other_time`` is parked: invisible in the
    editor, and live the moment the mapped column resolves back to it.

    ``stored_transforms`` is what the dataset already holds, by column name. It
    matters because the drop exempts an unchanged *echo* of stored
    configuration with the flag off, and the default here stores nothing on
    ``other_time`` -- so the exemption is unreachable unless a caller asks for
    it.

    Returns the ORM mock. The assertions read `update_from_object`'s argument
    rather than the payload built here: the view parses its own dict out of
    ``request.form``, so the one this function holds is never the one corrected.
    """
    from superset.models.core import Database

    stored_columns = []
    for name, stored_transform in (stored_transforms or {"event_time": None}).items():
        stored_column = MagicMock()
        stored_column.column_name = name
        stored_column.partition_value_transform = stored_transform
        stored_column.partition_transform_is_monotonic = stored_transform is not None
        stored_columns.append(stored_column)

    mock_orm = MagicMock()
    mock_orm.database_id = 1
    mock_orm.database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    mock_orm.table_name = "my_table"
    mock_orm.schema = "public"
    mock_orm.catalog = None
    mock_orm.columns = stored_columns
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None

    payload: dict[str, Any] = {
        "id": 1,
        "type": "table",
        "database": {"id": 1},
        "main_dttm_col": "event_time",
        "partition_column": "dt_epoch",
        "partition_mapped_column": None,
        "columns": [
            {"column_name": "event_time"},
            {"column_name": "dt_epoch"},
            {
                "column_name": "other_time",
                "partition_value_transform": transform,
                "partition_transform_is_monotonic": True,
            },
        ],
    }

    raw_save = _get_view_func("save")
    original = app.config["DEFAULT_FEATURE_FLAGS"].get("PARTITION_FILTER_MAPPING")
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = feature_enabled
    try:
        with app.test_request_context(
            "/datasource/save/",
            method="POST",
            data={"data": superset_json.dumps(payload)},
        ):
            raw_save(_view_self())
    finally:
        app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = original

    return mock_orm


def _written_column(mock_orm: MagicMock, column_name: str) -> dict[str, Any]:
    """The column ``update_from_object`` was handed, by name."""
    mock_orm.update_from_object.assert_called_once()
    written = mock_orm.update_from_object.call_args[0][0]
    return next(
        column for column in written["columns"] if column["column_name"] == column_name
    )


@pytest.mark.parametrize("feature_enabled", [True, False])
@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_drops_a_transform_the_mapping_does_not_mirror(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    mock_json_error_response: MagicMock,
    feature_enabled: bool,
    app: Flask,
) -> None:
    """
    NEW-R11-01, this endpoint's half.

    A mapping mirrors one column, so only that column may carry a transform.
    This endpoint writes straight through ``update_from_object``, around the
    model-level pass `DatasetDAO.update` runs, so a transform parked on any
    other column was stored -- invisible, because no row but the mapped one
    renders a transform, and live the moment the mapped column resolved back to
    it. QA reached that from the editor with two clicks and no typing: a range
    filter then returned 181 rows instead of 183 and ``=`` returned 0 instead of
    1, with the pruning indicator still green.

    Both flag states, because the leftover is not the flag's business: unlike
    the model-level pass, which declines with the flag off because it discards
    *stored* configuration, this drops a value the request is asking to write
    -- and the flag-off window is exactly when one gets parked for later.
    """
    mock_orm = _save_with_parked_transform(
        app,
        mock_get_datasource,
        mock_security_manager,
        "to_unixtime(:value)",
        feature_enabled=feature_enabled,
    )

    # Corrected, not refused: the save goes through.
    mock_json_error_response.assert_not_called()
    parked = _written_column(mock_orm, "other_time")
    assert parked["partition_value_transform"] is None
    assert parked["partition_transform_is_monotonic"] is False
    # And only the parked one goes; the mapped column is untouched.
    assert "partition_value_transform" not in _written_column(mock_orm, "event_time")


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_drops_a_parked_transform_rather_than_refusing_it(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    mock_json_error_response: MagicMock,
    app: Flask,
) -> None:
    """
    Why the drop runs ahead of the refusal gate rather than after it.

    A parked transform can be any text at all -- one stored before the gate
    existed, or by a client that never read it. Refused, it would 422 every
    later save of the dataset, including a description-only one, over a value
    nobody asked to keep. There is no field whose edit clears it either: the
    editor renders a transform on the mapped column's row and nowhere else, so
    the owner cannot see it, let alone delete it.

    The sub-query here is the shape the refusal gate exists for, which is what
    makes the point: it is still refused on the mapped column, per
    `test_save_refuses_a_value_transform_that_is_not_a_storable_expression`, and
    dropped on any other.
    """
    mock_orm = _save_with_parked_transform(
        app,
        mock_get_datasource,
        mock_security_manager,
        "(SELECT password FROM ab_user LIMIT 1) || :value",
        feature_enabled=True,
    )

    mock_json_error_response.assert_not_called()
    assert _written_column(mock_orm, "other_time")["partition_value_transform"] is None


@pytest.mark.parametrize(
    "feature_enabled, survives",
    [(True, False), (False, True)],
    ids=["flag-on-drops-the-echo", "flag-off-keeps-the-echo"],
)
@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_exempts_an_echoed_parked_transform_only_while_the_flag_is_off(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    mock_json_error_response: MagicMock,
    feature_enabled: bool,
    survives: bool,
    app: Flask,
) -> None:
    """
    Both halves of the ``stored_by_name`` branch, with ``other_time`` actually
    stored -- which is what makes the exemption reachable at all. The tests
    above store nothing on it, so passing the stored-columns dict
    unconditionally leaves them green while the flag-on behaviour is gone.

    With the flag **off**, an unchanged echo survives: this endpoint's own
    client does GET-then-POST, so a 422 or a silent drop would punish a client
    merely returning the state it was handed, and nothing mirrors anyway.

    With the flag **on** nothing is exempt. No model-level pass runs on this
    path -- the REST path has one -- so exempting the echo left the old mapped
    column holding its transform, and clearing the override through this same
    endpoint later re-armed it.
    """
    transform = "to_unixtime(:value)"
    mock_orm = _save_with_parked_transform(
        app,
        mock_get_datasource,
        mock_security_manager,
        transform,
        feature_enabled=feature_enabled,
        # The echo: stored exactly what the payload sends back, monotonic
        # declaration included, so the two are indistinguishable by value.
        stored_transforms={"event_time": None, "other_time": transform},
    )

    mock_json_error_response.assert_not_called()
    parked = _written_column(mock_orm, "other_time")
    assert parked["partition_value_transform"] == (transform if survives else None)
    assert parked["partition_transform_is_monotonic"] is survives


# ---------------------------------------------------------------------------
# Datasource.samples
# ---------------------------------------------------------------------------


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.get_samples")
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
def test_samples_returns_400_for_unsupported_datasource_type(
    mock_security_manager: MagicMock,
    mock_json_error_response: MagicMock,
    mock_get_samples: MagicMock,
) -> None:
    """Semantic views can't return raw samples — endpoint should refuse with 400."""
    mock_security_manager.is_guest_user.return_value = False
    mock_json_error_response.return_value = "error-response"

    app = Flask(__name__)
    with app.test_request_context(
        "/datasource/samples?datasource_type=semantic_view&datasource_id=1",
        method="POST",
        json={},
    ):
        result = _get_view_func("samples")(_view_self())

    assert result == "error-response"
    mock_json_error_response.assert_called_once()
    _, kwargs = mock_json_error_response.call_args
    assert kwargs.get("status") == 400
    # The bail-out must happen before any sample fetching is attempted.
    mock_get_samples.assert_not_called()


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.get_samples")
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
def test_samples_checks_guest_access_before_datasource_capability(
    mock_security_manager: MagicMock,
    mock_json_error_response: MagicMock,
    mock_get_samples: MagicMock,
) -> None:
    """An unauthorized guest gets 403 before semantic-view capability errors."""
    mock_security_manager.is_guest_user.return_value = True
    mock_json_error_response.return_value = "forbidden-response"

    app = Flask(__name__)
    with app.test_request_context(
        "/datasource/samples?datasource_type=semantic_view&datasource_id=1",
        method="POST",
        json={},
    ):
        result = _get_view_func("samples")(_view_self())

    assert result == "forbidden-response"
    mock_json_error_response.assert_called_once_with("Forbidden", status=403)
    mock_get_samples.assert_not_called()


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.get_samples")
@patch("superset.views.datasource.views.DatasetDAO")
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
def test_samples_guest_with_dashboard_gets_404_for_non_dataset_type(
    mock_security_manager: MagicMock,
    mock_json_error_response: MagicMock,
    mock_dataset_dao: MagicMock,
    mock_get_samples: MagicMock,
) -> None:
    """A guest with a dashboard_id gets 404 for a semantic view, not the 400.

    The 404 must win over the capability 400, and the dataset lookup must not
    run at all: ``datasource_id`` values for non-dataset types live in
    unrelated id spaces, so ``DatasetDAO.find_by_id`` would validate whichever
    unrelated table shares the integer id.
    """
    mock_security_manager.is_guest_user.return_value = True

    view = _view_self()
    app = Flask(__name__)
    with app.test_request_context(
        "/datasource/samples?datasource_type=semantic_view&datasource_id=1"
        "&dashboard_id=5",
        method="POST",
        json={},
    ):
        result = _get_view_func("samples")(view)

    assert result == view.response_404.return_value
    view.response_404.assert_called_once()
    mock_dataset_dao.find_by_id.assert_not_called()
    mock_json_error_response.assert_not_called()
    mock_get_samples.assert_not_called()


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.get_samples")
@patch("superset.views.datasource.views.DashboardDAO")
@patch("superset.views.datasource.views.DatasetDAO")
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
def test_samples_guest_drill_denial_returns_403(
    mock_security_manager: MagicMock,
    mock_json_error_response: MagicMock,
    mock_dataset_dao: MagicMock,
    mock_dashboard_dao: MagicMock,
    mock_get_samples: MagicMock,
) -> None:
    """A guest failing the drill-access check gets 403 from that gate."""
    mock_security_manager.is_guest_user.return_value = True
    mock_security_manager.can_drill_dataset_via_dashboard_access.return_value = False
    mock_json_error_response.return_value = "forbidden-response"

    app = Flask(__name__)
    with app.test_request_context(
        "/datasource/samples?datasource_type=table&datasource_id=1&dashboard_id=5",
        method="POST",
        json={},
    ):
        result = _get_view_func("samples")(_view_self())

    assert result == "forbidden-response"
    mock_security_manager.can_drill_dataset_via_dashboard_access.assert_called_once_with(
        mock_dataset_dao.find_by_id.return_value,
        mock_dashboard_dao.find_by_id.return_value,
    )
    mock_json_error_response.assert_called_once_with("Forbidden", status=403)
    mock_get_samples.assert_not_called()


@patch("superset.views.datasource.views.get_samples")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
def test_samples_proceeds_for_supported_datasource_type(
    mock_security_manager: MagicMock,
    mock_get_samples: MagicMock,
) -> None:
    """A `query` datasource (supports_samples=True) bypasses the 400 short-circuit."""
    mock_security_manager.is_guest_user.return_value = False
    mock_get_samples.return_value = {"rows": []}

    view = _view_self()
    raw_samples = _get_view_func("samples")
    app = Flask(__name__)
    with app.test_request_context(
        "/datasource/samples?datasource_type=query&datasource_id=1",
        method="POST",
        json={},
    ):
        raw_samples(view)

    mock_get_samples.assert_called_once()
    view.json_response.assert_called_once_with({"result": {"rows": []}})


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.get_samples")
@patch("superset.views.datasource.views.DashboardDAO")
@patch("superset.views.datasource.views.DatasetDAO")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
def test_samples_guest_response_is_redacted_by_the_real_helper(
    mock_view_security_manager: MagicMock,
    mock_dataset_dao: MagicMock,
    mock_dashboard_dao: MagicMock,
    mock_get_samples: MagicMock,
    mock_global_security_manager: MagicMock,
) -> None:
    """An embedded guest without "can view query on Dashboard" gets the generated
    SQL stripped from the actual samples response.

    Exercises the real ``redact_sensitive_query_fields`` (not a mock) through the
    guest branch, so a regression that made the redaction a no-op for guests
    would fail here. ``mock_view_security_manager`` drives the view's guest-access
    checks; ``mock_global_security_manager`` is the ``from superset import
    security_manager`` the helper resolves (guest, lacking the permission)."""
    mock_view_security_manager.is_guest_user.return_value = True
    mock_view_security_manager.can_drill_dataset_via_dashboard_access.return_value = (
        True
    )
    # The helper's principal: a guest without "can view query on Dashboard".
    mock_global_security_manager.is_guest_user.return_value = True
    mock_global_security_manager.can_access.return_value = False

    rv = {
        "query": "SELECT secret_col FROM private_table",
        "stacktrace": "Traceback (most recent call last): ...",
        "data": [{"id": 1}],
        "colnames": ["id"],
        "total_count": 1,
    }
    mock_get_samples.return_value = rv

    # Serialize what the view hands to ``json_response`` at call time, as the
    # real ``json_response`` does, so the assertions see what a client receives
    # and would catch the redaction running only after the response is built.
    sent: list[dict[str, Any]] = []
    view = _view_self()
    view.json_response.side_effect = lambda obj, *args, **kwargs: sent.append(
        superset_json.loads(superset_json.dumps(obj))
    )
    app = Flask(__name__)
    with app.test_request_context(
        "/datasource/samples?datasource_type=table&datasource_id=1&dashboard_id=5",
        method="POST",
        json={},
    ):
        _get_view_func("samples")(view)

    # The serialized response carries no generated SQL or stacktrace, while the
    # rendering fields were left intact.
    assert len(sent) == 1
    result = sent[0]["result"]
    assert "query" not in result
    assert "stacktrace" not in result
    assert result["data"] == [{"id": 1}]
    mock_global_security_manager.can_access.assert_called_once_with(
        "can_view_query", "Dashboard"
    )


# A raw driver error can quote the full statement (SQLAlchemy appends
# ``[SQL: ...]``), so it must not reach a guest on the failure path either.
_RAW_SAMPLES_ERROR = (
    '(psycopg2.errors.UndefinedColumn) column "secret_col" does not exist\n'
    "LINE 1: SELECT secret_col FROM private_table\n"
    "[SQL: SELECT secret_col FROM private_table]"
)


def _run_failing_samples(app: Flask, *, is_guest: bool, query_string: str) -> Any:
    """Run the samples view body under its real ``handle_api_exception`` for a
    query that fails with a raw driver error, as a guest or an authenticated
    user. On failure ``get_samples`` raises rather than returning the payload,
    so the error handler -- not ``redact_sensitive_query_fields`` -- decides
    what the client sees."""
    with (
        patch(
            "superset.views.datasource.views.security_manager",
            new_callable=MagicMock,
        ) as view_security_manager,
        patch("superset.views.datasource.views.DatasetDAO"),
        patch("superset.views.datasource.views.DashboardDAO"),
        patch(
            "superset.views.datasource.views.get_samples",
            side_effect=DatasetSamplesFailedError(_RAW_SAMPLES_ERROR),
        ),
        patch(
            "superset.security.SupersetSecurityManager.is_guest_user",
            return_value=is_guest,
        ),
        app.test_request_context(
            f"/datasource/samples?{query_string}", method="POST", json={}
        ),
    ):
        view_security_manager.is_guest_user.return_value = is_guest
        view_security_manager.can_drill_dataset_via_dashboard_access.return_value = True
        return handle_api_exception(_get_view_func("samples"))(_view_self())


def test_samples_failure_returns_generic_error_to_guests(app: Flask) -> None:
    """When the Drill to detail query fails for an embedded guest, the response
    carries the generic message: no SQL, table or column names leak through the
    driver error, and no ``query``/``stacktrace`` payload is serialized."""
    response = _run_failing_samples(
        app,
        is_guest=True,
        query_string="datasource_type=table&datasource_id=1&dashboard_id=5",
    )

    assert response.status_code == 422
    body = response.get_data(as_text=True)
    assert superset_json.loads(body) == {"error": str(GENERIC_ERROR_MESSAGE)}
    for leaked in ("private_table", "secret_col", "SELECT"):
        assert leaked not in body


def test_samples_failure_keeps_driver_error_for_authenticated_users(
    app: Flask,
) -> None:
    """The guest redaction is scoped: an authenticated user still gets the
    actionable driver error from a failed samples query."""
    response = _run_failing_samples(
        app,
        is_guest=False,
        query_string="datasource_type=query&datasource_id=1",
    )

    assert response.status_code == 422
    body = response.get_data(as_text=True)
    assert superset_json.loads(body) == {"error": _RAW_SAMPLES_ERROR}


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.get_samples")
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
def test_samples_authenticated_dataset_access_denied_returns_403_before_fetch(
    mock_security_manager: MagicMock,
    mock_json_error_response: MagicMock,
    mock_get_datasource: MagicMock,
    mock_get_samples: MagicMock,
) -> None:
    """An authenticated user denied access to a dataset short-circuits to 403
    from ``raise_for_access`` on the pre-fetched dataset, and ``get_samples`` is
    never reached — authorization runs before any sample fetch. (The
    authenticated per-object check only runs for dataset-backed types, which
    always support samples, so this pins authorization-before-fetch rather than
    a race against the ``supports_samples`` gate.)"""
    mock_security_manager.is_guest_user.return_value = False
    mock_dataset = MagicMock()
    mock_get_datasource.return_value = mock_dataset
    mock_security_manager.raise_for_access.side_effect = _security_exception()
    mock_json_error_response.return_value = "error-response"

    app = Flask(__name__)
    with app.test_request_context(
        "/datasource/samples?datasource_type=table&datasource_id=1",
        method="POST",
        json={},
    ):
        result = _get_view_func("samples")(_view_self())

    assert result == "error-response"
    # The per-object gate runs on the pre-fetched dataset, and its denial
    # short-circuits to a single 403 before any sample fetching.
    mock_security_manager.raise_for_access.assert_called_once_with(
        datasource=mock_dataset
    )
    mock_json_error_response.assert_called_once_with("Forbidden", status=403)
    mock_get_samples.assert_not_called()


def _save_echoing_transform(
    app: Flask,
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    *,
    flag_on: bool,
) -> list[dict[str, Any]]:
    """
    Drive ``save`` with a payload that echoes `event_time`'s stored transform
    while moving the default datetime column away from it, and report the
    columns the request would write.

    This is the GET-then-POST shape the editor produces: every column comes
    back exactly as it arrived.
    """
    from superset.models.core import Database

    stored_column = MagicMock()
    stored_column.column_name = "event_time"
    stored_column.partition_value_transform = "unix_timestamp(:value)"
    stored_column.partition_transform_is_monotonic = True

    mock_orm = MagicMock()
    mock_orm.database_id = 1
    mock_orm.database = Database(database_name="probe_db", sqlalchemy_uri="sqlite://")
    mock_orm.table_name = "my_table"
    mock_orm.schema = "public"
    mock_orm.catalog = None
    mock_orm.columns = [stored_column]
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None

    payload_columns: list[dict[str, Any]] = [
        {
            "column_name": "event_time",
            "partition_value_transform": "unix_timestamp(:value)",
            "partition_transform_is_monotonic": True,
        },
        {"column_name": "event_time2"},
        {"column_name": "dt_epoch"},
    ]

    raw_save = _get_view_func("save")
    original = app.config["DEFAULT_FEATURE_FLAGS"].get("PARTITION_FILTER_MAPPING")
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = flag_on
    try:
        with app.test_request_context(
            "/datasource/save/",
            method="POST",
            data={
                "data": superset_json.dumps(
                    {
                        "id": 1,
                        "type": "table",
                        "database": {"id": 1},
                        # Moved away from the column holding the transform.
                        "main_dttm_col": "event_time2",
                        "partition_column": "dt_epoch",
                        "columns": payload_columns,
                    }
                )
            },
        ):
            raw_save(_view_self())
    finally:
        if original is None:
            del app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"]
        else:
            app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = original

    written = mock_orm.update_from_object.call_args.args[0]
    return written["columns"]


@patch("superset.views.datasource.views._", _identity_gettext)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_keeps_an_echoed_transform_only_while_the_flag_is_off(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_db: MagicMock,
    mock_json_error_response: MagicMock,
    app: Flask,
) -> None:
    """
    With the flag **off** the echo survives: nothing else would preserve it,
    since neither path runs a model-level pass and the editor hides the fields.

    With the flag **on** it is dropped. This endpoint has no model-level pass
    after the write -- the REST path does -- so exempting the echo here left
    the old mapped column holding its transform, and clearing the override
    through this same endpoint later re-armed it.
    """
    off = _save_echoing_transform(
        app, mock_get_datasource, mock_security_manager, flag_on=False
    )
    assert off[0]["partition_value_transform"] == "unix_timestamp(:value)"
    assert off[0]["partition_transform_is_monotonic"] is True

    on = _save_echoing_transform(
        app, mock_get_datasource, mock_security_manager, flag_on=True
    )
    assert on[0]["partition_value_transform"] is None
    assert on[0]["partition_transform_is_monotonic"] is False


def _legacy_mapping_orm(partition_column: str | None) -> MagicMock:
    columns = []
    for name in ("event_time", "dt_epoch"):
        column = MagicMock()
        column.column_name = name
        columns.append(column)
    orm = MagicMock()
    orm.database.backend = "sqlite"
    orm.columns = columns
    orm.main_dttm_col = "event_time"
    orm.partition_column = partition_column
    orm.partition_mapped_column = None
    return orm


def _legacy_mapping_payload(partition_column: str) -> dict[str, Any]:
    return {
        "main_dttm_col": "event_time",
        "partition_column": partition_column,
        "partition_mapped_column": None,
        "columns": [{"column_name": "event_time"}, {"column_name": "dt_epoch"}],
    }


@pytest.mark.parametrize("feature_enabled", [True, False])
def test_legacy_save_refuses_a_reference_the_request_breaks(
    app: Flask, feature_enabled: bool
) -> None:
    """Storing a mapping is not flag-gated: reading one is."""
    from superset.views.datasource.views import _partition_mapping_reference_error

    original = app.config["DEFAULT_FEATURE_FLAGS"].get("PARTITION_FILTER_MAPPING")
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = feature_enabled
    try:
        error = _partition_mapping_reference_error(
            _legacy_mapping_orm("dt_epoch"), _legacy_mapping_payload("no_such_column")
        )
    finally:
        app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = original

    assert error is not None
    assert "no_such_column" in error


def test_legacy_save_survives_a_reference_already_broken_in_storage(
    app: Flask,
) -> None:
    """
    This endpoint's client does GET-then-POST, so it echoes a reference stored
    broken. Refusing it meant the dataset could not be saved at all.
    """
    from superset.views.datasource.views import _partition_mapping_reference_error

    original = app.config["DEFAULT_FEATURE_FLAGS"].get("PARTITION_FILTER_MAPPING")
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = True
    try:
        error = _partition_mapping_reference_error(
            _legacy_mapping_orm("no_such_column"),
            _legacy_mapping_payload("no_such_column"),
        )
    finally:
        app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = original

    assert error is None
