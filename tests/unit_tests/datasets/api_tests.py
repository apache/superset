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

from typing import Any, TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from sqlalchemy.exc import DataError, OperationalError
from sqlalchemy.orm.session import Session
from werkzeug.test import TestResponse

from superset import db
from superset.commands.dataset.exceptions import DatasetUpdateFailedError
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json
from superset.versioning.api_helpers import EntityVersionInfo

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable


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


def test_get_dataset_serializes_the_partition_mapping_summary(
    session: Session,
    client: Any,
    full_api_access: None,
    app: Any,
) -> None:
    """
    Saving a dataset from Explore reloads this endpoint and replaces the
    chart's datasource with the response -- a replacement, not a merge -- so a
    summary the payload omits is lost on an unrelated save and the pruning
    glyphs vanish until the page is reloaded.

    Asserted through the endpoint rather than against `show_columns`, because
    the summary is a `dict` where every other property in that list is a
    scalar, and the question is whether the schema renders it as one.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(database_name="pfm_db", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(
        table_name="pfm_events",
        schema="main",
        database=database,
        main_dttm_col="event_time",
        columns=[
            TableColumn(column_name="event_time", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="dt_epoch", type="BIGINT"),
        ],
    )
    dataset.partition_column = "dt_epoch"
    dataset.columns[0].partition_value_transform = "unix_timestamp(:value)"
    dataset.columns[0].partition_transform_is_monotonic = True
    db.session.add(dataset)
    db.session.flush()

    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = True
    try:
        with patch(
            "superset.connectors.sqla.models.known_mirror_verdict", return_value=True
        ):
            response = client.get(f"/api/v1/dataset/{dataset.id}")
    finally:
        del app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"]

    assert response.status_code == 200
    summary = response.json["result"]["partition_filter_mapping"]
    assert summary["partition_column"] == "dt_epoch"
    assert summary["mapped_column"] == "event_time"
    assert summary["active"] is True
    assert summary["is_monotonic"] is True
    assert "TEMPORAL_RANGE" in summary["mirrorable_operators"]


def test_get_dataset_reports_no_partition_mapping_when_there_is_none(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """The entire installed base: the key is present and null."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(database_name="plain_db", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="plain_events", schema="main", database=database)
    db.session.add(dataset)
    db.session.flush()

    response = client.get(f"/api/v1/dataset/{dataset.id}")

    assert response.status_code == 200
    assert response.json["result"]["partition_filter_mapping"] is None


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
    ) as version_info:
        response = client.put(
            f"/api/v1/dataset/{dataset.id}",
            json={"description": "from a stale tab"},
            headers={"If-Match": '"old"'},
        )

    assert response.status_code == 412
    # Pins the endpoint wiring: a conditional write must ask for the
    # locking validator read (sc-120050) -- without this, dropping the
    # lock_for_stale_check kwarg at the call site survives every test.
    assert version_info.call_args.kwargs["lock_for_stale_check"] is True
    assert response.headers["ETag"] == '"new"'
    db.session.expire(dataset)
    assert dataset.description is None


def test_put_dataset_maps_lock_contention_to_retryable_409(
    session: Session,
    client: FlaskClient,
    full_api_access: None,
) -> None:
    """sc-120050: a deadlock at the locked validator read is a 409, not 412.

    A lock race lost at the locking read proves concurrent contention, not
    that this request's If-Match token is stale -- 412's refetch-the-token
    guidance would be wrong, so the mapping must not drift back to it. The
    message tells the client to retry the same request.
    """
    dataset: SqlaTable = _create_dataset("test_put_lock_contention")
    deadlock: OperationalError = OperationalError("stmt", None, Exception())
    deadlock.orig = Exception(1213, "Deadlock found")

    with patch(
        "superset.datasets.api.current_entity_version_info",
        side_effect=deadlock,
    ):
        response: TestResponse = client.put(
            f"/api/v1/dataset/{dataset.id}",
            json={"description": "from a racing tab"},
            headers={"If-Match": '"anything"'},
        )

    assert response.status_code == 409
    body: str = response.get_data(as_text=True)
    assert "Retry the same request" in body
    # No write-check re-read here: the handler's rollback detaches the
    # fixture object, and nothing could have written anyway — the patched
    # read raised before the update command ever ran.


