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

import os
import subprocess
import sys
from pathlib import Path
from textwrap import dedent
from typing import Any, cast
from unittest.mock import MagicMock

import pytest
from flask import Flask
from flask_appbuilder.security.sqla.models import (
    Permission,
    PermissionView,
    Role,
    User,
    ViewMenu,
)
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

from superset import config, security_manager
from superset.commands.sql_lab.estimate import (
    EstimateQueryCostType,
    QueryEstimationCommand,
)
from superset.commands.sql_lab.execute import ExecuteSqlCommand
from superset.connectors.sqla.models import SqlaTable
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.query_warning import (
    QueryCostEstimate,
    QueryCostThresholdCheck,
)
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


@pytest.mark.parametrize("all_users", [None, False, True])
@pytest.mark.parametrize(
    "can_execute,can_estimate,data_access",
    [
        (True, False, True),
        (True, True, True),
        (False, True, True),
        (False, False, True),
        (True, False, False),
    ],
)
def test_warning_api_audience_and_permissions(
    app: Flask,
    session: Session,
    mocker: MockerFixture,
    can_execute: bool,
    can_estimate: bool,
    all_users: bool | None,
    data_access: bool,
) -> None:
    """Connection opt-in expands only warning access, never manual or SQL access."""
    # Use isolated security tables and real permission checks, not full_api_access.
    User.metadata.create_all(
        session.get_bind(),
        tables=[
            table
            for table in User.metadata.sorted_tables
            if table.name.startswith("ab_") or table.name in {"user_attribute", "logs"}
        ],
    )
    permissions = ["can_execute_sql_query"] if can_execute else []
    if can_estimate:
        permissions.append("can_estimate_query_cost")
    view = ViewMenu(name="SQLLab")
    role = Role(
        name="WarningTestRole",
        permissions=[
            PermissionView(permission=Permission(name=name), view_menu=view)
            for name in permissions
        ],
    )
    dataset_perm = "[warning_test].[sales](id:1)"
    if data_access:
        role.permissions.append(
            PermissionView(
                permission=Permission(name="datasource_access"),
                view_menu=ViewMenu(name=dataset_perm),
            )
        )
    user = User(
        username="warning_test",
        first_name="Warning",
        last_name="Test",
        email="warning@example.invalid",
        active=True,
        roles=[role],
    )
    session.add(user)
    session.commit()
    mocker.patch.object(app.login_manager, "_user_callback", return_value=user)
    database = Database(
        id=1,
        database_name="warning_test",
        sqlalchemy_uri="postgresql://localhost/test",
        extra=json.dumps(
            {
                "cost_estimate_enabled": True,
                "query_cost_warning": {
                    "enabled": True,
                    **({"all_users": all_users} if all_users is not None else {}),
                    "metric": "total_cost",
                    "threshold": 10,
                },
            }
        ),
    )
    mocker.patch(
        "superset.commands.sql_lab.estimate.DatabaseDAO.find_by_id",
        return_value=database,
    )
    mocker.patch.object(database, "get_default_catalog", return_value="test")
    mocker.patch.object(database, "get_default_schema_for_query", return_value="public")
    mocker.patch.object(
        SqlaTable,
        "query_datasources_by_name",
        return_value=[
            SqlaTable(
                database=database,
                table_name="sales",
                schema="public",
                perm=dataset_perm,
            )
        ],
    )
    access = mocker.spy(security_manager, "raise_for_access")
    mocker.patch(
        "superset.commands.sql_lab.estimate.is_feature_enabled",
        side_effect=lambda name: (
            name in {"SQLLAB_QUERY_COST_WARNINGS", "ESTIMATE_QUERY_COST"}
        ),
    )
    mocker.patch("superset.models.core.is_feature_enabled", return_value=True)
    mocker.patch(
        "superset.db_engine_specs.query_warning.is_feature_enabled", return_value=True
    )
    estimator = mocker.patch.object(
        database.db_engine_spec,
        "estimate_query_cost_for_warning",
        return_value=QueryCostEstimate.from_value(20),
    )
    manual = mocker.patch.object(QueryEstimationCommand, "_run_manual_estimate")
    with app.app_context(), app.test_client() as anonymous_client:
        anonymous = anonymous_client.post(
            "/api/v1/sqllab/warning/",
            json={"database_id": 1, "sql": "SELECT * FROM public.sales"},
        )
        assert anonymous.status_code == 401
        access.assert_not_called()
        estimator.assert_not_called()
    with app.test_client() as client:
        with client.session_transaction() as login:
            login["_user_id"] = str(user.id)
            login["_fresh"] = True
        # Empty bodies stop authorized requests at validation without executing SQL.
        execute = client.post("/api/v1/sqllab/execute/", json={})
        estimate = client.post("/api/v1/sqllab/estimate/", json={})
        warning = client.post(
            "/api/v1/sqllab/warning/",
            json={
                "database_id": 1,
                "sql": "SELECT * FROM public.sales",
                "catalog": "test",
                "schema": "public",
            },
        )
        if can_execute:
            assert database.query_warning_state == (
                "ready" if all_users or can_estimate else "disabled"
            )
    missing_inputs = {
        "message": {
            "database_id": ["Missing data for required field."],
            "sql": ["Missing data for required field."],
        }
    }
    assert execute.status_code == (400 if can_execute else 403)
    if can_execute:
        assert execute.json == missing_inputs
    assert estimate.status_code == (400 if can_estimate else 403)
    if can_estimate:
        assert estimate.json == missing_inputs
    else:
        assert estimate.json == {"message": "Forbidden"}
    assert warning.status_code == (200 if can_execute and data_access else 403)
    if can_execute:
        access.assert_called_once_with(
            database=database,
            sql="SELECT * FROM public.sales",
            catalog="test",
            schema="public",
            template_params={},
            force_dataset_match=True,
        )
        if data_access:
            assert warning.json["result"]["action"] == (
                "confirm" if all_users or can_estimate else "proceed"
            )
    else:
        access.assert_not_called()
    assert estimator.call_count == int(
        can_execute and data_access and (all_users or can_estimate)
    )
    manual.assert_not_called()


