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
from pytest_mock import MockerFixture

from superset import security_manager
from superset.commands.sql_lab.estimate import (
    EstimateQueryCostType,
    QueryEstimationCommand,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetErrorException,
    SupersetGenericDBErrorException,
    SupersetParseError,
    SupersetSecurityException,
)
from superset.models.core import Database
from tests.unit_tests.conftest import with_feature_flags


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
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_validate_raises_when_database_not_found(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """404 is raised before the access check when the database does not exist."""
    mock_dao.find_by_id.return_value = None

    command = QueryEstimationCommand(_make_params())
    with pytest.raises(SupersetErrorException) as exc_info:
        command.validate()

    assert exc_info.value.error.error_type == SupersetErrorType.RESULTS_BACKEND_ERROR
    mock_security_manager.raise_for_access.assert_not_called()


# ---------------------------------------------------------------------------
# New behaviour: database exists but caller has no access
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_validate_raises_when_database_access_denied(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """SupersetSecurityException propagates when raise_for_access denies access."""
    mock_database = MagicMock()
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.side_effect = _security_exception()

    command = QueryEstimationCommand(_make_params())
    with pytest.raises(SupersetSecurityException):
        command.validate()

    mock_security_manager.raise_for_access.assert_called_once()


# ---------------------------------------------------------------------------
# New behaviour: authorised caller succeeds
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_validate_succeeds_for_authorised_user(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """validate() completes without error when access is granted."""
    mock_database = MagicMock()
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    command = QueryEstimationCommand(_make_params())
    command.validate()  # must not raise

    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_database


# ---------------------------------------------------------------------------
# Kwarg correctness
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_raise_for_access_called_with_correct_database(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """The database object fetched from the session is passed to raise_for_access."""
    mock_database = MagicMock()
    mock_database.id = 42
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    command = QueryEstimationCommand(_make_params(database_id=42))
    command.validate()

    call_kwargs = mock_security_manager.raise_for_access.call_args.kwargs
    assert call_kwargs["database"] is mock_database


# ---------------------------------------------------------------------------
# Regression: the SQL to be estimated must be authorized, not just the handle
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_validate_authorizes_the_sql_to_be_estimated(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """
    ``raise_for_access`` must receive the SQL so table-level authorization
    runs; a bare ``database=`` argument matches no branch and checks nothing.
    """
    mock_database = MagicMock()
    mock_dao.find_by_id.return_value = mock_database

    command = QueryEstimationCommand(
        _make_params(sql="SELECT * FROM secret_table", schema="main")
    )
    command.validate()

    mock_security_manager.raise_for_access.assert_called_once_with(
        database=mock_database,
        sql="SELECT * FROM secret_table",
        catalog=None,
        schema="main",
        template_params={},
        force_dataset_match=True,
    )


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
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
    from superset.exceptions import SupersetDMLNotAllowedException

    command = _make_command_with_db("INSERT INTO t VALUES (1)", allow_dml=False)
    with pytest.raises(SupersetDMLNotAllowedException):
        command._apply_sql_security("INSERT INTO t VALUES (1)")


@patch("superset.commands.sql_lab.estimate.app")
def test_apply_sql_security_allows_dml_when_enabled(mock_app: MagicMock) -> None:
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
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
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
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
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
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
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
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
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
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
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
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


# ---------------------------------------------------------------------------
# process_template() error handling: raw jinja2 errors must not leak from run()
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.get_template_processor")
@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_wraps_raw_jinja_undefined_error(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_template_processor: MagicMock,
) -> None:
    """A raw jinja2 ``UndefinedError`` from ``process_template()`` (the
    bare-raise fallback in ``BaseTemplateProcessor.process_template`` for
    undefined attribute/subscript access, e.g. ``{{ foo.bar }}``) must not
    leak past ``run()`` -- it should surface as a typed
    ``SupersetErrorException``, matching the ``ExecuteSqlCommand`` sibling's
    broad-catch pattern in ``commands/sql_lab/execute.py``."""
    from jinja2.exceptions import UndefinedError

    mock_database = MagicMock()
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None
    mock_get_template_processor.return_value.process_template.side_effect = (
        UndefinedError("'foo' is undefined")
    )

    command = QueryEstimationCommand(
        _make_params(sql="SELECT {{ foo.bar }}", template_params={"x": 1})
    )
    with pytest.raises(SupersetErrorException) as exc_info:
        command.run()

    assert exc_info.value.status == 400
    assert exc_info.value.error.error_type == SupersetErrorType.GENERIC_COMMAND_ERROR


# ---------------------------------------------------------------------------
# estimate_query_cost() error handling: a raw simplejson JSONDecodeError from
# parsing the engine's cost-estimate response must not leak from run()
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_wraps_raw_jsondecodeerror_from_cost_estimation(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
) -> None:
    """A raw ``simplejson.JSONDecodeError`` raised while parsing the engine's
    cost-estimate response (e.g. Presto/Trino ``EXPLAIN (TYPE IO, FORMAT JSON)``
    emitting a bare ``NaN`` token for tables lacking computed statistics) must
    not leak past ``run()`` -- it should surface as a typed
    ``SupersetErrorException`` with a 500 ``GENERIC_BACKEND_ERROR``, mirroring
    the sibling ``TemplateError`` conversion in the same function."""
    # ``superset.utils.json`` is simplejson-backed, so ``json.JSONDecodeError``
    # here *is* ``simplejson.errors.JSONDecodeError`` -- the concrete class the
    # Presto/Trino cost-estimate parse raises, which is distinct from the stdlib
    # ``json.JSONDecodeError``. Using the util keeps us off the banned direct
    # ``simplejson`` import while exercising the exact raised type.
    from superset.utils import json

    mock_database = MagicMock()
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None
    # The raw class actually raised by superset.utils.json (simplejson-backed)
    # when the driver response contains a literal NaN token.
    mock_database.db_engine_spec.estimate_query_cost.side_effect = json.JSONDecodeError(
        "Expecting value", "{}", 0
    )

    command = QueryEstimationCommand(_make_params())
    with pytest.raises(SupersetErrorException) as exc_info:
        command.run()

    assert exc_info.value.status == 500
    assert exc_info.value.error.error_type == SupersetErrorType.GENERIC_BACKEND_ERROR


# ---------------------------------------------------------------------------
# Raw DBAPI errors from estimate_query_cost must not leak from run()
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.app")
@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_wraps_raw_dbapi_error_from_cost_estimation(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
    mock_app: MagicMock,
) -> None:
    """A raw DBAPI exception (e.g. ``psycopg2.errors.SyntaxError``) raised by
    ``estimate_query_cost`` when EXPLAIN parses invalid SQL must not leak past
    ``run()`` — it should surface as ``SupersetGenericDBErrorException`` with
    ``status == 400`` and ``GENERIC_DB_ENGINE_ERROR``, mirroring the sibling
    pattern in ``SynchronousSqlJsonExecutor.execute()``."""
    import psycopg2.errors

    mock_database = MagicMock()
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None
    mock_app.config = {
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
    }
    mock_database.db_engine_spec.estimate_query_cost.side_effect = (
        psycopg2.errors.UndefinedTable('relation "nonexistent_table" does not exist')
    )

    sql = "SELECT 1 FROM nonexistent_table"
    command = QueryEstimationCommand(_make_params(sql=sql))
    with pytest.raises(SupersetGenericDBErrorException) as exc_info:
        command.run()

    assert exc_info.value.status == 400
    assert exc_info.value.error.error_type == SupersetErrorType.GENERIC_DB_ENGINE_ERROR


# ---------------------------------------------------------------------------
# OAuth2RedirectError must pass through run() untouched, not be swallowed
# by the broad DBAPI-error catch-all above
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.app")
@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_reraises_oauth2_redirect_error_from_cost_estimation(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
    mock_app: MagicMock,
) -> None:
    """``OAuth2RedirectError`` raised by ``estimate_query_cost`` (via
    ``get_raw_connection`` -> ``check_for_oauth2``) must propagate unchanged
    so the frontend can drive the interactive re-auth flow — it must not be
    re-wrapped into ``SupersetGenericDBErrorException`` by the broad
    except-Exception clause, mirroring the sibling guard in
    ``sql_lab.py``'s ``execute_sql_statements()``."""
    mock_database = MagicMock()
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None
    mock_app.config = {
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
    }
    mock_database.db_engine_spec.estimate_query_cost.side_effect = OAuth2RedirectError(
        url="https://example.org/oauth2/authorize",
        tab_id="tab-1",
        redirect_uri="https://example.org/oauth2/callback",
    )

    sql = "SELECT 1"
    command = QueryEstimationCommand(_make_params(sql=sql))
    with pytest.raises(OAuth2RedirectError) as exc_info:
        command.run()

    assert exc_info.value.status == 403


# ---------------------------------------------------------------------------
# Templates are rendered before estimating, as on the execution path
# ---------------------------------------------------------------------------


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
@patch("superset.commands.sql_lab.estimate.app")
@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_renders_a_template_without_template_params(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
    mock_app: MagicMock,
) -> None:
    """A query needs no declared parameter to need rendering: ``get_time_filter()``
    and friends take none, and SQL Lab posts an empty ``template_params`` for an
    estimate, so gating the render on it left the template in place for the
    parser to choke on.

    Rendered for real -- a mocked processor returning a fixed string would pass
    whether or not the command rendered anything."""
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
    mock_database = MagicMock()
    # Real strings: the processor selects on `backend` and `SQLScript` parses
    # with `engine`; left as mocks both silently fall back to a default.
    mock_database.backend = "postgresql"
    mock_database.db_engine_spec.engine = "postgresql"
    mock_database.allow_dml = False
    mock_database.db_engine_spec.query_cost_formatter.return_value = [{"Cost": "1"}]
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    sql = "{% set tf = get_time_filter('ds') %}SELECT 1 {% if tf %}{% endif %}"
    command = QueryEstimationCommand(_make_params(sql=sql))

    assert command.run() == [{"Cost": "1"}]
    estimated = mock_database.db_engine_spec.estimate_query_cost.call_args.args[3]
    assert "{%" not in estimated
    assert estimated.strip() == "SELECT 1"


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
@patch("superset.commands.sql_lab.estimate.app")
@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_estimates_a_template_its_parameters_fully_bind(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
    mock_app: MagicMock,
) -> None:
    """A template whose parameters are all supplied renders to the same SQL the
    query would run, so it is estimated rather than refused."""
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
    mock_database = MagicMock()
    mock_database.backend = "postgresql"
    mock_database.db_engine_spec.engine = "postgresql"
    mock_database.allow_dml = False
    mock_database.db_engine_spec.query_cost_formatter.return_value = [{"Cost": "2"}]
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    command = QueryEstimationCommand(
        _make_params(sql="SELECT '{{ ds }}'", template_params={"ds": "2026-08-20"})
    )

    assert command.run() == [{"Cost": "2"}]
    # The parameter really was substituted, not merely passed along.
    assert (
        mock_database.db_engine_spec.estimate_query_cost.call_args.args[3]
        == "SELECT '2026-08-20'"
    )


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
@patch("superset.commands.sql_lab.estimate.app")
@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_reports_an_unprovided_parameter_as_missing(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
    mock_app: MagicMock,
) -> None:
    """``DebugUndefined`` leaves an unprovided parameter in place instead of
    raising, and in a position like a string literal the leftover still parses.
    Estimating it would describe a query the user cannot run, so it gets the
    same typed response the execution path gives it.

    Rendered and detected for real: a mocked processor handed the answer would
    prove only that the command reacts to a non-empty set."""
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
    mock_database = MagicMock()
    mock_database.backend = "postgresql"
    mock_database.db_engine_spec.engine = "postgresql"
    mock_database.allow_dml = False
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    command = QueryEstimationCommand(_make_params(sql="SELECT '{{ ds }}' AS d"))
    with pytest.raises(SupersetErrorException) as exc_info:
        command.run()

    error = exc_info.value.error
    assert exc_info.value.status == 400
    assert error.error_type == SupersetErrorType.MISSING_TEMPLATE_PARAMS_ERROR
    assert error.message.startswith('The parameter "ds" in your query is undefined.')
    # The execution path's suggestion travels with it.
    assert "Set Parameters" in error.message
    assert error.extra["undefined_parameters"] == ["ds"]
    assert error.extra["issue_codes"][0]["code"] == 1006
    # Nothing was estimated.
    mock_database.db_engine_spec.estimate_query_cost.assert_not_called()


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
@patch("superset.commands.sql_lab.estimate.app")
@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_leaves_a_genuine_syntax_error_alone(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
    mock_app: MagicMock,
) -> None:
    """SQL that fails to parse with nothing undefined in it keeps the parser's
    own error -- the query really is malformed.

    It raises from ``get_undefined_parameters``, which parses to strip comments,
    before the security controls parse it again; the type reaching the caller is
    the same either way. Mocking the processor would move the raise to a place
    production never reaches it from."""
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
    mock_database = MagicMock()
    mock_database.backend = "postgresql"
    mock_database.db_engine_spec.engine = "postgresql"
    mock_database.allow_dml = False
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    command = QueryEstimationCommand(_make_params(sql="SELECT FROM FROM"))
    with pytest.raises(SupersetParseError) as exc_info:
        command.run()

    assert exc_info.value.error.error_type == SupersetErrorType.INVALID_SQL_ERROR
    mock_database.db_engine_spec.estimate_query_cost.assert_not_called()


# ---------------------------------------------------------------------------
# What is authorized is what is estimated
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.estimate.app")
@patch("superset.commands.sql_lab.estimate.get_template_processor")
@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_reauthorizes_the_rendered_sql(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_template_processor: MagicMock,
    mock_app: MagicMock,
) -> None:
    """The rendered SQL, not the source, is what reaches the second check.

    A call-shape test: the processor is mocked so that the two strings are
    unmistakably different, which is the only thing asserted here. It says
    nothing about *why* a render can differ from its source -- exercising that
    would need a nondeterministic template actually rendered, and the
    divergence it protects against is covered by
    ``test_run_refuses_a_render_the_caller_cannot_access`` through the real
    gate."""
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "postgresql"
    mock_database.allow_dml = False
    mock_database.db_engine_spec.query_cost_formatter.return_value = [{"Cost": "1"}]
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None
    processor = mock_get_template_processor.return_value
    processor.process_template.return_value = "SELECT * FROM rendered_tbl"
    processor.get_undefined_parameters.return_value = set()

    sql = "SELECT * FROM source_tbl"
    command = QueryEstimationCommand(_make_params(sql=sql, schema="public"))

    assert command.run() == [{"Cost": "1"}]

    first, second = mock_security_manager.raise_for_access.call_args_list
    # The first check is the unrendered source, as before.
    assert first.kwargs["sql"] == sql
    # The second pins the literal SQL that goes on to be estimated as
    # `executed_sql`, which `raise_for_access` prefers over re-rendering
    # `sql` with `template_params` -- the same handle the execution path
    # uses in `_validate_rendered_access`.
    assert second.kwargs["query"].executed_sql == "SELECT * FROM rendered_tbl"
    assert "sql" not in second.kwargs
    assert "template_params" not in second.kwargs
    assert second.kwargs["force_dataset_match"] is True
    assert (
        mock_database.db_engine_spec.estimate_query_cost.call_args.args[3]
        == "SELECT * FROM rendered_tbl"
    )


@patch("superset.commands.sql_lab.estimate.app")
@patch("superset.commands.sql_lab.estimate.get_template_processor")
@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_gives_the_processor_the_query_location(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
    mock_get_template_processor: MagicMock,
    mock_app: MagicMock,
) -> None:
    """The execution path builds its processor from the query, which carries the
    selected schema and catalog. Nothing is persisted here, so an unpersisted
    query carries them instead -- without it a macro resolving an unqualified
    table (``latest_partition``) would read the connection's defaults and
    estimate different SQL than Run."""
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
    mock_database = MagicMock()
    mock_database.db_engine_spec.engine = "presto"
    mock_database.allow_dml = False
    mock_database.db_engine_spec.query_cost_formatter.return_value = []
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None
    processor = mock_get_template_processor.return_value
    processor.process_template.return_value = "SELECT 1"
    processor.get_undefined_parameters.return_value = set()

    command = QueryEstimationCommand(
        _make_params(sql="SELECT 1", schema="not_default", catalog="not_default_cat")
    )
    command.run()

    query = mock_get_template_processor.call_args.kwargs["query"]
    assert query.schema == "not_default"
    assert query.catalog == "not_default_cat"


# ---------------------------------------------------------------------------
# The command's own error handling, with a real template processor
# ---------------------------------------------------------------------------


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
@patch("superset.commands.sql_lab.estimate.app")
@patch("superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock)
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_reports_malformed_jinja_in_a_parameter_value(
    mock_dao: MagicMock,
    mock_security_manager: MagicMock,
    mock_app: MagicMock,
) -> None:
    """A parameter *value* carrying malformed Jinja survives rendering and is
    only rejected when the rendered SQL is parsed again to look for undefined
    parameters. That parse raises a raw jinja2 error, which has to reach the
    caller as a 400 rather than escaping as a 500 -- as it does on the
    execution path, where the same check sits inside ``render``'s catch.

    Deliberately built on a real template processor: with the processor mocked
    the command never runs the code that raises, so the handling around it
    cannot be exercised."""
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
    mock_database = MagicMock()
    mock_database.backend = "postgresql"
    mock_database.db_engine_spec.engine = "postgresql"
    mock_database.allow_dml = False
    mock_dao.find_by_id.return_value = mock_database
    mock_security_manager.raise_for_access.return_value = None

    command = QueryEstimationCommand(
        _make_params(
            sql="SELECT {{ x }} AS d",
            # Valid SQL once rendered -- a string literal -- so the parse that
            # strips comments succeeds and the Jinja parse is what raises.
            template_params={"x": "'{% for %}'"},
        )
    )
    with pytest.raises(SupersetErrorException) as exc_info:
        command.run()

    assert exc_info.value.status == 400
    assert exc_info.value.error.error_type == SupersetErrorType.GENERIC_COMMAND_ERROR
    # The jinja2 reason is carried through rather than replaced by a generic
    # message -- `run()` wraps it as `message=str(ex)`.
    assert "end of statement block" in exc_info.value.error.message
    mock_database.db_engine_spec.estimate_query_cost.assert_not_called()


# ---------------------------------------------------------------------------
# What is authorized is the rendered text, checked through the real gate
# ---------------------------------------------------------------------------


@with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
@patch("superset.commands.sql_lab.estimate.app")
@patch("superset.commands.sql_lab.estimate.get_template_processor")
@patch("superset.commands.sql_lab.estimate.DatabaseDAO")
def test_run_refuses_a_render_the_caller_cannot_access(
    mock_dao: MagicMock,
    mock_get_template_processor: MagicMock,
    mock_app: MagicMock,
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """A template whose render reaches a table the caller cannot read is refused.

    ``security_manager`` is deliberately *not* mocked -- only the grants
    underneath it are -- so the refusal comes from ``raise_for_access`` running
    for real on the rendered text. The source authorizes cleanly against a
    registered ``allowed_ds``; the render does not, and the estimate is the
    render.

    The call *shape* (pinned as ``executed_sql``, the handle
    ``_validate_rendered_access`` uses) is asserted separately in
    ``test_run_reauthorizes_the_rendered_sql``: pinning and passing ``sql=``
    authorize the same text while no template params are supplied, so this
    test cannot tell them apart and does not try to.
    """
    mock_app.config = {
        "DISALLOWED_SQL_FUNCTIONS": {},
        "DISALLOWED_SQL_TABLES": {},
        "SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 10,
        "QUERY_COST_FORMATTERS_BY_ENGINE": {},
    }
    database = Database(
        id=1, database_name="my_database", sqlalchemy_uri="postgresql://u:p@h/db"
    )
    mock_dao.find_by_id.return_value = database

    # No database/schema/catalog grant: access can only come from a dataset.
    mocker.patch.object(security_manager, "can_access_database", return_value=False)
    mocker.patch.object(security_manager, "can_access_catalog", return_value=False)
    mocker.patch.object(security_manager, "can_access_schema", return_value=False)
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    mocker.patch.object(security_manager, "is_editor", return_value=False)
    mocker.patch.object(
        security_manager,
        "can_access",
        side_effect=lambda perm, vm: perm == "datasource_access",
    )
    # `allowed_ds` is registered; `secret_tbl` is not, so it cannot resolve to
    # a dataset the caller holds `datasource_access` on.
    SqlaTable = mocker.patch(  # noqa: N806
        "superset.connectors.sqla.models.SqlaTable"
    )
    SqlaTable.query_datasources_by_name.side_effect = (
        lambda _database, table_name, catalog=None, schema=None: (
            [mocker.Mock(perm="[my_database].[allowed_ds](id:1)")]
            if table_name == "allowed_ds"
            else []
        )
    )

    processor = mock_get_template_processor.return_value
    processor.process_template.return_value = "SELECT * FROM secret_tbl"
    processor.get_undefined_parameters.return_value = set()

    estimate_query_cost = mocker.patch.object(
        database.db_engine_spec, "estimate_query_cost"
    )

    command = QueryEstimationCommand(
        _make_params(sql="SELECT * FROM allowed_ds", schema="public")
    )
    with pytest.raises(SupersetSecurityException):
        command.run()

    estimate_query_cost.assert_not_called()
