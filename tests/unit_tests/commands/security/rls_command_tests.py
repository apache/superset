# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  See the NOTICE file distributed with this
# work for additional information regarding copyright ownership.
# The ASF licenses this file to you under the Apache License,
# Version 2.0 (the "License"); you may not use this file
# except in compliance with the License.  You may obtain a copy
# of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from marshmallow import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.exceptions import (
    DatasourceNotFoundValidationError,
    RolesNotFoundValidationError,
)
from superset.commands.security.create import CreateRLSRuleCommand
from superset.commands.security.delete import DeleteRLSRuleCommand
from superset.commands.security.exceptions import (
    RLSRuleInvalidError,
    RLSRuleNotFoundError,
)
from superset.commands.security.update import UpdateRLSRuleCommand
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import SupersetSecurityException
from superset.models.helpers import validate_adhoc_subquery, validate_rls_clause
from superset.row_level_security.api import RLSRestApi


@pytest.fixture
def mock_table():
    table = MagicMock()
    table.database.db_engine_spec.engine = "postgresql"
    table.catalog = None
    table.schema = "public"
    return table


@pytest.fixture
def app():
    app = Flask("superset_test")
    app.config["SECRET_KEY"] = "test"  # noqa: S105
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.extensions["babel"] = MagicMock()
    app.extensions["sqlalchemy"] = MagicMock()
    return app


@pytest.fixture(autouse=True)
def mock_security_manager():
    # Patch security_manager used in DAO filters to avoid g.user access
    with patch("superset.views.base.security_manager") as mock_sm:
        mock_sm.can_access_all_datasources.return_value = True
        yield mock_sm


def get_unwrapped_func(func):
    while hasattr(func, "__wrapped__"):
        func = func.__wrapped__
    return func


# --- Helper Tests ---
def test_validate_rls_clause_subquery_detection():
    with patch("superset.models.helpers._", side_effect=lambda x: x):
        with pytest.raises(SupersetSecurityException) as ex:
            validate_rls_clause("id IN (SELECT id FROM users)", "postgresql")
        assert "Custom SQL fields cannot contain sub-queries" in str(ex.value)


def test_validate_rls_clause_scenarios():
    # 13 attack patterns (UNION, CTE, EXISTS, etc.) blocked.
    # 4 safe SQL patterns confirmed working.
    with patch("superset.models.helpers._", side_effect=lambda x: x):
        # Malicious
        malicious = [
            "1=1 UNION SELECT 1,2,3",
            "EXISTS (SELECT 1 FROM users)",
            "id IN (SELECT id FROM users)",
            "1=1 OR (SELECT COUNT(*) FROM users) > 0",
            "WITH cte AS (SELECT 1) SELECT * FROM cte",  # CTE
            "id = (SELECT max(id) FROM users)",
            "id IN (SELECT id FROM (SELECT id FROM users))",  # Nested
            "id = 1 OR EXISTS(SELECT * FROM table)",
            "id = 1 AND 1=(SELECT 1)",
            "1=1 OR 'a'=(SELECT 'a')",
            "id IN (SELECT id FROM accounts WHERE user_id = 1)",
            "SELECT * FROM (SELECT 1) AS t",  # Subquery in FROM
            "WITH cte AS (UPDATE users SET name = 'x' RETURNING 1) "
            "SELECT * FROM cte",  # CTE with UPDATE
            "WITH cte AS (DELETE FROM users RETURNING 1) "
            "SELECT * FROM cte",  # CTE with DELETE
            "WITH cte AS (INSERT INTO users (id) VALUES (1) RETURNING 1) "
            "SELECT * FROM cte",  # CTE with INSERT
            (
                "MERGE INTO t1 USING (SELECT * FROM t2) AS s ON t1.id = s.id "
                "WHEN MATCHED THEN UPDATE SET name = s.name"
            ),
        ]
        for clause in malicious:
            with pytest.raises(SupersetSecurityException):
                validate_rls_clause(clause, "postgresql")

        # Safe
        safe = [
            "id = 1",
            "col IS NULL",
            "col IN (1, 2, 3)",
            "col LIKE '%test%'",
            "col = 'user_a' OR col = 'user_b'",
            "date > '2023-01-01'",
            "col = 'OR (SELECT 1)'",  # String literal that looks like subquery
        ]
        for clause in safe:
            validate_rls_clause(clause, "postgresql")