@pytest.mark.parametrize("app", [{"WTF_CSRF_ENABLED": True}], indirect=True)
def test_warning_endpoint_requires_csrf(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    """Browser warning requests retain CSRF protection even with API permission."""
    command = mocker.patch("superset.sqllab.api.QueryEstimationCommand")
    response = client.post(
        "/api/v1/sqllab/warning/", json={"database_id": 1, "sql": "SELECT 1"}
    )
    assert response.status_code == 400
    assert "CSRF token is missing" in response.get_data(as_text=True)
    command.assert_not_called()


class WarningTestEngineSpec(BaseEngineSpec):
    """Exercise a verified metric independently of its production engine adapters."""

    engine = "sqlite"

    @classmethod
    def get_allow_cost_estimate(cls, extra: dict[str, Any]) -> bool:
        """Allow estimates when the connection has also opted in."""
        return True

    @classmethod
    def get_query_warning_check(cls) -> QueryCostThresholdCheck | None:
        """Opt this test engine into the shared numeric check."""
        return QueryCostThresholdCheck("total_cost")

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
    mocker.patch(
        "superset.db_engine_specs.query_warning.security_manager.has_access",
        return_value=True,
    )
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
        side_effect=lambda name: (
            name in {"SQLLAB_QUERY_COST_WARNINGS", "ESTIMATE_QUERY_COST"}
        ),
    )
    mocker.patch(
        "superset.db_engine_specs.query_warning.is_feature_enabled", return_value=True
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
    return dict(result)


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
    if status == "within_threshold":
        assert result == {"action": "proceed"}
    else:
        assert result["action"] == "confirm"
        assert result["reason"] == "warning"
        assert result["message"]
        unit = "bytes" if engine == "bigquery" else "planner cost units"
        assert result["details"][0]["value"] == f"{value:,} {unit}"
        assert result["details"][1] == {
            "label": "Warning threshold",
            "value": f"10 {unit}",
        }


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
    assert result["reason"] == "warning"
    assert result["details"][0]["value"] == "10.12501 planner cost units"
    assert result["details"][1]["value"] == "10.125 planner cost units"


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
            WarningTestEngineSpec,
            "get_query_warning_check",
            return_value=QueryCostThresholdCheck(metric),
        )
    estimator = mocker.spy(WarningTestEngineSpec, "estimate_query_cost_for_warning")
    if metric != "total_cost":
        with pytest.raises(SupersetErrorException) as error:
            _run_warning(command)
        assert error.value.status == 400
        estimator.assert_not_called()
    else:
        result = _run_warning(command)
        assert result["action"] == "confirm"
        assert result["reason"] == "warning"
        assert result["details"] == [
            {"label": "Estimated planner cost", "value": "10.25 planner cost units"},
            {"label": "Warning threshold", "value": "10 planner cost units"},
        ]
        estimator.assert_called_once()


