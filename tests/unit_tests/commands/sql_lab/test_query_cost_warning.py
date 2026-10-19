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
"""Warning checks must describe execution SQL without hiding errors or bounds."""

from typing import Any, cast
from unittest.mock import MagicMock

import pytest
from flask import Flask
from pytest_mock import MockerFixture

from superset import config
from superset.commands.sql_lab.estimate import (
    EstimateQueryCostType,
    QueryEstimationCommand,
)
from superset.commands.sql_lab.execute import ExecuteSqlCommand
from superset.db_engine_specs.base import BaseEngineSpec, QueryCostEstimate
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetDisallowedSQLFunctionException,
    SupersetDisallowedSQLTableException,
    SupersetDMLNotAllowedException,
    SupersetErrorException,
    SupersetParseError,
    SupersetSecurityException,
    SupersetTimeoutException,
)
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.parse import SQLScript
from superset.sql_lab import apply_limit
from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext
from superset.utils import json


class WarningTestEngineSpec(BaseEngineSpec):
    """Exercise a verified metric independently of its production engine adapters."""

    engine = "sqlite"

    @classmethod
    def get_allow_cost_estimate(cls, extra: dict[str, Any]) -> bool:
        """Allow estimates when the connection has also opted in."""
        return True

    @classmethod
    def get_query_cost_warning_metric(cls) -> str | None:
        """Opt this test engine into the existing planner-cost metric."""
        return "total_cost"

    @classmethod
    def estimate_query_cost_for_warning(
        cls, database: Database, catalog: str | None, schema: str, sql: str
    ) -> QueryCostEstimate:
        """Return an unrounded decimal estimate without contacting a database."""
        return QueryCostEstimate.from_value(10.25)


def _make_command(
    mocker: MockerFixture, engine: str = "postgresql", **params: Any
) -> QueryEstimationCommand:
    """Use real engine specs, SQL parsing, rule validation and execution limits."""
    metric = "bytes_processed" if engine == "bigquery" else "total_cost"
    database = Database(
        id=1,
        database_name="warning_test",
        sqlalchemy_uri=f"{engine}://localhost/test",
        extra=json.dumps(
            {
                "cost_estimate_enabled": True,
                "query_cost_warning": {
                    "enabled": True,
                    "metric": metric,
                    "threshold": 10,
                },
            }
        ),
        allow_dml=False,
    )
    parameters: dict[str, Any] = {
        "database_id": 1,
        "sql": "SELECT * FROM sales",
        "catalog": "selected_catalog",
        "schema": "selected_schema",
        "template_params": {},
        "query_limit": 100,
        "check_warning": True,
        **params,
    }
    command = QueryEstimationCommand(cast(EstimateQueryCostType, parameters))
    mocker.patch(
        "superset.commands.sql_lab.estimate.DatabaseDAO.find_by_id",
        return_value=database,
    )
    mocker.patch(
        "superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock
    )
    mocker.patch(
        "superset.commands.sql_lab.estimate.is_feature_enabled",
        side_effect=lambda name: name
        in {"SQLLAB_QUERY_COST_WARNINGS", "ESTIMATE_QUERY_COST"},
    )
    mocker.patch.object(database, "get_default_catalog", return_value="default_catalog")
    mocker.patch.object(
        database.db_engine_spec,
        "estimate_query_cost_for_warning",
        return_value=QueryCostEstimate.from_value(5),
    )
    return command


def _set_extra(command: QueryEstimationCommand, extra: dict[str, Any]) -> None:
    """Replace raw saved settings so invalid data cannot use the display fallback."""
    command.validate()
    command._database.extra = json.dumps(extra)


def _estimator(command: QueryEstimationCommand) -> MagicMock:
    """Type the engine hook replaced by the test setup's synchronous mock."""
    return cast(
        MagicMock, command._database.db_engine_spec.estimate_query_cost_for_warning
    )


def _run_warning(command: QueryEstimationCommand) -> dict[str, Any]:
    """Narrow the endpoint's manual-or-warning result to the requested warning."""
    result = command.run()
    assert isinstance(result, dict)
    return result


