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
from unittest.mock import MagicMock, patch

import pytest

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.utils import json as superset_json


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


def _save_request_context(**payload: Any):
    """
    Build a request context for ``Datasource.save``.

    Saves dataset 1 against connection 2 in ``cat.public``; ``payload``
    overrides or adds individual fields.
    """
    from flask import Flask

    return Flask(__name__).test_request_context(
        "/datasource/save/",
        method="POST",
        data={
            "data": superset_json.dumps(
                {
                    "id": 1,
                    "type": "table",
                    "database": {"id": 2},
                    "schema": "public",
                    "catalog": "cat",
                    "columns": [],
                    **payload,
                }
            )
        },
    )


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

    from flask import Flask

    from superset.commands.dataset.exceptions import DatasetForbiddenError

    raw_save = _get_view_func("save")
    app = Flask(__name__)
    with app.test_request_context(
        "/datasource/save/",
        method="POST",
        data={
            "data": superset_json.dumps(
                {
                    "id": 1,
                    "type": "table",
                    "database": {"id": 1},
                    "columns": [],
                    # 'editors' intentionally omitted
                }
            )
        },
    ):
        with pytest.raises(DatasetForbiddenError):
            raw_save(_view_self())

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

    from flask import Flask

    from superset.commands.dataset.exceptions import DatasetForbiddenError

    raw_save = _get_view_func("save")
    app = Flask(__name__)
    with app.test_request_context(
        "/datasource/save/",
        method="POST",
        data={
            "data": superset_json.dumps(
                {
                    "id": 1,
                    "type": "table",
                    "database": {"id": 1},
                    "columns": [],
                    "editors": [99],  # attacker-supplied editors list
                }
            )
        },
    ):
        with pytest.raises(DatasetForbiddenError):
            raw_save(_view_self())

    mock_security_manager.raise_for_editorship.assert_called_once_with(mock_orm)