@pytest.mark.parametrize("enabled", [True, False])
def test_warning_command_delegates_to_engine_check(
    mocker: MockerFixture, client: Any, full_api_access: None, enabled: bool
) -> None:
    """The protected API uses a message-only check with manual estimation off."""
    from tests.fixtures.query_warning import MessageOnlyQueryWarningCheck

    command = _make_command(mocker)
    mocker.patch(
        "superset.db_engine_specs.query_warning.security_manager.has_access",
        side_effect=lambda permission, view: permission == "can_execute_sql_query",
    )
    rule = {"enabled": enabled, "all_users": True}
    _set_extra(command, {"query_cost_warning": rule, "cost_estimate_enabled": False})
    check = MessageOnlyQueryWarningCheck()
    validate = mocker.spy(check, "validate")
    assess = mocker.spy(check, "assess")
    mocker.patch(
        "superset.commands.sql_lab.estimate.is_feature_enabled",
        side_effect=lambda name: name == "SQLLAB_QUERY_COST_WARNINGS",
    )
    mocker.patch(
        "superset.db_engine_specs.query_warning.is_feature_enabled", return_value=False
    )
    mocker.patch.object(
        command._database.db_engine_spec, "get_query_warning_check", return_value=check
    )
    response = client.post(
        "/api/v1/sqllab/warning/",
        json={
            "database_id": 1,
            "sql": "SELECT * FROM sales",
            "catalog": "selected_catalog",
            "schema": "selected_schema",
            "query_limit": 100,
        },
    )
    assert response.status_code == 200
    assert response.json == {
        "result": (
            {"action": "confirm", "reason": "warning", "message": "Review this query."}
            if enabled
            else {"action": "proceed"}
        )
    }
    validate.assert_called_once_with(rule)
    assert command._database.allows_cost_estimate is False
    if enabled:
        assess.assert_called_once()
        database, catalog, schema, sql, assessed_rule = assess.call_args.args
        assert database is command._database
        assert catalog == "selected_catalog"
        assert schema == "selected_schema"
        assert (
            SQLScript(sql, engine="postgresql").statements[0].get_limit_value() == 101
        )
        assert assessed_rule == rule
    else:
        assess.assert_not_called()
    _estimator(command).assert_not_called()