@pytest.mark.parametrize(
    "lock_point", ["lock_entity_for_update", "current_entity_version_info"]
)
def test_put_dataset_maps_entity_lock_contention_to_retryable_409(
    session: Session,
    client: FlaskClient,
    full_api_access: None,
    lock_point: str,
) -> None:
    """A lock race lost at the ENTITY-LOCK acquisition is also a 409.

    The most common contention outcome of all: writer B blocks on
    writer A's entity row lock and times out (1205) at
    ``lock_entity_for_update`` -- before the validator read's own
    try/except. Left unmapped this surfaced as an uncaught 500, defeating
    the retryable-conflict contract the other two lock points advertise.
    """
    dataset: SqlaTable = _create_dataset("test_put_entity_lock_contention")
    timeout: OperationalError = OperationalError("stmt", None, Exception())
    timeout.orig = Exception(1205, "Lock wait timeout exceeded")

    with (
        patch(f"superset.datasets.api.{lock_point}", side_effect=timeout),
        patch.object(db.session, "rollback", wraps=db.session.rollback) as rollback,
    ):
        response: TestResponse = client.put(
            f"/api/v1/dataset/{dataset.id}",
            json={"description": "from a racing tab"},
            headers={"If-Match": '"anything"'},
        )
        rollback.assert_called_once()

    assert response.status_code == 409
    assert "Retry the same request" in response.get_data(as_text=True)


@pytest.mark.parametrize("conditional", [True, False])
def test_put_dataset_maps_chained_deadlock_to_retryable_409(
    session: Session,
    client: FlaskClient,
    full_api_access: None,
    conditional: bool,
) -> None:
    """Translate a chained deadlock only for a conditional request."""
    failure: DatasetUpdateFailedError = DatasetUpdateFailedError()
    failure.__cause__ = OperationalError(
        "INSERT", None, Exception(1213, "Deadlock found")
    )
    dataset_id: int = _create_dataset("test_put_chained_deadlock").id
    with (
        patch("superset.datasets.api.raise_for_stale_write"),
        patch("superset.datasets.api.UpdateDatasetCommand.run", side_effect=failure),
    ):
        response: TestResponse = client.put(
            f"/api/v1/dataset/{dataset_id}",
            json={"description": "from a racing tab"},
            headers={"If-Match": '"anything"'} if conditional else {},
        )
    assert response.status_code == (409 if conditional else 422)
    assert ("Retry the same request" in response.get_data(as_text=True)) is conditional


@pytest.mark.parametrize(
    "lock_point", ["lock_entity_for_update", "current_entity_version_info"]
)
def test_put_dataset_does_not_reclassify_unrelated_lock_read_errors(
    session: Session,
    client: FlaskClient,
    full_api_access: None,
    lock_point: str,
) -> None:
    """Preserve unrelated driver errors at either direct locking read."""
    failure: OperationalError = OperationalError(
        "SELECT", None, Exception(2006, "MySQL server has gone away")
    )
    dataset_id: int = _create_dataset("test_put_unrelated_lock_error").id
    with patch(f"superset.datasets.api.{lock_point}", side_effect=failure):
        response: TestResponse = client.put(
            f"/api/v1/dataset/{dataset_id}",
            json={"description": "not a contention error"},
            headers={"If-Match": '"anything"'},
        )
    assert response.status_code == 500
    assert "Retry the same request" not in response.get_data(as_text=True)


def test_put_dataset_without_if_match_never_locks(
    session: Session,
    client: FlaskClient,
    full_api_access: None,
) -> None:
    """An unconditional PUT takes no locks and no locking validator read.

    Pins the perf contract both ways: hard-coding lock_for_stale_check=True
    at the call site (or unconditionally locking the entity) fails here.
    """
    dataset: SqlaTable = _create_dataset("test_put_unconditional_no_locks")

    with (
        patch("superset.datasets.api.lock_entity_for_update") as lock,
        patch(
            "superset.datasets.api.current_entity_version_info",
            return_value=EntityVersionInfo(entity_uuid=dataset.uuid),
        ) as version_info,
        patch("superset.datasets.api.UpdateDatasetCommand") as cmd,
    ):
        cmd.return_value.run.return_value = dataset
        response: TestResponse = client.put(
            f"/api/v1/dataset/{dataset.id}",
            json={"description": "plain save"},
        )

    assert response.status_code == 200
    lock.assert_not_called()
    # First call is the pre-command old_info read (the one carrying the
    # flag); the endpoint calls the helper again after the command for
    # new_info, without the kwarg.
    assert version_info.call_args_list[0].kwargs["lock_for_stale_check"] is False


