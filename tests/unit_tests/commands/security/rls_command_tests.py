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
    table.database_id = 1
    table.schema = "public"
    return table


def get_unwrapped_func(func):
    """Bypass decorators like @transaction"""
    if hasattr(func, "__wrapped__"):
        return get_unwrapped_func(func.__wrapped__)
    return func


def test_validate_rls_clause_subquery_detection():
    # Valid fragments
    validate_rls_clause("id = 1", "postgresql")
    validate_rls_clause("id IN (1, 2, 3)", "postgresql")
    validate_rls_clause("id IS NULL", "postgresql")

    # Invalid fragments (subqueries)
    with pytest.raises(SupersetSecurityException):
        validate_rls_clause("id IN (SELECT 1)", "postgresql")

    with pytest.raises(SupersetSecurityException):
        validate_rls_clause("EXISTS (SELECT 1)", "postgresql")

    with pytest.raises(SupersetSecurityException):
        validate_rls_clause("1=1 OR (SELECT count(*) FROM users) > 0", "postgresql")


def test_validate_rls_clause_scenarios():
    # CTEs with subqueries should be blocked
    with pytest.raises(SupersetSecurityException):
        validate_rls_clause(
            "WITH cte AS (SELECT 1) SELECT * FROM cte", "postgresql"
        )

    # DML mutations should be blocked
    with pytest.raises(SupersetSecurityException):
        validate_rls_clause("1=1; DELETE FROM users", "postgresql")


def test_validate_adhoc_subquery_coverage():
    mock_db = MagicMock()
    mock_db.db_engine_spec.engine = "postgresql"

    # Should not raise if subqueries are allowed
    with patch("superset.models.helpers.is_feature_enabled", return_value=True):
        validate_adhoc_subquery("SELECT 1", mock_db, None, "public", "postgresql")

    # Should raise if subqueries are blocked
    with patch("superset.models.helpers.is_feature_enabled", return_value=False):
        with pytest.raises(SupersetSecurityException):
            validate_adhoc_subquery("SELECT 1", mock_db, None, "public", "postgresql")


def test_create_rls_command_run_success(
    mock_dataset_dao, mock_rls_dao, mock_populate
):
    data = {
        "name": "rule1",
        "clause": "id = 1",
        "tables": [1],
        "roles": [1],
        "filter_type": "Regular",
    }
    mock_dataset_dao.find_by_ids.return_value = [MagicMock()]
    mock_rls_dao.create.return_value = MagicMock()

    # Bypass @transaction decorator for unit test
    command = CreateRLSRuleCommand(data)
    get_unwrapped_func(command.run)(command)

    mock_rls_dao.create.assert_called_once()


@patch("superset.commands.security.create.db")
def test_create_rls_command_duplicate_name(mock_db, mock_dataset_dao):
    data = {"name": "duplicate", "clause": "1=1", "tables": [1]}
    mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value = (
        MagicMock()
    )

    command = CreateRLSRuleCommand(data)
    with pytest.raises(RLSRuleInvalidError) as ex:
        command.validate()
    assert "Name must be unique" in str(ex.value)


def test_create_command_validate_error_paths(mock_populate, mock_dataset_dao):
    # Datasource not found
    mock_dataset_dao.find_by_ids.return_value = []
    command = CreateRLSRuleCommand({"tables": [99]})
    with pytest.raises(DatasourceNotFoundValidationError):
        command.validate()

    # Roles not found
    mock_dataset_dao.find_by_ids.return_value = [MagicMock()]
    with patch(
        "superset.commands.security.create.populate_roles",
        side_effect=RolesNotFoundValidationError(),
    ):
        command = CreateRLSRuleCommand({"tables": [1], "roles": [99]})
        with pytest.raises(RolesNotFoundValidationError):
            command.validate()


def test_create_rls_command_baseline_validation(mock_dataset_dao):
    # Clause validation without tables
    mock_dataset_dao.find_by_ids.return_value = []
    command = CreateRLSRuleCommand({"clause": "id IN (SELECT 1)", "tables": []})
    with pytest.raises(RLSRuleInvalidError):
        command.validate()


def test_update_rls_command_run_success(
    mock_rls_dao, mock_dataset_dao, mock_populate
):
    data = {"name": "updated", "clause": "id = 2", "tables": [1]}
    mock_rls_dao.find_by_id.return_value = MagicMock()
    mock_dataset_dao.find_by_ids.return_value = [MagicMock()]

    command = UpdateRLSRuleCommand(1, data)
    get_unwrapped_func(command.run)(command)

    mock_rls_dao.update.assert_called_once()


def test_update_rls_command_not_found(mock_rls_dao):
    mock_rls_dao.find_by_id.return_value = None
    command = UpdateRLSRuleCommand(1, {"name": "test"})
    with pytest.raises(RLSRuleNotFoundError):
        command.validate()


@patch("superset.commands.security.update.db")
def test_update_rls_command_duplicate_name(mock_db, mock_rls_dao, mock_dataset_dao):
    mock_rls_dao.find_by_id.return_value = MagicMock()
    mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value = (
        MagicMock()
    )

    command = UpdateRLSRuleCommand(1, {"name": "duplicate"})
    with pytest.raises(RLSRuleInvalidError):
        command.validate()