@pytest.mark.parametrize(
    "value,accuracy,status",
    [
        (10, "LOWER_BOUND", "unavailable"),
        (9, "LOWER_BOUND", "unavailable"),
        (11, "LOWER_BOUND", "exceeded"),
        (10, "UPPER_BOUND", "within_threshold"),
        (11, "UPPER_BOUND", "exceeded"),
        (0, "UNKNOWN", "unavailable"),
        (11, None, "unavailable"),
        (2**63 - 1, "PRECISE", "exceeded"),
    ],
)
def test_warning_preserves_bigquery_bounds(
    mocker: MockerFixture, value: int, accuracy: str | None, status: str
) -> None:
    """Unknown bounds never imply safety; usable bounds keep their meaning."""
    command = _make_command(mocker, "bigquery")
    command.validate()
    _estimator(command).return_value = QueryCostEstimate.from_value(value, accuracy)
    result = _run_warning(command)
    if status == "within_threshold":
        assert result == {"action": "proceed"}
    else:
        assert result["action"] == "confirm"
        assert result["reason"] == (
            "warning" if status == "exceeded" else "unavailable"
        )
        assert result["message"]
        if accuracy in {"PRECISE", "LOWER_BOUND", "UPPER_BOUND"}:
            prefix = {"LOWER_BOUND": "At least ", "UPPER_BOUND": "Up to "}.get(
                accuracy, ""
            )
            assert result["details"][0]["value"] == f"{prefix}{value:,} bytes"
        else:
            assert result["details"] == [
                {"label": "Warning threshold", "value": "10 bytes"}
            ]


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
    result = _run_warning(command)
    assert result["reason"] == "warning"
    assert result["details"][0]["value"] == "9,007,199,254,740,992 bytes"
    assert result["details"][1]["value"] == "9,007,199,254,740,991 bytes"


@pytest.mark.parametrize(
    "value,unavailable_reason",
    [(None, None), (1, "The estimate does not cover all tables in the query.")],
)
def test_warning_unusable_estimate(
    mocker: MockerFixture, value: int | None, unavailable_reason: str | None
) -> None:
    """An unusable engine estimate is unavailable, not within threshold."""
    command = _make_command(mocker)
    command.validate()
    _estimator(command).return_value = QueryCostEstimate(
        value=value, accuracy="PRECISE", unavailable_reason=unavailable_reason
    )
    result = _run_warning(command)
    assert result["action"] == "confirm"
    assert result["reason"] == "unavailable"
    assert result["message"]
    if unavailable_reason:
        assert result["message"] == unavailable_reason
    assert result["details"] == [
        {"label": "Warning threshold", "value": "10 planner cost units"}
    ]


@pytest.mark.parametrize("flag", ["SQLLAB_QUERY_COST_WARNINGS", "ESTIMATE_QUERY_COST"])
def test_warning_flag_off_still_checks_access(mocker: MockerFixture, flag: str) -> None:
    """Even disabled checks first run the existing database/table authorization."""
    command = _make_command(mocker)
    command.validate()
    extra = json.loads(command._database.extra)
    extra["query_cost_warning"]["all_users"] = True
    _set_extra(command, extra)
    flags = mocker.patch(
        "superset.commands.sql_lab.estimate.is_feature_enabled",
        side_effect=lambda name: name != flag,
    )
    mocker.patch(
        "superset.db_engine_specs.query_warning.is_feature_enabled",
        side_effect=lambda name: name != flag,
    )
    assert _run_warning(command) == {"action": "proceed"}
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
    assert _run_warning(command) == {"action": "proceed"}
    _estimator(command).assert_not_called()


@pytest.mark.parametrize("enabled", [False, True])
def test_warning_unsupported_engine(mocker: MockerFixture, enabled: bool) -> None:
    """Unsupported engines differ from supported engines with unestimatable SQL."""
    command = _make_command(mocker, "sqlite")
    _set_extra(command, {"query_cost_warning": {"enabled": enabled}})
    if enabled:
        with pytest.raises(SupersetErrorException) as error:
            _run_warning(command)
        assert error.value.status == 400
    else:
        assert _run_warning(command) == {"action": "proceed"}
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
    assert result["action"] == "confirm"
    assert result["reason"] == "unavailable"
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
    result = _run_warning(command)
    assert result["action"] == "confirm"
    assert result["reason"] == "unavailable"
    transform.assert_not_called()


