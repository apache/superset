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
"""Unit tests for resource-level authorization in QueryEstimationCommand."""

from typing import cast
from unittest.mock import MagicMock, patch

import pytest

from superset.commands.sql_lab.estimate import (
    EstimateQueryCostType,
    QueryEstimationCommand,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException, SupersetSecurityException


def _make_params(**kwargs: object) -> EstimateQueryCostType:
    base: EstimateQueryCostType = {
        "database_id": 1,
        "sql": "SELECT 1",
        "template_params": {},
        "catalog": None,
        "schema": None,
    }
    base.update(kwargs)  # type: ignore[typeddict-item]
    return base


def _security_exception() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            message="Access denied",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.WARNING,
        )
    )


# ---------------------------------------------------------------------------
# Existing behaviour: database not found
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.db")
def test_validate_raises_when_database_not_found(
    mock_db: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """404 is raised before the access check when the database does not exist."""
    mock_db.session.query.return_value.get.return_value = None

    command = QueryEstimationCommand(_make_params())
    with pytest.raises(SupersetErrorException) as exc_info:
        command.validate()

    assert exc_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR
    mock_security_manager.raise_for_access.assert_not_called()


# ---------------------------------------------------------------------------
# New behaviour: database exists but caller has no access
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.db")
def test_validate_raises_when_database_access_denied(
    mock_db: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """SupersetSecurityException propagates when raise_for_access denies access."""
    mock_database = MagicMock()
    mock_db.session.query.return_value.get.return_value = mock_database
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    command = QueryEstimationCommand(_make_params())
    with pytest.raises(SupersetSecurityException):
        command.validate()

    mock_security_manager.raise_for_access.assert_called_once_with(
        database=mock_database
    )


# ---------------------------------------------------------------------------
# New behaviour: authorised caller succeeds
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.db")
def test_validate_succeeds_for_authorised_user(
    mock_db: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """validate() completes without error when access is granted."""
    mock_database = MagicMock()
    mock_db.session.query.return_value.get.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    command = QueryEstimationCommand(_make_params())
    command.validate()  # must not raise

    mock_security_manager.raise_for_access.assert_called_once_with(
        database=mock_database
    )


# ---------------------------------------------------------------------------
# Kwarg correctness
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.db")
def test_raise_for_access_called_with_correct_database(
    mock_db: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """The database object fetched from the session is passed to raise_for_access."""
    mock_database = MagicMock()
    mock_database.id = 42
    mock_db.session.query.return_value.get.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    command = QueryEstimationCommand(_make_params(database_id=42))
    command.validate()

    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_database


# ---------------------------------------------------------------------------
# SQL security controls applied on the estimate path (parity with executor)
# ---------------------------------------------------------------------------


def _make_command_with_db(
    sql: str, *, allow_dml: bool = False, engine: str = "postgresql"
) -> QueryEstimationCommand:
    command = QueryEstimationCommand(_make_params(sql=sql))
    command._database = MagicMock()
    command._database.db_engine_spec.engine = engine
    command._database.allow_dml = allow_dml
    command._catalog = None
    command._schema = ""
    return command


@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_blocks_dml_when_not_allowed(mock_app: MagicMock) -> None:
    mock_app.config = {"DISALLOWED_SQL_FUNCTIONS": {}, "DISALLOWED_SQL_TABLES": {}}
    from superset.exceptions import SupersetDMLNotAllowedException

    command = _make_command_with_db("INSERT INTO t VALUES (1)", allow_dml=False)
    with pytest.raises(SupersetDMLNotAllowedException):
        command._apply_sql_security("INSERT INTO t VALUES (1)")


@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_allows_dml_when_enabled(mock_app: MagicMock) -> None:
    mock_app.config = {"DISALLOWED_SQL_FUNCTIONS": {}, "DISALLOWED_SQL_TABLES": {}}
    command = _make_command_with_db("INSERT INTO t VALUES (1)", allow_dml=True)
    # No exception; SQL returned unchanged (RLS disabled by default).
    assert command._apply_sql_security("INSERT INTO t VALUES (1)")


@patch("superset.commands.sql_lab.estimate.is_feature_enabled", return_value=False)
@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_blocks_disallowed_table(
    mock_app: MagicMock,
    mock_is_feature_enabled: MagicMock,
) -> None:
    """A query referencing a table on ``DISALLOWED_SQL_TABLES`` for the engine
    is rejected on the estimate path with ``SupersetDisallowedSQLTableException``,
    mirroring the execution-time denylist gate."""
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {"postgresql": {"secrets"}},
    }
    from superset.exceptions import SupersetDisallowedSQLTableException

    command = _make_command_with_db("SELECT * FROM secrets", allow_dml=True)
    cast(
        MagicMock, command._database
    ).resolve_query_default_schema.return_value = "public"
    with pytest.raises(SupersetDisallowedSQLTableException):
        command._apply_sql_security("SELECT * FROM secrets")


@patch("superset.commands.sql_lab.estimate.is_feature_enabled", return_value=False)
@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_denylist_runs_schema_gate(
    mock_app: MagicMock,
    mock_is_feature_enabled: MagicMock,
) -> None:
    """The denylist check resolves the effective schema through the shared
    query-aware ``resolve_query_default_schema`` (not the static
    ``get_default_schema``), so the engine's per-query security gate — e.g. the
    Postgres ``search_path`` check — runs on the estimate path even with RLS
    disabled, matching ``sql_lab.execute_sql_statements``."""
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {"postgresql": {"secrets"}},
    }
    command = _make_command_with_db(
        "SET search_path = secret; SELECT * FROM t", allow_dml=True
    )
    database = cast(MagicMock, command._database)
    database.resolve_query_default_schema.side_effect = _security_exception()

    with pytest.raises(SupersetSecurityException):
        command._apply_sql_security("SET search_path = secret; SELECT * FROM t")

    database.resolve_query_default_schema.assert_called_once()


@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_blocks_disallowed_function(mock_app: MagicMock) -> None:
    """A disallowed function cannot be probed via cost estimation either."""
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {"postgresql": {"PG_SLEEP"}},
        "DISALLOWED_SQL_TABLES": {},
    }
    from superset.exceptions import SupersetDisallowedSQLFunctionException

    command = _make_command_with_db("SELECT pg_sleep(1)", allow_dml=True)
    with pytest.raises(SupersetDisallowedSQLFunctionException):
        command._apply_sql_security("SELECT pg_sleep(1)")


@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_allows_benign_select(mock_app: MagicMock) -> None:
    """A benign statement passes through unchanged (no false positives)."""
    mock_app.config = {"DISALLOWED_SQL_FUNCTIONS": {}, "DISALLOWED_SQL_TABLES": {}}
    command = _make_command_with_db("SELECT 1", allow_dml=False)
    # No disallowed content, no mutation, RLS disabled -> returned unchanged.
    assert command._apply_sql_security("SELECT 1") == "SELECT 1"


@patch("superset.commands.sql_lab.estimate.apply_rls")
@patch("superset.commands.sql_lab.estimate.is_feature_enabled", return_value=True)
@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_injects_rls_when_enabled(
    mock_app: MagicMock,
    mock_is_feature_enabled: MagicMock,
    mock_apply_rls: MagicMock,
) -> None:
    """With RLS_IN_SQLLAB enabled, RLS predicates are applied per statement so
    the estimate reflects the constrained query the user could actually run."""
    mock_app.config = {"DISALLOWED_SQL_FUNCTIONS": {}, "DISALLOWED_SQL_TABLES": {}}
    command = _make_command_with_db("SELECT * FROM t", allow_dml=False)

    result = command._apply_sql_security("SELECT * FROM t")

    mock_is_feature_enabled.assert_called_with("RLS_IN_SQLLAB")
    mock_apply_rls.assert_called_once()
    # Effective schema is resolved through the shared query-aware
    # ``Database.resolve_query_default_schema`` (which builds and expunges the
    # transient probe), keeping parity with the execution path.
    cast(MagicMock, command._database).resolve_query_default_schema.assert_called_once()
    assert isinstance(result, str)


@patch("superset.commands.sql_lab.estimate.apply_rls")
@patch("superset.commands.sql_lab.estimate.is_feature_enabled", return_value=True)
@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_resolves_default_schema_for_rls(
    mock_app: MagicMock,
    mock_is_feature_enabled: MagicMock,
    mock_apply_rls: MagicMock,
) -> None:
    """When no catalog/schema is supplied, RLS must be applied against the
    database's *resolved* default catalog/schema — mirroring the execution path
    (``SQLExecutor`` / ``sql_lab.execute_sql_statements``). Passing the raw
    ``""``/``None`` would let unqualified tables dodge RLS predicates that the
    real query enforces, defeating the security parity goal of this command.
    """
    mock_app.config = {"DISALLOWED_SQL_FUNCTIONS": {}, "DISALLOWED_SQL_TABLES": {}}
    command = _make_command_with_db("SELECT * FROM t", allow_dml=False)
    database = cast(MagicMock, command._database)
    # Caller passed nothing: schema is "" and catalog is None.
    command._schema = ""
    command._catalog = None
    database.get_default_catalog.return_value = "default_catalog"
    database.resolve_query_default_schema.return_value = "public"

    command._apply_sql_security("SELECT * FROM t")

    # Default catalog/schema are resolved before injection, in the same order
    # as the executor (catalog first, then schema derived per-query). The schema
    # goes through the shared ``resolve_query_default_schema`` so engine-specific
    # per-query security gates (e.g. the Postgres ``search_path`` check) run too.
    database.get_default_catalog.assert_called_once_with()
    database.resolve_query_default_schema.assert_called_once()

    # RLS is applied with the *resolved* values, never the raw ""/None.
    # apply_rls(database, catalog, schema, statement)
    call_args = mock_apply_rls.call_args.args
    assert call_args[1] == "default_catalog"
    assert call_args[2] == "public"


@patch("superset.commands.sql_lab.estimate.apply_rls")
@patch("superset.commands.sql_lab.estimate.is_feature_enabled", return_value=True)
@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_respects_explicit_catalog_schema(
    mock_app: MagicMock,
    mock_is_feature_enabled: MagicMock,
    mock_apply_rls: MagicMock,
) -> None:
    """An explicitly supplied catalog short-circuits default-catalog resolution,
    and the explicit schema wins as the RLS target — but the schema resolver
    ``resolve_query_default_schema`` is still invoked so the engine's per-query
    security gate runs even when a schema is pinned (parity with the executor,
    which calls it unconditionally)."""
    mock_app.config = {"DISALLOWED_SQL_FUNCTIONS": {}, "DISALLOWED_SQL_TABLES": {}}
    command = _make_command_with_db("SELECT * FROM t", allow_dml=False)
    database = cast(MagicMock, command._database)
    command._catalog = "my_catalog"
    command._schema = "my_schema"

    command._apply_sql_security("SELECT * FROM t")

    # Explicit catalog wins, so the default-catalog lookup is skipped...
    database.get_default_catalog.assert_not_called()
    # ...but the schema gate must run even when a schema is pinned, otherwise an
    # explicit-schema estimate could smuggle a ``SET search_path`` past the gate
    # the executor enforces.
    database.resolve_query_default_schema.assert_called_once()
    call_args = mock_apply_rls.call_args.args
    assert call_args[1] == "my_catalog"
    assert call_args[2] == "my_schema"


@patch("superset.commands.sql_lab.estimate.apply_rls")
@patch("superset.commands.sql_lab.estimate.is_feature_enabled", return_value=True)
@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_propagates_engine_schema_gate(
    mock_app: MagicMock,
    mock_is_feature_enabled: MagicMock,
    mock_apply_rls: MagicMock,
) -> None:
    """Default-schema resolution goes through ``resolve_query_default_schema``,
    so an engine-specific per-query security gate (e.g. the Postgres
    ``search_path`` check that rejects ``SET search_path = ...``) is enforced on
    the estimate path too, rather than being silently bypassed.
    """
    mock_app.config = {"DISALLOWED_SQL_FUNCTIONS": {}, "DISALLOWED_SQL_TABLES": {}}
    command = _make_command_with_db(
        "SET search_path = secret; SELECT * FROM t", allow_dml=True
    )
    database = cast(MagicMock, command._database)
    command._schema = ""
    command._catalog = None
    database.get_default_catalog.return_value = "default_catalog"
    database.resolve_query_default_schema.side_effect = _security_exception()

    with pytest.raises(SupersetSecurityException):
        command._apply_sql_security("SET search_path = secret; SELECT * FROM t")

    # RLS injection must not happen once the schema gate has rejected the query.
    mock_apply_rls.assert_not_called()