def test_put_dataset_keeps_422_when_sql_text_merely_mentions_a_lock(
    session: Session,
    client: FlaskClient,
    full_api_access: None,
) -> None:
    """Response boundary: a contaminated non-lock failure stays a 422.

    sc-120050 review (Richard Fogaça): an unrelated ``DataError`` whose
    SQL or bound parameters happen to contain "deadlock" used to be
    classified as contention and answered 409 "Retry the same request"
    — advice that can never succeed, because nothing is contending. The
    command wraps SQLAlchemy errors as ``DatasetUpdateFailedError`` and
    the endpoint classifies its ``__cause__``, so the regression belongs
    at this boundary as well as in the classifier's own unit tests.
    """
    dataset: SqlaTable = _create_dataset("test_put_contaminated_data_error")
    driver_error: Exception = type(
        "Orig", (Exception,), {"args": (1064, "You have an error in your SQL syntax")}
    )()
    contaminated: DataError = DataError(
        "UPDATE slices SET description = %(description)s",
        {"description": "deadlock analysis"},
        driver_error,
    )
    assert "deadlock" in str(contaminated).lower()
    failure: DatasetUpdateFailedError = DatasetUpdateFailedError()
    failure.__cause__ = contaminated

    with (
        # Keep the request on the CONDITIONAL path (that is where the
        # classifier runs) without needing a live token: the stale check
        # itself is not what this test pins.
        patch("superset.datasets.api.raise_for_stale_write"),
        patch("superset.datasets.api.UpdateDatasetCommand.run", side_effect=failure),
    ):
        response: TestResponse = client.put(
            f"/api/v1/dataset/{dataset.id}",
            json={"description": "deadlock analysis"},
            headers={"If-Match": '"anything"'},
        )

    assert response.status_code == 422, response.get_data(as_text=True)
    assert "Retry the same request" not in response.get_data(as_text=True)


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


LIMITS: dict[str, Any] = {
    "schema_version": 1,
    "max_span": {"quantity": 90, "time_grain": "P1D"},
    "max_look_back": {"quantity": 13, "time_grain": "P1M"},
    "max_look_forward": {"quantity": 0, "time_grain": "P1D"},
}


def limits(**changes: Any) -> str:
    return json.dumps({"time_range_limits": {**LIMITS, **changes}})


@pytest.fixture(params=[False, True], ids=["flag-off", "flag-on"])
def limits_flag(request: Any, mocker: MockerFixture) -> bool:
    from superset.extensions import feature_flag_manager

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: request.param},
    )
    return request.param


@pytest.fixture
def dataset_for_put(session: Session, mocker: MockerFixture) -> Any:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_editorship"
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)
    SqlaTable.metadata.create_all(db.session.get_bind())

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="test_put_extra", database=database)
    db.session.add(dataset)
    db.session.flush()
    return dataset


BAD_EXTRA_FIELDS = [
    (
        limits(max_span={"quantity": 0, "time_grain": "P1D"}),
        "max_span.quantity",
    ),
    (limits(max_range_day=90), "max_range_day"),
    (limits(max_look_back={"quantity": 13}), "max_look_back.time_grain"),
    (limits(schema_version=2), "schema_version"),
    ('{"time_range_limits": {"max_range": "90 days"}}', "max_look_back"),
    ('{"time_range_limits": {}}', "max_look_back"),
    ('{"time_range_limits": []}', None),
    ('{"time_range_limits": ', None),
    ('["time_range_limits"]', None),
]


