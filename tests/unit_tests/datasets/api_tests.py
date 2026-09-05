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

from typing import Any
from unittest.mock import MagicMock, patch

from sqlalchemy.orm.session import Session

from superset import db
from superset.utils import json


def test_put_invalid_dataset(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test invalid payloads.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    dataset = SqlaTable(
        table_name="test_put_invalid_dataset",
        database=database,
    )
    db.session.add(dataset)
    db.session.flush()

    response = client.put(
        "/api/v1/dataset/1",
        json={"invalid": "payload"},
    )
    assert response.status_code == 422
    assert response.json == {
        "errors": [
            {
                "message": "The schema of the submitted payload is invalid.",
                "error_type": "MARSHMALLOW_ERROR",
                "level": "error",
                "extra": {
                    "messages": {"invalid": ["Unknown field."]},
                    "payload": {"invalid": "payload"},
                    "issue_codes": [
                        {
                            "code": 1040,
                            "message": (
                                "Issue 1040 - The submitted payload failed validation."
                            ),
                        }
                    ],
                },
            }
        ]
    }


def test_get_dataset_include_rendered_sql_passes_table_to_template_processor(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Dataset API: Test that include_rendered_sql passes the table
    to get_template_processor.

    Regression test for the bug where get_template_processor was called without
    the `table` argument, leaving self._schema as None in processors like
    PrestoTemplateProcessor and causing NPEs when templates reference partition
    functions without an explicit schema.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    dataset = SqlaTable(
        table_name="test_render_sql_table",
        schema="my_schema",
        database=database,
        sql="SELECT 1",
    )
    db.session.add(dataset)
    db.session.flush()

    mock_processor = MagicMock()
    mock_processor.process_template.return_value = "SELECT 1"

    with patch(
        "superset.datasets.api.get_template_processor",
        return_value=mock_processor,
    ) as mock_get_processor:
        response = client.get(
            f"/api/v1/dataset/{dataset.id}?include_rendered_sql=true",
        )

    assert response.status_code == 200
    mock_get_processor.assert_called_once_with(database=database, table=dataset)


def test_get_dataset_include_rendered_sql_handles_undefined_error(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Dataset API: Test that include_rendered_sql returns a typed 422 instead
    of an unhandled 500 when the template processor raises a raw
    ``jinja2.exceptions.UndefinedError``.

    Regression test for the bug where an undefined variable accessed via
    attribute/subscript (e.g. ``{{ foo.bar }}``) raises ``UndefinedError``
    from ``process_template``, which is not a subclass of
    ``TemplateSyntaxError`` and so escaped ``render_dataset_fields``'s
    exception handling unhandled.
    """
    from jinja2.exceptions import UndefinedError

    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    dataset = SqlaTable(
        table_name="test_render_sql_undefined_table",
        schema="my_schema",
        database=database,
        sql="SELECT 1",
    )
    db.session.add(dataset)
    db.session.flush()

    mock_processor = MagicMock()
    mock_processor.process_template.side_effect = UndefinedError("'foo' is undefined")

    with patch(
        "superset.datasets.api.get_template_processor",
        return_value=mock_processor,
    ):
        response = client.get(
            f"/api/v1/dataset/{dataset.id}?include_rendered_sql=true",
        )

    assert response.status_code == 422
    assert "Unable to render expression from dataset" in response.json["message"]


def test_handle_filters_args_returns_request_scoped_filters(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    ``_handle_filters_args`` must return a fresh ``Filters`` instance per
    call so concurrent requests don't share filter state.

    Regression test for #33828: under concurrent traffic the FAB default
    implementation mutates ``self._filters`` (a single shared instance),
    causing filters from one request to leak into another.

    The fix lives on ``BaseSupersetModelRestApi`` so every superset REST
    API subclass (datasets, charts, dashboards, saved queries, etc.)
    inherits the request-scoped behavior. This test exercises it via
    ``DatasetRestApi`` as a concrete subclass.
    """
    from flask_appbuilder.const import API_FILTERS_RIS_KEY

    from superset.datasets.api import DatasetRestApi

    api = DatasetRestApi()
    api.datamodel = MagicMock()
    api.search_columns = ["table_name"]
    api.search_filters = {}
    api._base_filters = MagicMock()  # noqa: SLF001

    # Each call should construct a fresh Filters instance via datamodel.get_filters
    rison_args = {
        API_FILTERS_RIS_KEY: [{"col": "table_name", "opr": "eq", "value": "a"}],
    }
    api._handle_filters_args(rison_args)  # noqa: SLF001
    api._handle_filters_args(rison_args)  # noqa: SLF001

    assert api.datamodel.get_filters.call_count == 2
    # Returned object must be the joined-filters result of the *fresh* Filters,
    # not the shared self._filters attribute.
    fresh_filters = api.datamodel.get_filters.return_value
    assert fresh_filters.rest_add_filters.call_count == 2
    assert fresh_filters.get_joined_filters.call_count == 2


def _create_dataset(name: str) -> Any:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())
    dataset = SqlaTable(
        table_name=name,
        database=Database(database_name=f"{name}_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()
    return dataset


def test_post_dataset_with_invalid_sql_returns_actionable_422(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """Saving a dataset over unrunnable SQL must explain what is wrong.

    With blanket database access ``validate()`` never parses the SQL, so
    ``run()``'s column introspection is the first thing to reject it. That
    used to surface as a bare 500 ``{"message": "Fatal error"}``.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(database_name="invalid_sql_db", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    response = client.post(
        "/api/v1/dataset/",
        json={
            "database": database.id,
            "schema": "main",
            "table_name": "dataset wrong",
            "sql": "SELECT ...",
        },
    )

    assert response.status_code == 422
    message = response.json["message"]
    assert "Fatal error" not in str(message)
    # Not the parser's exact wording -- that would break on a sqlglot bump.
    assert message["sql"][0].startswith("Invalid SQL")

    # The failed create must not leave a half-built dataset behind.
    assert (
        db.session.query(SqlaTable).filter_by(table_name="dataset wrong").one_or_none()
        is None
    )


def test_post_dataset_oauth2_redirect_propagates_unchanged(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """OAuth2RedirectError must reach the client with its ``url``/``tab_id``
    extras intact so the frontend can start the OAuth2 dance.

    ``DatasetRestApi.post`` doesn't use flask-appbuilder's ``@safe``
    decorator for this reason: ``@safe`` catches any uncaught exception and
    flattens it into an opaque 500, which would strip those extras.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.exceptions import OAuth2RedirectError
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(database_name="oauth2_db", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    with patch(
        "superset.datasets.api.CreateDatasetCommand.run",
        side_effect=OAuth2RedirectError(
            "http://example.org/auth", "tab-1", "/redirect"
        ),
    ):
        response = client.post(
            "/api/v1/dataset/",
            json={
                "database": database.id,
                "schema": "main",
                "table_name": "oauth2_table",
            },
        )

    assert response.status_code == 403
    error = response.json["errors"][0]
    assert error["error_type"] == "OAUTH2_REDIRECT"
    assert error["extra"] == {
        "url": "http://example.org/auth",
        "tab_id": "tab-1",
        "redirect_uri": "/redirect",
    }


def test_post_dataset_timeout_propagates_own_status(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """A query timeout while fetching metadata must surface as its own 408,
    not be flattened into the catch-all 500 "Fatal error" -- the same class
    of failure ``CreateDatasetCommand`` deliberately re-raises unchanged so
    it isn't misreported as a 422 "invalid table"/"invalid sql" error.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.errors import ErrorLevel, SupersetErrorType
    from superset.exceptions import SupersetTimeoutException
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(database_name="timeout_db", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    with patch(
        "superset.datasets.api.CreateDatasetCommand.run",
        side_effect=SupersetTimeoutException(
            error_type=SupersetErrorType.CONNECTION_DATABASE_TIMEOUT,
            message="Connection timed out",
            level=ErrorLevel.ERROR,
        ),
    ):
        response = client.post(
            "/api/v1/dataset/",
            json={
                "database": database.id,
                "schema": "main",
                "table_name": "timeout_table",
            },
        )

    assert response.status_code == 408
    assert "Connection timed out" in response.json["message"]


def test_post_dataset_dbapi_connection_error_returns_sanitized_500(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """Unlike ``SupersetTimeoutException``, ``SupersetDBAPIConnectionError`` and
    its sibling ``SupersetDBAPIError`` subclasses (aside from
    ``SupersetDBAPIProgrammingError``) inherit the base 500 status, so there is
    no distinct status to surface for them. They must fall through to the same
    sanitized "Fatal error" response as any other unexpected exception, not
    echo the raw driver/connection text ``CreateDatasetCommand`` re-raises them
    with.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.db_engine_specs.exceptions import SupersetDBAPIConnectionError
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(database_name="dbapi_error_db", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    secret = "postgresql://admin:s3cr3t@internal-db.example.com/prod"  # noqa: S105
    with patch(
        "superset.datasets.api.CreateDatasetCommand.run",
        side_effect=SupersetDBAPIConnectionError(secret),
    ):
        response = client.post(
            "/api/v1/dataset/",
            json={
                "database": database.id,
                "schema": "main",
                "table_name": "dbapi_error_table",
            },
        )

    assert response.status_code == 500
    assert response.json == {"message": "Fatal error"}
    assert secret not in response.get_data(as_text=True)


def test_post_dataset_unexpected_error_returns_sanitized_500(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """An unexpected, non-``SupersetException`` failure must be flattened
    into an opaque 500 -- the same contract ``@safe`` used to provide --
    instead of leaking raw exception text (e.g. driver/connection details)
    through Flask's catch-all error handler.

    ``DatasetRestApi.post`` doesn't use ``@safe`` so that ``OAuth2RedirectError``
    can reach the client unchanged (see
    ``test_post_dataset_oauth2_redirect_propagates_unchanged``); it must
    replicate ``@safe``'s opaque-500 behavior itself for everything else.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(database_name="unexpected_db", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    secret = "postgresql://admin:s3cr3t@internal-db.example.com/prod"  # noqa: S105
    with patch(
        "superset.datasets.api.CreateDatasetCommand.run",
        side_effect=RuntimeError(secret),
    ):
        response = client.post(
            "/api/v1/dataset/",
            json={
                "database": database.id,
                "schema": "main",
                "table_name": "unexpected_table",
            },
        )

    assert response.status_code == 500
    assert response.json == {"message": "Fatal error"}
    assert secret not in response.get_data(as_text=True)


def test_put_dataset_rejects_stale_if_match(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    A PUT carrying an ``If-Match`` from an older version is refused with 412.
    """
    from superset.versioning.api_helpers import EntityVersionInfo

    dataset = _create_dataset("test_put_stale_if_match")

    with patch(
        "superset.datasets.api.current_entity_version_info",
        return_value=EntityVersionInfo(
            version=1,
            transaction_id=2,
            version_uuid="new",
            entity_uuid=dataset.uuid,
        ),
    ):
        response = client.put(
            f"/api/v1/dataset/{dataset.id}",
            json={"description": "from a stale tab"},
            headers={"If-Match": '"old"'},
        )

    assert response.status_code == 412
    assert response.headers["ETag"] == '"new"'
    db.session.expire(dataset)
    assert dataset.description is None


def test_put_dataset_guards_a_dataset_with_no_version_rows(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """Baseline rows are written lazily on the first update, so a dataset that
    has never been saved has no version rows — it must still be guarded, or
    the first concurrent save on every pristine dataset goes unprotected.
    """
    from superset.versioning.api_helpers import (
        EntityVersionInfo,
        unversioned_entity_token,
    )

    dataset = _create_dataset("test_put_unversioned_guard")
    entity_uuid = dataset.uuid

    with patch(
        "superset.datasets.api.current_entity_version_info",
        # A dataset that has since been versioned by another tab's save.
        return_value=EntityVersionInfo(
            version=0,
            transaction_id=1,
            version_uuid="written-by-the-other-tab",
            entity_uuid=entity_uuid,
        ),
    ):
        response = client.put(
            f"/api/v1/dataset/{dataset.id}",
            json={"description": "from the tab that opened first"},
            headers={"If-Match": f'"{unversioned_entity_token(entity_uuid)}"'},
        )

    assert response.status_code == 412
    db.session.expire(dataset)
    assert dataset.description is None


def test_get_dataset_exposes_certification_metadata(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Dataset API: Test that the show payload exposes the certification and
    warning metadata for both columns and metrics.

    Regression test for #43279: Explore hydrates its datasource from this
    endpoint after a dataset save or swap. Without these fields the certified
    and warning badges disappeared until the page was reloaded, because the
    Explore bootstrap payload serializes them but this endpoint did not.
    """
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    extra = json.dumps(
        {
            "certification": {
                "certified_by": "Data Platform",
                "details": "Reviewed quarterly",
            },
            "warning_markdown": "This is a **warning**",
        }
    )
    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    dataset = SqlaTable(
        table_name="test_certification_table",
        database=database,
        columns=[
            TableColumn(column_name="ds", type="TIMESTAMP", extra=extra),
            TableColumn(
                column_name="calculated",
                type="INTEGER",
                expression="1 + 1",
                extra=extra,
            ),
        ],
        metrics=[SqlMetric(metric_name="cnt", expression="COUNT(*)", extra=extra)],
    )
    db.session.add(dataset)
    db.session.flush()

    response = client.get(f"/api/v1/dataset/{dataset.id}")

    assert response.status_code == 200
    result = response.json["result"]
    for item in [*result["columns"], *result["metrics"]]:
        assert item["is_certified"] is True
        assert item["certified_by"] == "Data Platform"
        assert item["certification_details"] == "Reviewed quarterly"
        assert item["warning_markdown"] == "This is a **warning**"