def test_validate_adhoc_subquery_coverage():
    # Hit the local import line in helpers.py
    with patch("superset.models.helpers._", side_effect=lambda x: x):
        res = validate_adhoc_subquery(
            "id = 1", MagicMock(), None, "public", "postgresql"
        )
        assert "id = 1" in res


# --- Command Tests ---
@patch("superset.commands.security.create.db.session.query")
@patch("superset.commands.security.create.DatasetDAO")
@patch("superset.commands.security.create.RLSDAO")
@patch("superset.commands.security.create.populate_roles")
def test_create_rls_command_run_success(
    mock_populate, mock_rls_dao, mock_dataset_dao, mock_query, mock_table
):
    mock_dataset_dao.find_by_ids.return_value = [mock_table]
    mock_rls_dao.create.return_value = MagicMock()
    # Mock uniqueness check
    mock_query.return_value.filter_by.return_value.one_or_none.return_value = None

    data = {"name": "test", "clause": "1=1", "tables": [1], "roles": [1]}
    command = CreateRLSRuleCommand(data)
    # Bypass transaction decorator
    get_unwrapped_func(command.run)(command)
    assert mock_rls_dao.create.called


@patch("superset.commands.security.create.DatasetDAO")
@patch("superset.commands.security.create.db.session.query")
def test_create_rls_command_duplicate_name(mock_query, mock_dataset_dao):
    mock_query.return_value.filter_by.return_value.one_or_none.return_value = (
        MagicMock()
    )
    mock_dataset_dao.find_by_ids.return_value = [MagicMock()]  # Found the table
    command = CreateRLSRuleCommand({"name": "exists", "tables": [1]})
    with pytest.raises(RLSRuleInvalidError):
        command.validate()


@patch("superset.commands.security.create.DatasetDAO")
@patch("superset.commands.security.create.populate_roles")
def test_create_command_validate_error_paths(mock_populate, mock_dataset_dao):
    # No tables found
    mock_dataset_dao.find_by_ids.return_value = []
    command = CreateRLSRuleCommand({"tables": [1]})
    with pytest.raises(DatasourceNotFoundValidationError):
        command.validate()


@patch("superset.commands.security.create.DatasetDAO")
def test_create_rls_command_baseline_validation(mock_dataset_dao):
    mock_dataset_dao.find_by_ids.return_value = []
    # Malicious clause with no tables (triggers baseline validation)
    command = CreateRLSRuleCommand({"clause": "id IN (SELECT 1)", "tables": []})
    with pytest.raises(RLSRuleInvalidError):
        command.validate()


@patch("superset.commands.security.update.db.session.query")
@patch("superset.commands.security.update.RLSDAO")
@patch("superset.commands.security.update.DatasetDAO")
@patch("superset.commands.security.update.populate_roles")
def test_update_rls_command_run_success(
    mock_populate, mock_dataset_dao, mock_rls_dao, mock_query, mock_table
):
    mock_dataset_dao.find_by_ids.return_value = [mock_table]
    mock_model = MagicMock()
    mock_model.tables = [mock_table]
    mock_rls_dao.find_by_id.return_value = mock_model
    mock_rls_dao.update.return_value = mock_model
    # Mock uniqueness check
    mock_query.return_value.filter_by.return_value.one_or_none.return_value = None

    data = {"clause": "2=2", "tables": [1]}
    command = UpdateRLSRuleCommand(1, data)
    get_unwrapped_func(command.run)(command)
    assert mock_rls_dao.update.called


@patch("superset.commands.security.update.RLSDAO")
def test_update_rls_command_not_found(mock_rls_dao):
    mock_rls_dao.find_by_id.return_value = None
    command = UpdateRLSRuleCommand(999, {"clause": "1=1"})
    with pytest.raises(RLSRuleNotFoundError):
        command.validate()


@patch("superset.commands.security.update.DatasetDAO")
@patch("superset.commands.security.update.db.session.query")
@patch("superset.commands.security.update.RLSDAO")
def test_update_rls_command_duplicate_name(mock_rls_dao, mock_query, mock_dataset_dao):
    mock_model = MagicMock()
    mock_model.id = 1
    mock_rls_dao.find_by_id.return_value = mock_model
    mock_dataset_dao.find_by_ids.return_value = [MagicMock()]  # Found the table

    mock_existing = MagicMock()
    mock_existing.id = 2
    mock_query.return_value.filter_by.return_value.one_or_none.return_value = (
        mock_existing
    )

    command = UpdateRLSRuleCommand(1, {"name": "exists", "tables": [1]})
    with pytest.raises(RLSRuleInvalidError):
        command.validate()