@pytest.mark.parametrize("extra", [extra for extra, _field in BAD_EXTRA_FIELDS])
def test_put_dataset_stores_a_bad_policy_with_the_flag_off(
    dataset_for_put: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    extra: str,
) -> None:
    set_limits(mocker, False, None)

    response = client.put(
        f"/api/v1/dataset/{dataset_for_put.id}", json={"extra": extra}
    )

    assert response.status_code == 200
    db.session.refresh(dataset_for_put)
    assert dataset_for_put.extra == extra


@pytest.mark.parametrize(("extra", "field"), BAD_EXTRA_FIELDS)
def test_put_dataset_rejects_bad_time_range_limits(
    dataset_for_put: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    extra: str,
    field: str | None,
) -> None:
    from superset.daos.dataset import DatasetDAO

    set_limits(mocker, True, None)

    update = mocker.patch.object(DatasetDAO, "update")

    response = client.put(
        f"/api/v1/dataset/{dataset_for_put.id}", json={"extra": extra}
    )

    assert response.status_code == 422
    key = "extra.time_range_limits" + (f".{field}" if field else "")
    assert list(response.json["message"]) == [key]
    update.assert_not_called()


@pytest.mark.parametrize(
    "extra",
    [
        limits(),
        '{"certification": {"certified_by": "me"}}',
        "not json",
        "",
        None,
    ],
)
def test_put_dataset_saves_valid_or_unchecked_extra_unchanged(
    dataset_for_put: Any,
    client: Any,
    full_api_access: None,
    limits_flag: bool,
    extra: str | None,
) -> None:
    response = client.put(
        f"/api/v1/dataset/{dataset_for_put.id}", json={"extra": extra}
    )

    assert response.status_code == 200
    db.session.refresh(dataset_for_put)
    assert dataset_for_put.extra == extra


def test_put_dataset_without_extra_leaves_extra_alone(
    dataset_for_put: Any,
    client: Any,
    full_api_access: None,
) -> None:
    extra = limits()
    dataset_for_put.extra = extra
    db.session.flush()

    response = client.put(
        f"/api/v1/dataset/{dataset_for_put.id}", json={"description": "new"}
    )

    assert response.status_code == 200
    db.session.refresh(dataset_for_put)
    assert dataset_for_put.extra == extra
    assert dataset_for_put.description == "new"


def test_put_dataset_with_a_unit_denylisted_after_the_save(
    dataset_for_put: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    limits_flag: bool,
) -> None:
    from flask import current_app

    stored = limits(max_span={"quantity": 9, "time_grain": "P1W"})
    response = client.put(
        f"/api/v1/dataset/{dataset_for_put.id}", json={"extra": stored}
    )
    assert response.status_code == 200
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})

    for body in ({"extra": stored}, {"description": "new", "extra": stored}):
        response = client.put(f"/api/v1/dataset/{dataset_for_put.id}", json=body)
        if not limits_flag:
            # with the flag off, an unchanged stored unit is kept.
            assert response.status_code == 200
            continue
        assert response.status_code == 422
        assert response.json["message"] == {
            "extra.time_range_limits.max_span.time_grain": [
                "max_span.time_grain: Time grain P1W is not available. Select a "
                "supported unit."
            ]
        }

    if not limits_flag:
        changed = limits(max_span={"quantity": 8, "time_grain": "P1W"})
        response = client.put(
            f"/api/v1/dataset/{dataset_for_put.id}", json={"extra": changed}
        )
        assert response.status_code == 200
        db.session.refresh(dataset_for_put)
        assert dataset_for_put.extra == changed

    else:
        changed = limits(max_span={"quantity": 8, "time_grain": "P1W"})
        response = client.put(
            f"/api/v1/dataset/{dataset_for_put.id}", json={"extra": changed}
        )
        assert response.status_code == 422
        assert response.json["message"] == {
            "extra.time_range_limits.max_span.time_grain": [
                "max_span.time_grain: Time grain P1W is not available. Select a "
                "supported unit."
            ]
        }
        db.session.refresh(dataset_for_put)
        assert dataset_for_put.extra == stored

    for replaced in (
        limits(max_span=None),
        limits(max_span={"quantity": 63, "time_grain": "P1D"}),
    ):
        response = client.put(
            f"/api/v1/dataset/{dataset_for_put.id}", json={"extra": replaced}
        )
        assert response.status_code == 200
        db.session.refresh(dataset_for_put)
        assert dataset_for_put.extra == replaced