def test_warning_rejects_configured_sql_mutator(tmp_path: Path) -> None:
    """Detect overrides loaded before the command imports the config module."""
    config_file = tmp_path / "superset_config.py"
    config_file.write_text(
        "from unittest.mock import Mock\nSQL_QUERY_MUTATOR = Mock()\n",
        encoding="utf-8",
    )
    result = subprocess.run(  # noqa: S603
        [
            sys.executable,
            "-c",
            dedent(
                """
                from unittest.mock import MagicMock, patch

                from superset import config
                from superset.app import create_app

                app = create_app("tests.integration_tests.superset_test_config")

                from superset.commands.sql_lab.estimate import QueryEstimationCommand
                from superset.db_engine_specs.base import QueryCostEstimate
                from superset.db_engine_specs.postgres import PostgresEngineSpec
                from superset.models.core import Database
                from superset.utils import json

                database = Database(
                    sqlalchemy_uri="postgresql://localhost/test",
                    extra=json.dumps({
                        "cost_estimate_enabled": True,
                        "query_cost_warning": {
                            "enabled": True, "all_users": True,
                            "metric": "total_cost", "threshold": 10,
                        },
                    }),
                )
                command = QueryEstimationCommand({
                    "database_id": 1, "sql": "SELECT 1", "catalog": "test",
                    "schema": "public", "template_params": {}, "check_warning": True,
                })
                with (
                    app.app_context(),
                    patch("superset.commands.sql_lab.estimate.DatabaseDAO.find_by_id",
                          return_value=database),
                    patch("superset.commands.sql_lab.estimate.security_manager",
                          new_callable=MagicMock),
                    patch("superset.commands.sql_lab.estimate.is_feature_enabled",
                          side_effect=lambda name: name in {
                              "SQLLAB_QUERY_COST_WARNINGS", "ESTIMATE_QUERY_COST",
                          }),
                    patch("superset.db_engine_specs.query_warning.is_feature_enabled",
                          return_value=True),
                    patch.object(
                        PostgresEngineSpec, "estimate_query_cost_for_warning",
                        return_value=QueryCostEstimate.from_value(1),
                    ) as estimator,
                ):
                    response = command.run()
                    assert response["action"] == "confirm", response
                    assert response["reason"] == "unavailable", response
                    assert "custom SQL transformations" in response["message"]
                    config.SQL_QUERY_MUTATOR.assert_not_called()
                    estimator.assert_not_called()
                """
            ),
        ],
        env={**os.environ, "SUPERSET_CONFIG_PATH": str(config_file)},
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr


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


def test_warning_limit_query_is_detached_from_the_session(
    mocker: MockerFixture,
) -> None:
    """A limit-only Query that reaches the session is expunged before it can flush."""
    command = _make_command(mocker)
    session = mocker.patch("superset.commands.sql_lab.estimate.db").session
    session.__contains__.return_value = True
    result = _run_warning(command)
    session.expunge.assert_called_once()
    assert isinstance(session.expunge.call_args.args[0], Query)
    assert result == {"action": "proceed"}


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


@pytest.mark.parametrize("timed_out", [False, True])
def test_warning_uses_configured_timeout(
    mocker: MockerFixture, app: Flask, timed_out: bool
) -> None:
    """Enter the configured timeout and turn its expiration into confirmation."""
    command = _make_command(mocker)
    command.validate()
    mocker.patch.dict(app.config, {"SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT": 13})
    timeout = mocker.patch("superset.commands.sql_lab.estimate.utils.timeout")
    context = timeout.return_value
    calls = mocker.Mock()
    calls.attach_mock(context.__enter__, "enter")
    calls.attach_mock(_estimator(command), "estimate")
    calls.attach_mock(context.__exit__, "exit")
    if timed_out:
        context.__enter__.side_effect = SupersetTimeoutException(
            SupersetErrorType.SQLLAB_TIMEOUT_ERROR, "timed out", ErrorLevel.ERROR
        )
    result = _run_warning(command)
    timeout.assert_called_once_with(seconds=13, error_message=mocker.ANY)
    context.__enter__.assert_called_once()
    if timed_out:
        assert result["action"] == "confirm"
        assert result["reason"] == "unavailable"
        assert "timed out" in result["message"]
        _estimator(command).assert_not_called()
    else:
        assert result == {"action": "proceed"}
        _estimator(command).assert_called_once()
        context.__exit__.assert_called_once()
        assert [call[0] for call in calls.mock_calls] == ["enter", "estimate", "exit"]


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


@pytest.mark.parametrize("endpoint", ["estimate", "warning"])
@pytest.mark.parametrize("value", [5, 11, None])
def test_warning_endpoint(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    value: int | None,
    endpoint: str,
) -> None:
    """Both assessment endpoints serialize the same decisions and display details."""
    command = _make_command(mocker)
    command.validate()
    _estimator(command).return_value = QueryCostEstimate.from_value(value)
    response = client.post(
        f"/api/v1/sqllab/{endpoint}/",
        json={
            "database_id": 1,
            "sql": "SELECT * FROM sales",
            "catalog": "selected_catalog",
            "schema": "selected_schema",
            "template_params": {},
            "query_limit": 100,
            **({"check_warning": True} if endpoint == "estimate" else {}),
        },
    )
    assert response.status_code == 200
    if value == 5:
        assert response.json["result"] == {"action": "proceed"}
    else:
        details = [{"label": "Warning threshold", "value": "10 planner cost units"}]
        if value is not None:
            details.insert(
                0, {"label": "Estimated planner cost", "value": "11 planner cost units"}
            )
        assert response.json["result"] == {
            "action": "confirm",
            "reason": "unavailable" if value is None else "warning",
            "message": (
                "The estimate is unavailable or cannot establish whether "
                "usage is within the warning threshold."
                if value is None
                else "The estimate exceeds this connection's warning threshold. "
                "Planner cost is relative, not dollars or memory."
            ),
            "details": details,
        }


@pytest.mark.parametrize(
    "field,value,error",
    [
        ("query_limit", "100", "Not a valid integer."),
        ("check_warning", False, "Unknown field."),
        ("all_users", True, "Unknown field."),
    ],
)
def test_warning_endpoint_rejects_invalid_input(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    field: str,
    value: object,
    error: str,
) -> None:
    """Clients cannot request manual estimates or override server-owned policy."""
    command = mocker.patch("superset.sqllab.api.QueryEstimationCommand")
    response = client.post(
        "/api/v1/sqllab/warning/",
        json={"database_id": 1, "sql": "SELECT 1", field: value},
    )
    assert response.status_code == 400
    assert response.json == {"message": {field: [error]}}
    command.assert_not_called()


@pytest.mark.parametrize(
    "rule",
    [
        {"enabled": True},
        {"enabled": True, "metric": "total_cost", "threshold": 10, "all_users": "true"},
    ],
)
def test_warning_endpoint_invalid_rule_is_error(
    mocker: MockerFixture, client: Any, full_api_access: None, rule: dict[str, Any]
) -> None:
    """Bad stored configuration is an error even for a user outside the audience."""
    command = _make_command(mocker)
    mocker.patch(
        "superset.db_engine_specs.query_warning.security_manager.has_access",
        side_effect=lambda permission, view: permission == "can_execute_sql_query",
    )
    _set_extra(
        command,
        {"cost_estimate_enabled": True, "query_cost_warning": rule},
    )
    response = client.post(
        "/api/v1/sqllab/warning/",
        json={"database_id": 1, "sql": "SELECT 1"},
    )
    assert response.status_code == 400
    assert "action" not in response.json
    _estimator(command).assert_not_called()


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