@patch("superset.commands.security.update.RLSDAO")
@patch("superset.commands.security.update.DatasetDAO")
def test_update_rls_command_datasource_not_found(mock_dataset_dao, mock_rls_dao):
    mock_rls_dao.find_by_id.return_value = MagicMock()
    mock_dataset_dao.find_by_ids.return_value = []  # Found 0 instead of 1
    command = UpdateRLSRuleCommand(1, {"tables": [1]})
    with pytest.raises(DatasourceNotFoundValidationError):
        command.validate()


@patch("superset.commands.security.update.RLSDAO")
def test_update_rls_command_baseline_validation(mock_rls_dao):
    mock_model = MagicMock()
    mock_model.tables = []
    mock_rls_dao.find_by_id.return_value = mock_model
    # Malicious clause should trigger baseline validation failure
    command = UpdateRLSRuleCommand(1, {"clause": "id IN (SELECT 1)"})
    with pytest.raises(RLSRuleInvalidError):
        command.validate()


@patch("superset.commands.security.delete.RLSDAO")
def test_delete_command_success(mock_rls_dao):
    mock_rls_dao.find_by_ids.return_value = [MagicMock()]
    command = DeleteRLSRuleCommand([1])
    get_unwrapped_func(command.run)(command)
    assert mock_rls_dao.delete.called


# --- API Tests ---
def test_api_post_error_paths(app):
    api = RLSRestApi()
    api.response_422 = MagicMock(return_value=MagicMock(status_code=422))
    api.response_400 = MagicMock(return_value=MagicMock(status_code=400))
    api.response = MagicMock(return_value=MagicMock(status_code=201))
    post_func = get_unwrapped_func(api.post)

    with app.test_request_context(json={"name": "test"}):
        # ValidationError
        with patch.object(
            api.add_model_schema, "load", side_effect=ValidationError({"err": "msg"})
        ):
            res = post_func(api)
            assert res.status_code == 400
        # RLSRuleInvalidError
        with patch.object(api.add_model_schema, "load", return_value={"name": "test"}):
            with patch(
                "superset.row_level_security.api.CreateRLSRuleCommand"
            ) as mock_command:
                mock_cmd_inst = mock_command.return_value
                mock_cmd_inst.run.side_effect = RLSRuleInvalidError(
                    exceptions=[MagicMock()]
                )
                res = post_func(api)
                assert res.status_code == 422

                mock_cmd_inst.run.side_effect = RolesNotFoundValidationError()
                res = post_func(api)
                assert res.status_code == 422

                mock_cmd_inst.run.side_effect = DatasourceNotFoundValidationError()
                res = post_func(api)
                assert res.status_code == 422

                mock_cmd_inst.run.side_effect = SQLAlchemyError()
                res = post_func(api)
                assert res.status_code == 422


def test_api_post_success(app):
    api = RLSRestApi()
    api.response = MagicMock(return_value=MagicMock(status_code=201))
    post_func = get_unwrapped_func(api.post)

    with app.test_request_context(json={"name": "test"}):
        with patch.object(api.add_model_schema, "load", return_value={"name": "test"}):
            with patch(
                "superset.row_level_security.api.CreateRLSRuleCommand"
            ) as mock_command:
                mock_model = MagicMock()
                mock_model.id = 123
                mock_command.return_value.run.return_value = mock_model
                res = post_func(api)
                assert res.status_code == 201


def test_api_put_error_paths(app):
    api = RLSRestApi()
    api.response_422 = MagicMock(return_value=MagicMock(status_code=422))
    api.response_404 = MagicMock(return_value=MagicMock(status_code=404))
    api.response_400 = MagicMock(return_value=MagicMock(status_code=400))
    put_func = get_unwrapped_func(api.put)

    with app.test_request_context(json={"clause": "1=1"}):
        # ValidationError
        with patch.object(
            api.edit_model_schema, "load", side_effect=ValidationError({"err": "msg"})
        ):
            res = put_func(api, pk=1)
            assert res.status_code == 400
        with patch.object(
            api.edit_model_schema, "load", return_value={"clause": "1=1"}
        ):
            with patch(
                "superset.row_level_security.api.UpdateRLSRuleCommand"
            ) as mock_command:
                mock_cmd_inst = mock_command.return_value
                mock_cmd_inst.run.side_effect = RLSRuleInvalidError(
                    exceptions=[MagicMock()]
                )
                res = put_func(api, pk=1)
                assert res.status_code == 422

                mock_cmd_inst.run.side_effect = RLSRuleNotFoundError()
                res = put_func(api, pk=1)
                assert res.status_code == 404