Rule = tuple[int, str] | None
EXTRA = "extra.time_range_limits"
SPAN_TOO_LONG = "Dataset maximum span must be 12 weeks or less."
ZERO_WINDOW = "Look-back and look-forward can't both be 0: no time range would fit."


def limits_of(
    max_span: Rule = None, max_look_back: Rule = None, max_look_forward: Rule = None
) -> dict[str, Any]:
    def rule(value: Rule) -> dict[str, Any] | None:
        return None if value is None else {"quantity": value[0], "time_grain": value[1]}

    return {
        "schema_version": 1,
        "max_span": rule(max_span),
        "max_look_back": rule(max_look_back),
        "max_look_forward": rule(max_look_forward),
    }


DEMO_GLOBAL = limits_of((12, "P1W"), (12, "P1M"), (3, "P1M"))


def set_limits(mocker: MockerFixture, enabled: bool, global_policy: Any) -> None:
    from flask import current_app

    from superset.extensions import feature_flag_manager

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: enabled},
    )
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": global_policy})


@pytest.fixture
def saved_dataset(dataset_for_put: Any) -> Any:
    # A rejected write rolls the session back, so the dataset must be committed.
    db.session.commit()
    return dataset_for_put


def extra_with(limits: Any, **extra: Any) -> str:
    return json.dumps({"time_range_limits": limits, **extra})


def put(client: Any, dataset: Any, limits: Any, **body: Any) -> Any:
    return client.put(
        f"/api/v1/dataset/{dataset.id}", json={"extra": extra_with(limits), **body}
    )


def stored_policy(dataset: Any) -> Any:
    db.session.refresh(dataset)
    return json.loads(dataset.extra or "{}").get("time_range_limits")


def store(dataset: Any, limits: Any) -> None:
    dataset.extra = extra_with(limits)
    db.session.commit()