@pytest.mark.parametrize("engine", ["bigquery", "postgresql"])
@pytest.mark.parametrize(
    "value,status",
    [(0, "within_threshold"), (10, "within_threshold"), (11, "exceeded")],
)
def test_warning_comparison(
    mocker: MockerFixture, engine: str, value: int, status: str
) -> None:
    """Compare raw native values with strict greater-than, including valid zero."""
    command = _make_command(mocker, engine)
    command.validate()
    _estimator(command).return_value = QueryCostEstimate.from_value(value)
    result = _run_warning(command)
    assert isinstance(result, dict)
    assert result["status"] == status
    assert result["value"] == value
    assert result["threshold"] == 10
    assert result["metric"] == (
        "bytes_processed" if engine == "bigquery" else "total_cost"
    )
    assert result["unit"] == ("bytes" if engine == "bigquery" else "planner cost units")
    assert result["label"]
    assert result["message"]


def test_warning_compares_postgres_decimals_before_display(
    mocker: MockerFixture,
) -> None:
    """A planner estimate just above a decimal threshold must warn before rounding."""
    command = _make_command(mocker)
    _set_extra(
        command,
        {
            "cost_estimate_enabled": True,
            "query_cost_warning": {
                "enabled": True,
                "metric": "total_cost",
                "threshold": 10.125,
            },
        },
    )
    _estimator(command).return_value = QueryCostEstimate.from_value(10.12501)
    result = _run_warning(command)
    assert result["status"] == "exceeded"
    assert result["value"] == 10.12501


@pytest.mark.parametrize("metric", ["total_cost", "unknown", ""])
def test_warning_command_uses_metric_contract_for_test_engine(
    mocker: MockerFixture, metric: str
) -> None:
    """Known metrics work without engine-name branches; unknown ones never estimate."""
    command = _make_command(mocker, "sqlite")
    mocker.patch.object(
        Database,
        "db_engine_spec",
        new_callable=mocker.PropertyMock,
        return_value=WarningTestEngineSpec,
    )
    if metric != "total_cost":
        mocker.patch.object(
            WarningTestEngineSpec, "get_query_cost_warning_metric", return_value=metric
        )
    estimator = mocker.spy(WarningTestEngineSpec, "estimate_query_cost_for_warning")
    result = _run_warning(command)
    if metric != "total_cost":
        assert result == {"status": "unsupported"}
        estimator.assert_not_called()
    else:
        assert result["status"] == "exceeded"
        assert result["value"] == 10.25
        assert result["threshold"] == 10
        assert result["metric"] == "total_cost"
        assert result["label"] == "Estimated planner cost"
        assert result["unit"] == "planner cost units"
        estimator.assert_called_once()


@pytest.mark.parametrize(
    "value,accuracy,masked,status",
    [
        (10, "LOWER_BOUND", False, "unavailable"),
        (9, "LOWER_BOUND", False, "unavailable"),
        (11, "LOWER_BOUND", False, "exceeded"),
        (10, "UPPER_BOUND", False, "within_threshold"),
        (11, "UPPER_BOUND", False, "exceeded"),
        (0, "UNKNOWN", False, "unavailable"),
        (11, None, False, "unavailable"),
        (11, "PRECISE", True, "unavailable"),
        (2**63 - 1, "PRECISE", False, "exceeded"),
    ],
)
def test_warning_preserves_bigquery_bounds(
    mocker: MockerFixture, value: int, accuracy: str | None, masked: bool, status: str
) -> None:
    """Unknown or masked bytes never imply safety; bounds keep their meaning."""
    command = _make_command(mocker, "bigquery")
    command.validate()
    _estimator(command).return_value = QueryCostEstimate.from_value(
        value, accuracy, masked
    )
    result = _run_warning(command)
    assert result["status"] == status
    assert result["accuracy"] == accuracy
    assert result["row_level_security_applied"] is masked
    assert result["value"] == (
        None if masked or accuracy in {None, "UNKNOWN"} else value
    )


def test_warning_compares_large_bytes_exactly(mocker: MockerFixture) -> None:
    """A one-byte difference near JavaScript's integer boundary is compared here."""
    command = _make_command(mocker, "bigquery")
    _set_extra(
        command,
        {
            "cost_estimate_enabled": True,
            "query_cost_warning": {
                "enabled": True,
                "metric": "bytes_processed",
                "threshold": 2**53 - 1,
            },
        },
    )
    _estimator(command).return_value = QueryCostEstimate.from_value(2**53)
    assert _run_warning(command)["status"] == "exceeded"