def test_update_rls_command_datasource_not_found(mock_dataset_dao, mock_rls_dao):
    mock_rls_dao.find_by_id.return_value = MagicMock()
    mock_dataset_dao.find_by_ids.return_value = []
    command = UpdateRLSRuleCommand(1, {"tables": [99]})
    with pytest.raises(DatasourceNotFoundValidationError):
        command.validate()


def test_update_rls_command_baseline_validation(mock_rls_dao):
    mock_rls_dao.find_by_id.return_value = MagicMock()
    command = UpdateRLSRuleCommand(1, {"clause": "id IN (SELECT 1)", "tables": []})
    with pytest.raises(RLSRuleInvalidError):
        command.validate()


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


def test_delete_command_success(mock_rls_dao):
    mock_rls_dao.find_by_ids.return_value = [MagicMock()]
    command = DeleteRLSRuleCommand([1])
    get_unwrapped_func(command.run)(command)
    mock_rls_dao.delete.assert_called_once()


@patch("superset.commands.security.delete.RLSDAO")
def test_delete_command_not_found(mock_rls_dao):
    mock_rls_dao.find_by_ids.return_value = []
    command = DeleteRLSRuleCommand([1])
    with pytest.raises(RLSRuleNotFoundError):
        get_unwrapped_func(command.run)(command)


def test_api_post_error_paths(app):
    with app.test_request_context():
        # Duplicate name should return 422
        with patch(
            "superset.commands.security.create.CreateRLSRuleCommand.run",
            side_effect=RLSRuleInvalidError([ValidationError("Name must be unique")]),
        ):
            client = app.test_client()
            rv = client.post("/api/v1/rowlevelfilter/", json={"name": "dup"})
            assert rv.status_code == 422


def test_api_post_success(app):
    with app.test_request_context():
        with patch(
            "superset.commands.security.create.CreateRLSRuleCommand.run",
            return_value=MagicMock(id=1),
        ):
            client = app.test_client()
            rv = client.post(
                "/api/v1/rowlevelfilter/",
                json={"name": "new", "clause": "1=1", "filter_type": "Regular"},
            )
            assert rv.status_code == 201


def test_api_put_error_paths(app):
    with app.test_request_context():
        with patch(
            "superset.commands.security.update.UpdateRLSRuleCommand.run",
            side_effect=RLSRuleNotFoundError(),
        ):
            client = app.test_client()
            rv = client.put("/api/v1/rowlevelfilter/99", json={"name": "test"})
            assert rv.status_code == 404


def test_api_put_success(app):
    with app.test_request_context():
        with patch(
            "superset.commands.security.update.UpdateRLSRuleCommand.run",
            return_value=MagicMock(),
        ):
            client = app.test_client()
            rv = client.put("/api/v1/rowlevelfilter/1", json={"name": "updated"})
            assert rv.status_code == 200


def test_api_bulk_delete_coverage(app):
    with app.test_request_context():
        with patch(
            "superset.commands.security.delete.DeleteRLSRuleCommand.run",
            side_effect=RLSRuleNotFoundError(),
        ):
            client = app.test_client()
            rv = client.delete("/api/v1/rowlevelfilter/?q=![1]")
            assert rv.status_code == 404


@patch("superset.connectors.sqla.models.security_manager")
@patch("superset.connectors.sqla.models.is_feature_enabled")
def test_sqla_table_get_rls_filters_validation(mock_feature, mock_sm, mock_table):
    mock_feature.return_value = False
    mock_filter = MagicMock()
    mock_filter.clause = "id IN (SELECT 1)"
    mock_sm.get_rls_filters.return_value = [mock_filter]

    # Assign method to mock instance
    mock_table.get_sqla_row_level_filters = (
        SqlaTable.get_sqla_row_level_filters.__get__(mock_table, SqlaTable)
    )

    with patch.object(mock_table, "get_template_processor") as mock_tp:
        mock_tp_inst = mock_tp.return_value
        mock_tp_inst.process_template.side_effect = lambda x: x

        with pytest.raises(SupersetSecurityException):
            mock_table.get_sqla_row_level_filters()


@patch("superset.connectors.sqla.models.security_manager")
@patch("superset.connectors.sqla.models.is_feature_enabled")
def test_sqla_table_get_guest_rls_filters_validation(mock_feature, mock_sm, mock_table):
    mock_feature.return_value = True
    mock_rule = {"clause": "id IN (SELECT 1)"}
    # Ensure they return lists even if called as async in CI
    mock_sm.get_guest_rls_filters.side_effect = lambda x: [mock_rule]
    mock_sm.get_rls_filters.side_effect = lambda x: []

    mock_table.get_sqla_row_level_filters = (
        SqlaTable.get_sqla_row_level_filters.__get__(mock_table, SqlaTable)
    )

    with patch.object(mock_table, "get_template_processor") as mock_tp:
        mock_tp_inst = mock_tp.return_value
        mock_tp_inst.process_template.side_effect = lambda x: x

        with pytest.raises(SupersetSecurityException):
            mock_table.get_sqla_row_level_filters()