def test_put_dataset_must_be_stricter_than_the_global(
    saved_dataset: Any, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    set_limits(mocker, True, DEMO_GLOBAL)
    saved = limits_of((9, "P1W"))
    assert put(client, saved_dataset, saved).status_code == 200
    assert stored_policy(saved_dataset) == saved

    response = put(client, saved_dataset, limits_of((13, "P1W")))
    assert response.status_code == 422
    assert response.json == {"message": {f"{EXTRA}.max_span.quantity": [SPAN_TOO_LONG]}}
    assert stored_policy(saved_dataset) == saved

    response = put(client, saved_dataset, limits_of((3, "P1M")))
    assert response.status_code == 422
    assert response.json == {"message": {f"{EXTRA}.max_span.quantity": [SPAN_TOO_LONG]}}
    assert stored_policy(saved_dataset) == saved

    response = put(client, saved_dataset, limits_of((2017, "PT1H")))
    assert response.status_code == 422
    assert response.json == {"message": {f"{EXTRA}.max_span.quantity": [SPAN_TOO_LONG]}}
    assert stored_policy(saved_dataset) == saved

    other_unit = limits_of((2, "P1M"))
    assert put(client, saved_dataset, other_unit).status_code == 200
    assert stored_policy(saved_dataset) == other_unit


def test_put_dataset_after_the_global_got_stricter(
    saved_dataset: Any, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    set_limits(mocker, True, DEMO_GLOBAL)
    saved = limits_of((9, "P1W"))
    assert put(client, saved_dataset, saved).status_code == 200
    set_limits(mocker, True, limits_of((2, "P1M")))

    response = put(client, saved_dataset, saved, description="renamed")
    assert response.status_code == 200
    assert stored_policy(saved_dataset) == saved
    assert saved_dataset.description == "renamed"

    response = put(client, saved_dataset, limits_of((10, "P1W")))
    assert response.status_code == 422
    assert response.json == {
        "message": {
            f"{EXTRA}.max_span.quantity": [
                "Dataset maximum span must be 2 months or less."
            ]
        }
    }
    assert stored_policy(saved_dataset) == saved

    for limits in (limits_of(), None, limits_of((1, "P1M")), limits_of((8, "P1W"))):
        assert put(client, saved_dataset, limits).status_code == 200
        assert stored_policy(saved_dataset) == limits


def test_put_dataset_flag_off_accepts_looser_values(
    saved_dataset: Any, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    set_limits(mocker, False, DEMO_GLOBAL)
    looser = limits_of((13, "P1M"), (0, "P1D"), (0, "P1D"))
    assert put(client, saved_dataset, looser).status_code == 200
    assert stored_policy(saved_dataset) == looser

    bad_policies: list[Any] = [limits_of((0, "P1W")), limits_of((9, "tomorrow")), []]
    for bad in bad_policies:
        assert put(client, saved_dataset, bad).status_code == 200
        assert stored_policy(saved_dataset) == bad


@pytest.mark.parametrize(
    "global_policy",
    [{}, limits_of(None, (0, "P1D"), (0, "P1D")), limits_of((12, "P1W"))],
    ids=["empty", "zero-zero", "denylisted"],
)
def test_put_dataset_bad_global_is_a_503(
    saved_dataset: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    global_policy: Any,
) -> None:
    from flask import current_app

    set_limits(mocker, True, global_policy)
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})
    limits = limits_of((1, "P1D"))

    response = put(client, saved_dataset, limits)
    assert response.status_code == 503
    assert response.json["errors"][0]["error_type"] == "TIME_RANGE_LIMIT_ERROR"
    assert response.json["errors"][0]["extra"]["reason_code"] == "POLICY_UNAVAILABLE"
    assert stored_policy(saved_dataset) is None

    response = client.put(
        f"/api/v1/dataset/{saved_dataset.id}", json={"description": "new"}
    )
    assert response.status_code == 200

    set_limits(mocker, False, global_policy)
    assert put(client, saved_dataset, limits).status_code == 200
    assert stored_policy(saved_dataset) == limits


@pytest.mark.parametrize(
    "global_policy",
    [{}, limits_of(None, (0, "P1D"), (0, "P1D")), limits_of((12, "P1W"))],
    ids=["empty", "zero-zero", "denylisted"],
)
def test_bad_global_only_blocks_a_changed_policy(
    saved_dataset: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    global_policy: Any,
) -> None:
    from flask import current_app

    stored = limits_of((9, "P1D"), (2, "P1M"))
    store(saved_dataset, stored)
    set_limits(mocker, True, global_policy)
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})

    response = put(client, saved_dataset, stored, description="new")
    assert response.status_code == 200
    db.session.refresh(saved_dataset)
    assert saved_dataset.description == "new"

    for changed in (limits_of((8, "P1D"), (2, "P1M")), limits_of((9, "P1D"))):
        response = put(client, saved_dataset, changed, description="other")
        assert response.status_code == 503
        assert response.json["errors"][0]["extra"]["reason_code"] == (
            "POLICY_UNAVAILABLE"
        )
    assert stored_policy(saved_dataset) == stored
    assert saved_dataset.description == "new"