def test_warning_unusable_estimate(mocker: MockerFixture) -> None:
    """An unusable engine estimate is unavailable, not within threshold."""
    command = _make_command(mocker)
    command.validate()
    _estimator(command).return_value = QueryCostEstimate()
    result = _run_warning(command)
    assert result["status"] == "unavailable"
    assert result["value"] is None


@pytest.mark.parametrize("flag", ["SQLLAB_QUERY_COST_WARNINGS", "ESTIMATE_QUERY_COST"])
def test_warning_flag_off_still_checks_access(mocker: MockerFixture, flag: str) -> None:
    """Even disabled checks first run the existing database/table authorization."""
    command = _make_command(mocker)
    flags = mocker.patch(
        "superset.commands.sql_lab.estimate.is_feature_enabled",
        side_effect=lambda name: name != flag,
    )
    assert _run_warning(command) == {"status": "disabled"}
    _estimator(command).assert_not_called()
    manager = mocker.patch(
        "superset.commands.sql_lab.estimate.security_manager", new_callable=MagicMock
    )
    access = manager.raise_for_access
    access.side_effect = SupersetSecurityException(
        SupersetError(
            message="Denied",
            error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    flags.reset_mock()
    with pytest.raises(SupersetSecurityException):
        _run_warning(command)
    access.assert_called_once()
    flags.assert_not_called()


@pytest.mark.parametrize(
    "extra",
    [
        {
            "cost_estimate_enabled": False,
            "query_cost_warning": {
                "enabled": True,
                "metric": "total_cost",
                "threshold": 10,
            },
        },
        {
            "cost_estimate_enabled": True,
            "query_cost_warning": {
                "enabled": False,
                "metric": "total_cost",
                "threshold": 10,
            },
        },
        {"cost_estimate_enabled": True},
    ],
)
def test_warning_connection_opt_out(
    mocker: MockerFixture, extra: dict[str, Any]
) -> None:
    """Connection estimation and explicit warning opt-in are independent switches."""
    command = _make_command(mocker)
    _set_extra(command, extra)
    assert _run_warning(command) == {"status": "disabled"}
    _estimator(command).assert_not_called()


def test_warning_unsupported_engine(mocker: MockerFixture) -> None:
    """Unsupported engines differ from supported engines with unestimatable SQL."""
    command = _make_command(mocker, "sqlite")
    assert _run_warning(command) == {"status": "unsupported"}
    _estimator(command).assert_not_called()


@pytest.mark.parametrize(
    "rule",
    [
        None,
        {"enabled": "true"},
        {"enabled": True},
        {"enabled": True, "metric": "bytes_processed", "threshold": 10},
        {"enabled": True, "metric": "total_cost", "threshold": "10"},
        {"enabled": True, "metric": "unknown", "threshold": 10},
        {"enabled": False, "threshold": -1},
    ],
)
def test_warning_invalid_rule_is_an_error(mocker: MockerFixture, rule: object) -> None:
    """Invalid saved rules remain errors instead of allowing execution."""
    command = _make_command(mocker)
    _set_extra(
        command,
        {
            "cost_estimate_enabled": True,
            "query_cost_warning": rule,
        },
    )
    with pytest.raises(SupersetErrorException) as error:
        _run_warning(command)
    assert error.value.status == 400
    _estimator(command).assert_not_called()


@pytest.mark.parametrize(
    "sql,params,reason",
    [
        ("SELECT {{ amount }}", {}, "templates"),
        ("SELECT 1", {"amount": 1}, "templates"),
        ("SELECT 1 {# comment #}", {}, "templates"),
        ("SELECT 1; SELECT 2", {}, "single read-only SELECT"),
        ("SHOW TABLES", {}, "single read-only SELECT"),
        ("CREATE TABLE t AS SELECT 1", {}, "single read-only SELECT"),
        ("SELECT * INTO t FROM sales", {}, "single read-only SELECT"),
        (
            "WITH deleted AS (DELETE FROM sales RETURNING *) SELECT * FROM deleted",
            {},
            "single read-only SELECT",
        ),
    ],
)
def test_warning_unestimatable_sql(
    mocker: MockerFixture, sql: str, params: dict[str, Any], reason: str
) -> None:
    """Only a single read-only SELECT is eligible for the initial warning check."""
    command = _make_command(mocker, sql=sql, template_params=params)
    command.validate()
    command._database.allow_dml = True
    result = _run_warning(command)
    assert result["status"] == "unavailable"
    assert reason in result["message"]
    _estimator(command).assert_not_called()


@pytest.mark.parametrize("custom", ["SQL_QUERY_MUTATOR", "CUSTOM_TEMPLATE_PROCESSORS"])
def test_warning_rejects_custom_transformations(
    mocker: MockerFixture, app: Flask, custom: str
) -> None:
    """Do not run arbitrary transformations to predict a future execution render."""
    command = _make_command(mocker)
    transform = mocker.MagicMock()
    mocker.patch.dict(
        app.config,
        {
            custom: transform
            if custom == "SQL_QUERY_MUTATOR"
            else {"postgresql": transform}
        },
    )
    mocker.patch(
        "superset.commands.sql_lab.estimate.is_feature_enabled",
        side_effect=lambda name: name != "RLS_IN_SQLLAB",
    )
    assert _run_warning(command)["status"] == "unavailable"
    transform.assert_not_called()


@pytest.mark.parametrize("engine", ["postgresql", "bigquery"])
@pytest.mark.parametrize(
    "sql_limit,dropdown,maximum,expected",
    [
        (None, 100, 50000, 101),
        (5, 100, 50000, 6),
        (500, 100, 50000, 101),
        (100, 100, 50000, 101),
        (None, 100, 20, 21),
        (None, None, 20, 21),
        (None, 0, 20, 21),
        (0, 100, 50000, 50001),
        (None, -1, 20, 21),
    ],
)
def test_warning_matches_execution_sql_limits(
    mocker: MockerFixture,
    app: Flask,
    engine: str,
    sql_limit: int | None,
    dropdown: int | None,
    maximum: int,
    expected: int,
) -> None:
    """Exercise the actual execution context, command and final extra-row rewrite."""
    sql = "SELECT * FROM sales" + (  # noqa: S608
        f" LIMIT {sql_limit}" if sql_limit is not None else ""
    )
    command = _make_command(mocker, engine, sql=sql, query_limit=dropdown)
    mocker.patch.dict(
        app.config,
        {"SQL_MAX_ROW": maximum, "SQL_QUERY_MUTATOR": config.SQL_QUERY_MUTATOR},
    )
    _run_warning(command)
    database = command._database
    estimator = _estimator(command)
    prepared = estimator.call_args.args[3]

    context = SqlJsonExecutionContext(
        {"database_id": 1, "sql": sql, "queryLimit": dropdown}
    )
    context.set_database(database)
    context.set_query(Query(database=database))
    execute = ExecuteSqlCommand(
        context,
        MagicMock(),
        MagicMock(),
        MagicMock(),
        MagicMock(),
        MagicMock(),
        MagicMock(),
        False,
    )
    execute._set_query_limit_if_required(sql)
    script = SQLScript(sql, engine=engine)
    apply_limit(context.query, script.statements[0])
    assert prepared == script.format(
        comments=database.db_engine_spec.allows_sql_comments
    )
    assert (
        SQLScript(prepared, engine=engine).statements[0].get_limit_value() == expected
    )
    assert estimator.call_args.args[1:3] == ("selected_catalog", "selected_schema")


def test_warning_resolves_execution_default_catalog(mocker: MockerFixture) -> None:
    """Unspecified catalogs use the same database default as SQL Lab execution."""
    command = _make_command(mocker, catalog=None, schema=None)
    _run_warning(command)
    assert _estimator(command).call_args.args[1:3] == ("default_catalog", "")


def test_warning_estimates_rls_constrained_sql(mocker: MockerFixture) -> None:
    """Security controls and RLS injection run before the final execution limit."""
    command = _make_command(mocker)
    mocker.patch(
        "superset.commands.sql_lab.estimate.is_feature_enabled", return_value=True
    )
    command.validate()
    mocker.patch.object(
        command._database,
        "resolve_query_default_schema",
        return_value="selected_schema",
    )

    mocker.patch(
        "superset.utils.rls.get_predicates_for_table", return_value=["tenant_id = 1"]
    )
    _run_warning(command)
    prepared = _estimator(command).call_args.args[3]
    assert "tenant_id = 1" in prepared
    assert "LIMIT 101" in prepared


@pytest.mark.parametrize(
    "error",
    [
        ConnectionError("network failed"),
        TimeoutError("native network timeout"),
        RuntimeError("unexpected failure"),
        ValueError("native maximum bytes billed exceeded"),
        OAuth2RedirectError("test", "tab", "https://example.invalid/oauth"),
    ],
)
def test_warning_real_errors_propagate(mocker: MockerFixture, error: Exception) -> None:
    """Native limits, network, OAuth and unexpected errors never become unavailable."""
    command = _make_command(mocker)
    command.validate()
    _estimator(command).side_effect = error
    with pytest.raises(type(error)):
        _run_warning(command)


def test_warning_known_timeout_is_unavailable(mocker: MockerFixture) -> None:
    """Only the known estimation timeout is an advisory unavailable result."""
    command = _make_command(mocker)
    command.validate()
    _estimator(command).side_effect = SupersetTimeoutException(
        SupersetErrorType.SQLLAB_TIMEOUT_ERROR, "timed out", ErrorLevel.ERROR
    )
    result = _run_warning(command)
    assert result["status"] == "unavailable"
    assert "timed out" in result["message"]


@pytest.mark.parametrize(
    "sql,setting,expected",
    [
        ("DELETE FROM sales", {}, SupersetDMLNotAllowedException),
        (
            "SELECT * FROM sales",
            {"DISALLOWED_SQL_TABLES": {"postgresql": {"sales"}}},
            SupersetDisallowedSQLTableException,
        ),
        (
            "SELECT forbidden()",
            {"DISALLOWED_SQL_FUNCTIONS": {"postgresql": {"forbidden"}}},
            SupersetDisallowedSQLFunctionException,
        ),
        ("SELECT * FROM", {}, SupersetParseError),
    ],
)
def test_warning_sql_errors_are_not_unavailable(
    mocker: MockerFixture,
    app: Flask,
    sql: str,
    setting: dict[str, Any],
    expected: type[Exception],
) -> None:
    """Keep SQL parse errors and the existing execution controls as actual errors."""
    command = _make_command(mocker, sql=sql)
    command.validate()
    mocker.patch.object(
        command._database,
        "resolve_query_default_schema",
        return_value="selected_schema",
    )
    mocker.patch.dict(app.config, setting)
    with pytest.raises(expected):
        _run_warning(command)
    _estimator(command).assert_not_called()


def test_warning_endpoint(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    """The existing protected endpoint accepts the optional warning request fields."""
    _make_command(mocker)
    response = client.post(
        "/api/v1/sqllab/estimate/",
        json={
            "database_id": 1,
            "sql": "SELECT * FROM sales",
            "catalog": "selected_catalog",
            "schema": "selected_schema",
            "template_params": {},
            "query_limit": 100,
            "check_warning": True,
        },
    )
    assert response.status_code == 200
    assert response.json["result"]["status"] == "within_threshold"


def test_warning_endpoint_rejects_invalid_input(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    """Malformed warning requests fail request validation before a warehouse call."""
    command = mocker.patch("superset.sqllab.api.QueryEstimationCommand")
    response = client.post(
        "/api/v1/sqllab/estimate/",
        json={
            "database_id": 1,
            "sql": "SELECT 1",
            "check_warning": True,
            "query_limit": "100",
        },
    )
    assert response.status_code == 400
    command.assert_not_called()


def test_warning_endpoint_invalid_rule_is_error(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    """Bad stored configuration is an HTTP error rather than a usable status."""
    command = _make_command(mocker)
    _set_extra(
        command,
        {"cost_estimate_enabled": True, "query_cost_warning": {"enabled": True}},
    )
    response = client.post(
        "/api/v1/sqllab/estimate/",
        json={"database_id": 1, "sql": "SELECT 1", "check_warning": True},
    )
    assert response.status_code == 400
    assert "status" not in response.json


def test_warning_endpoint_keeps_manual_response(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    """Requests without check_warning retain the manual list and formatter inputs."""
    command = _make_command(mocker)
    command.validate()
    spec = command._database.db_engine_spec
    estimate = mocker.patch.object(
        spec, "estimate_query_cost", return_value=[{"Total cost": 5.125}]
    )
    formatter = mocker.patch.object(
        spec, "query_cost_formatter", return_value=[{"Total cost": "5.1"}]
    )
    response = client.post(
        "/api/v1/sqllab/estimate/", json={"database_id": 1, "sql": "SELECT 1"}
    )
    assert response.status_code == 200
    assert response.json == {"result": [{"Total cost": "5.1"}]}
    formatter.assert_called_once_with([{"Total cost": 5.125}])
    estimate.assert_called_once()
    _estimator(command).assert_not_called()