def test_api_put_success(app):
    api = RLSRestApi()
    api.response = MagicMock(return_value=MagicMock(status_code=200))
    put_func = get_unwrapped_func(api.put)

    with app.test_request_context(json={"clause": "1=1"}):
        with patch.object(
            api.edit_model_schema, "load", return_value={"clause": "1=1"}
        ):
            with patch(
                "superset.row_level_security.api.UpdateRLSRuleCommand"
            ) as mock_command:
                mock_command.return_value.run.return_value = MagicMock()
                res = put_func(api, pk=1)
                assert res.status_code == 200


def test_api_bulk_delete_coverage(app):
    api = RLSRestApi()
    api.response = MagicMock(return_value=MagicMock(status_code=200))
    api.response_404 = MagicMock(return_value=MagicMock(status_code=404))
    bulk_delete_func = get_unwrapped_func(api.bulk_delete)

    with app.test_request_context():
        # Success
        with patch(
            "superset.row_level_security.api.DeleteRLSRuleCommand"
        ) as mock_command:
            with patch("superset.row_level_security.api.ngettext", return_value="msg"):
                res = bulk_delete_func(api, rison=[1, 2])
                assert res.status_code == 200

        # Not found
        with patch(
            "superset.row_level_security.api.DeleteRLSRuleCommand"
        ) as mock_command:
            # Patch the run method of the instance returned by the class call
            mock_command.return_value.run.side_effect = RLSRuleNotFoundError()
            res = bulk_delete_func(api, rison=[1, 2])
            assert res.status_code == 404


@patch("superset.connectors.sqla.models.security_manager")
def test_sqla_table_get_rls_filters_validation(mock_sm, mock_table):
    from unittest.mock import MagicMock

    mock_filter = MagicMock()
    mock_filter.clause = "id IN (SELECT id FROM users)"
    mock_filter.group_key = None

    # Ensure it's not an AsyncMock
    mock_sm.get_rls_filters = MagicMock(return_value=[mock_filter])

    mock_table.database.backend = "postgresql"
    mock_table.database.db_engine_spec.engine = "postgresql"
    mock_table.database_id = 1

    # Bind the real method to the mock object

    mock_table.get_sqla_row_level_filters = (
        SqlaTable.get_sqla_row_level_filters.__get__(mock_table, SqlaTable)
    )

    # Mock dependencies needed by _process_select_expression
    with patch.object(mock_table, "get_template_processor") as mock_tp:
        mock_tp_inst = mock_tp.return_value
        mock_tp_inst.process_template.side_effect = lambda x: x

        # We need to mock _process_select_expression with a proper
        # SupersetSecurityException
        from superset.errors import ErrorLevel, SupersetError, SupersetErrorType

        error = SupersetError(
            message="BLOCKED",
            error_type=SupersetErrorType.ADHOC_SUBQUERY_NOT_ALLOWED_ERROR,
            level=ErrorLevel.ERROR,
        )
        from superset.exceptions import SupersetSecurityException

        with patch.object(
            mock_table,
            "_process_select_expression",
            side_effect=SupersetSecurityException(error),
        ):
            with pytest.raises(SupersetSecurityException):
                mock_table.get_sqla_row_level_filters()

@patch("superset.commands.security.update.RLSDAO")
def test_update_rls_command_existing_tables_validation(mock_rls_dao):
    mock_model = MagicMock()
    mock_table = MagicMock()
    mock_table.database.db_engine_spec.engine = "postgresql"
    mock_model.tables = [mock_table]
    mock_rls_dao.find_by_id.return_value = mock_model

    # No tables in properties, should use existing model tables
    command = UpdateRLSRuleCommand(1, {"clause": "id IN (SELECT 1)"})
    with pytest.raises(RLSRuleInvalidError):
        command.validate()

@patch("superset.commands.security.delete.RLSDAO")
def test_delete_command_not_found(mock_rls_dao):
    mock_rls_dao.find_by_ids.return_value = []
    command = DeleteRLSRuleCommand([1])
    with pytest.raises(RLSRuleNotFoundError):
        get_unwrapped_func(command.run)(command)