@patch("superset.commands.dataset.source.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize(
    ("stored", "payload", "expected"),
    [
        pytest.param(
            {"database_id": 1, "table_name": "some_table", "sql": None},
            {"table_name": "some_table"},
            {"table": "some_table"},
            id="connection",
        ),
        pytest.param(
            {"database_id": 2, "table_name": "old_table", "sql": None},
            {"table_name": "other_table"},
            {"table": "other_table"},
            id="physical_table",
        ),
        pytest.param(
            {"database_id": 1, "table_name": "virtual_ds", "sql": "SELECT 1"},
            {"table_name": "virtual_ds", "sql": "SELECT 1"},
            {"sql": "SELECT 1"},
            id="virtual_unchanged_sql",
        ),
    ],
)
def test_save_repoint_authorizes_requested_source(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_source_security_manager: MagicMock,
    stored: dict[str, Any],
    payload: dict[str, Any],
    expected: dict[str, str],
) -> None:
    """
    A move is authorised against the source the save will persist: the target
    connection, and the requested table for physical datasets or the requested
    SQL for virtual ones. Resending unchanged SQL does not skip the check.
    """
    mock_orm = MagicMock(catalog="cat", schema="public", **stored)
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None

    target_database = MagicMock()
    mock_get_database_by_id.return_value = target_database
    mock_source_security_manager.raise_for_access.side_effect = _security_exception()

    raw_save = _get_view_func("save")
    with _save_request_context(**payload):
        with pytest.raises(SupersetSecurityException):
            raw_save(_view_self())

    mock_get_database_by_id.assert_called_once_with(2)
    call_kwargs = mock_source_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is target_database
    # The datasource is a live ORM object: a rejected save must leave it on its
    # original connection, or the next flush would persist the refused move.
    assert mock_orm.database_id == stored["database_id"]
    mock_orm.update_from_object.assert_not_called()
    if "table" in expected:
        assert call_kwargs["table"].table == expected["table"]
        assert "sql" not in call_kwargs
    else:
        assert call_kwargs["sql"] == expected["sql"]
        assert "table" not in call_kwargs


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.sanitize_datasource_data")
@patch("superset.commands.dataset.source.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_repoint_to_authorized_database_succeeds(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_source_security_manager: MagicMock,
    mock_sanitize: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    Moving a datasource to a connection the caller can access proceeds past the
    access check and persists.
    """
    mock_orm = MagicMock(
        database_id=1,
        catalog="cat",
        schema="public",
        table_name="some_table",
        sql=None,
    )
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None

    target_database = MagicMock()
    mock_get_database_by_id.return_value = target_database
    mock_source_security_manager.raise_for_access.return_value = None
    mock_sanitize.return_value = {"id": 1}

    view = _view_self()
    raw_save = _get_view_func("save")
    with _save_request_context(table_name="some_table"):
        raw_save(view)

    mock_source_security_manager.raise_for_access.assert_called_once()
    assert (
        mock_source_security_manager.raise_for_access.call_args.kwargs["database"]
        is target_database
    )
    view.json_response.assert_called_once_with({"id": 1})


@patch("superset.views.datasource.views._", lambda s: s)
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.commands.dataset.source.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_repoint_to_unknown_database_is_rejected(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_source_security_manager: MagicMock,
    mock_json_error_response: MagicMock,
) -> None:
    """
    A move to a connection that does not resolve is rejected rather than
    silently skipping the access check.
    """
    mock_orm = MagicMock(
        database_id=1,
        catalog="cat",
        schema="public",
        table_name="some_table",
        sql=None,
    )
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None
    mock_get_database_by_id.return_value = None

    raw_save = _get_view_func("save")
    with _save_request_context(table_name="some_table"):
        raw_save(_view_self())

    mock_source_security_manager.raise_for_access.assert_not_called()
    assert mock_json_error_response.call_args.kwargs["status"] == 404
    assert mock_orm.database_id == 1
    mock_orm.update_from_object.assert_not_called()


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.sanitize_datasource_data")
@patch("superset.commands.dataset.source.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
@pytest.mark.parametrize(
    ("stored", "payload"),
    [
        pytest.param(
            {"table_name": "some_table", "sql": None},
            {"table_name": "some_table"},
            id="physical_metadata_edit",
        ),
        pytest.param(
            {"table_name": "virtual_ds", "sql": "SELECT 1"},
            {"table_name": "renamed", "sql": "SELECT 1"},
            id="virtual_rename",
        ),
    ],
)
def test_save_without_move_skips_access_check(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_source_security_manager: MagicMock,
    mock_sanitize: MagicMock,
    mock_db: MagicMock,
    stored: dict[str, Any],
    payload: dict[str, Any],
) -> None:
    """
    Edits that leave the source alone stay gated on editorship: a metadata-only
    change, and renaming a virtual dataset, which relabels it without changing
    what it reads.
    """
    mock_orm = MagicMock(database_id=2, catalog="cat", schema="public", **stored)
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None
    mock_sanitize.return_value = {"id": 1}

    raw_save = _get_view_func("save")
    with _save_request_context(description="a new description", **payload):
        raw_save(_view_self())

    mock_source_security_manager.raise_for_access.assert_not_called()
    mock_get_database_by_id.assert_not_called()


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.sanitize_datasource_data")
@patch("superset.commands.dataset.source.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_omitted_catalog_reads_through_connection_default(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_source_security_manager: MagicMock,
    mock_sanitize: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    A payload that leaves the catalog out reads through the connection's
    default, so a dataset already stored on that default has not moved. The
    update command normalises the stored catalog to it on single-catalog
    connections, so the two spellings must not read as a move.
    """
    mock_orm = MagicMock(
        database_id=2,
        catalog="cat",
        schema="public",
        table_name="some_table",
        sql=None,
    )
    mock_orm.database.get_default_catalog.return_value = "cat"
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None
    mock_sanitize.return_value = {"id": 1}

    raw_save = _get_view_func("save")
    with _save_request_context(table_name="some_table", catalog=None):
        raw_save(_view_self())

    mock_source_security_manager.raise_for_access.assert_not_called()
    mock_get_database_by_id.assert_not_called()


# ---------------------------------------------------------------------------
# Datasource.samples
# ---------------------------------------------------------------------------


@patch("superset.views.datasource.views._", lambda s: s)
@patch("superset.views.datasource.views.get_samples")
@patch("superset.views.datasource.views.json_error_response")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
def test_samples_returns_400_for_unsupported_datasource_type(
    mock_security_manager: MagicMock,
    mock_json_error_response: MagicMock,
    mock_get_samples: MagicMock,
) -> None:
    """Semantic views can't return raw samples — endpoint should refuse with 400."""
    from flask import Flask

    mock_security_manager.is_guest_user.return_value = False
    mock_json_error_response.return_value = "error-response"

    raw_samples = _get_view_func("samples")
    app = Flask(__name__)
    with app.test_request_context(
        "/datasource/samples?datasource_type=semantic_view&datasource_id=1",
        method="POST",
        json={},
    ):
        result = raw_samples(_view_self())

    assert result == "error-response"
    mock_json_error_response.assert_called_once()
    _, kwargs = mock_json_error_response.call_args
    assert kwargs.get("status") == 400
    # The bail-out must happen before any sample fetching is attempted.
    mock_get_samples.assert_not_called()


@patch("superset.views.datasource.views.get_samples")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
def test_samples_proceeds_for_supported_datasource_type(
    mock_security_manager: MagicMock,
    mock_get_samples: MagicMock,
) -> None:
    """A `query` datasource (supports_samples=True) bypasses the 400 short-circuit."""
    from flask import Flask

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