def test_put_dataset_writes_audit_row(
    saved_dataset: Any, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    from superset.models.core import Log
    from superset.time_range_limits.audit import (
        AUDIT_ACTION,
        register_audit_listener,
        remove_audit_listener,
    )

    set_limits(mocker, True, DEMO_GLOBAL)
    store(saved_dataset, limits_of((9, "P1W")))
    register_audit_listener(db.session)
    try:
        assert put(client, saved_dataset, limits_of((8, "P1W"))).status_code == 200
        response = put(client, saved_dataset, limits_of((8, "P1W")), description="x")
        assert response.status_code == 200
        assert put(client, saved_dataset, limits_of((13, "P1W"))).status_code == 422
    finally:
        remove_audit_listener(db.session)

    rows = db.session.query(Log).filter(Log.action == AUDIT_ACTION).all()
    assert [(row.dashboard_id, json.loads(row.json)) for row in rows] == [
        (
            None,
            {
                "level": "dataset",
                "dataset_id": saved_dataset.id,
                "old": limits_of((9, "P1W")),
                "new": limits_of((8, "P1W")),
                "path": f"/api/v1/dataset/{saved_dataset.id}",
            },
        )
    ]


# GET /api/v1/dataset/<pk>/time_range_limits/charts/


def _dataset_check(client: Any, objects: dict[str, Any], query: str = "") -> Any:
    from tests.fixtures.time_range_save_check import DATASET_URL

    return client.get(DATASET_URL.format(objects["table"].id) + query)


@pytest.mark.parametrize("case", ["absent", "null", "malformed", "looser", "bad_rison"])
def test_policy_param_dataset(
    save_check_objects: dict[str, Any],  # noqa: F811
    client: Any,
    mocker: MockerFixture,
    case: str,
) -> None:
    from flask import current_app
    from freezegun import freeze_time

    from superset.extensions import feature_flag_manager
    from tests.fixtures.time_range_save_check import FLAG_ON, NOW, P, rison, snapshot

    mocker.patch.object(feature_flag_manager, "get_feature_flags", return_value=FLAG_ON)
    query = {
        "absent": "",
        "null": rison(None),
        "malformed": rison(
            {**P(span=90), "max_span": {"quantity": -1, "time_grain": "P1D"}}
        ),
        "looser": rison(P(span=60)),
        "bad_rison": "?q=(a:b",
    }[case]
    if case in ("null", "looser"):
        current_app.config["TIME_RANGE_LIMITS_GLOBAL"] = P(span=45)
    before = snapshot(save_check_objects)

    with freeze_time(NOW):
        response = _dataset_check(client, save_check_objects, query)

    assert snapshot(save_check_objects) == before
    if case == "absent":
        assert response.status_code == 200
        assert [
            (item["slice_name"], item["source"], item["message"])
            for item in response.json["result"]["charts"]
        ] == [
            (
                name,
                "dataset",
                "Range can't be longer than 180 days. This one is 365 days.",
            )
            for name in ("Calls by queue", "Form data line")
        ]
    elif case == "null":
        assert response.status_code == 200
        assert {item["source"] for item in response.json["result"]["charts"]} == {
            "global"
        }
    elif case == "malformed":
        assert response.status_code == 400
        assert response.json == {
            "message": {
                "policy.max_span.quantity": [
                    "max_span.quantity: must be a whole number from 1 to 9999"
                ]
            }
        }
    elif case == "looser":
        assert response.status_code == 422
        assert response.json == {
            "message": {
                "policy.max_span.quantity": [
                    "Dataset maximum span must be 45 days or less."
                ]
            }
        }
    else:
        assert response.status_code == 400
        assert response.json == {"message": "Not a valid rison/json argument"}


def test_unchanged_needs_review_policy_not_422_dataset(
    save_check_objects: dict[str, Any],  # noqa: F811
    client: Any,
    mocker: MockerFixture,
) -> None:
    from flask import current_app

    from superset.extensions import feature_flag_manager
    from tests.fixtures.time_range_save_check import FLAG_ON, P, rison

    mocker.patch.object(feature_flag_manager, "get_feature_flags", return_value=FLAG_ON)
    current_app.config["TIME_RANGE_LIMITS_GLOBAL"] = P(span=30)

    unchanged = _dataset_check(client, save_check_objects, rison(P(span=180)))
    changed = _dataset_check(client, save_check_objects, rison(P(span=50)))

    assert unchanged.status_code == 200
    assert changed.status_code == 422


@pytest.mark.parametrize("who", ["admin", "not_editor", "cannot_see"])
def test_save_check_editor_only_dataset(
    save_check_objects: dict[str, Any],  # noqa: F811
    client: Any,
    mocker: MockerFixture,
    who: str,
) -> None:
    from superset.exceptions import SupersetSecurityException
    from superset.extensions import feature_flag_manager, security_manager
    from tests.fixtures.time_range_save_check import DATASET_URL, FLAG_ON

    mocker.patch.object(feature_flag_manager, "get_feature_flags", return_value=FLAG_ON)
    pk = save_check_objects["table"].id
    if who == "not_editor":
        mocker.patch.object(
            security_manager,
            "raise_for_editorship",
            side_effect=SupersetSecurityException(MagicMock()),
        )
    elif who == "cannot_see":
        mocker.patch("superset.datasets.api.DatasetDAO.find_by_id", return_value=None)

    response = client.get(DATASET_URL.format(pk))

    assert (
        response.status_code
        == {"admin": 200, "not_editor": 403, "cannot_see": 404}[who]
    )
