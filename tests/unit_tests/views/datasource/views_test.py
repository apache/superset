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
from flask import Flask

from superset.connectors.sqla.partition_mapping import MAX_TRANSFORM_LENGTH
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.utils import json as superset_json


def _identity_gettext(message: str, **kwargs: Any) -> str:
    """
    Typed stand-in for flask-babel's ``_`` in request-less unit tests.

    Interpolates like the real thing: ``_`` takes named arguments and applies
    them with ``%``, so a stand-in that refused them would make any message
    carrying a placeholder fail here and nowhere else.
    """
    return message % kwargs if kwargs else message


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
    mock_orm = MagicMock()
    mock_orm.database_id = 1
    mock_orm.table_name = "my_table"
    mock_orm.schema = "public"
    mock_orm.catalog = None
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm
    # Caller owns the dataset, so that check passes...
    mock_security_manager.raise_for_editorship.return_value = None

    mock_new_database = MagicMock()
    mock_get_database_by_id.return_value = mock_new_database
    # ...but the caller is not authorised for the new database.
    mock_security_manager.raise_for_access.side_effect = _security_exception()

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
                    # database id 999 stands in for a database the caller
                    # has no explicit grant on.
                    "database": {"id": 999},
                    "columns": [],
                }
            )
        },
    ):
        with pytest.raises(DatasetForbiddenError):
            raw_save(_view_self())

    # Ownership of the dataset was checked...
    mock_security_manager.raise_for_editorship.assert_called_once_with(mock_orm)
    # ...and access to the new database was checked too.
    mock_security_manager.raise_for_access.assert_called_once()
    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_new_database
    assert call_kwargs["table"].table == "my_table"
    assert call_kwargs["table"].schema == "public"
    # The ORM object was NOT repointed since access was denied.
    assert mock_orm.database_id == 1


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_allows_repoint_to_database_with_access(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    When the caller is authorised for the new database, ``save`` proceeds
    to repoint ``database_id``.
    """
    mock_orm = MagicMock()
    mock_orm.database_id = 1
    mock_orm.table_name = "my_table"
    mock_orm.schema = "public"
    mock_orm.catalog = None
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None

    mock_new_database = MagicMock()
    mock_get_database_by_id.return_value = mock_new_database
    mock_security_manager.raise_for_access.return_value = None

    from flask import Flask

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
                    "database": {"id": 999},
                    "columns": [],
                }
            )
        },
    ):
        raw_save(_view_self())

    mock_security_manager.raise_for_access.assert_called_once()
    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_new_database
    assert call_kwargs["table"].table == "my_table"
    assert mock_orm.database_id == 999


@patch("superset.views.datasource.views.db")
@patch("superset.views.datasource.views.DatasetDAO.get_database_by_id")
@patch("superset.views.datasource.views.security_manager", new_callable=MagicMock)
@patch("superset.views.datasource.views.DatasourceDAO.get_datasource")
def test_save_checks_access_against_requested_table_not_stale_one(
    mock_get_datasource: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_database_by_id: MagicMock,
    mock_db: MagicMock,
) -> None:
    """
    A request that repoints ``database.id`` can also change
    ``table_name``/``schema``/``catalog`` in the same payload --
    ``update_from_object`` applies those requested values afterwards.
    The access check must therefore be evaluated against the *requested*
    table, not the dataset's current (stale) one, or a caller could pass
    the check using a table they're authorised for while actually
    repointing to one they are not.
    """
    mock_orm = MagicMock()
    mock_orm.database_id = 1
    mock_orm.table_name = "authorised_table"
    mock_orm.schema = "public"
    mock_orm.catalog = None
    mock_orm.data = {"id": 1}
    mock_get_datasource.return_value = mock_orm
    mock_security_manager.raise_for_editorship.return_value = None

    mock_new_database = MagicMock()
    mock_get_database_by_id.return_value = mock_new_database
    mock_security_manager.raise_for_access.return_value = None

    from flask import Flask

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
                    "database": {"id": 999},
                    "table_name": "secret_table",
                    "schema": "finance",
                    "columns": [],
                }
            )
        },
    ):
        raw_save(_view_self())

    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_new_database
    # The check ran against the requested table, not the dataset's old one.
    assert call_kwargs["table"].table == "secret_table"
    assert call_kwargs["table"].schema == "finance"


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
) -> MagicMock:
    """
    Drive ``save`` with a transform on a column the mapping does not mirror.

    ``event_time`` is the mapped column -- the default datetime column, with no
    override -- so the transform on ``other_time`` is parked: invisible in the
    editor, and live the moment the mapped column resolves back to it.

    Returns the ORM mock. The assertions read `update_from_object`'s argument
    rather than the payload built here: the view parses its own dict out of
    ``request.form``, so the one this function holds is never the one corrected.
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
    from flask import Flask

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
    from flask import Flask

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
    from flask import Flask

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
    from flask import Flask

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
    from flask import Flask

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
