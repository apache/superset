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
from superset.exceptions import SupersetSecurityException
from superset.models.helpers import validate_rls_clause
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
    app.extensions["babel"] = MagicMock()
    return app


# --- Helper Tests ---
def test_validate_rls_clause_subquery_detection():
    with patch("superset.models.helpers._", side_effect=lambda x: x):
        with pytest.raises(SupersetSecurityException) as ex:
            validate_rls_clause("id IN (SELECT id FROM users)", "postgresql")
        assert "Custom SQL fields cannot contain sub-queries" in str(ex.value)


# --- Command Tests ---
@patch("superset.commands.security.create.DatasetDAO")
@patch("superset.commands.security.create.RLSDAO")
@patch("superset.commands.security.create.populate_roles")
def test_create_rls_command_run_success(
    mock_populate, mock_rls_dao, mock_dataset_dao, mock_table
):
    mock_dataset_dao.find_by_ids.return_value = [mock_table]
    mock_rls_dao.create.return_value = MagicMock()
    data = {"name": "test", "clause": "1=1", "tables": [1], "roles": [1]}
    command = CreateRLSRuleCommand(data)
    command.run()
    assert mock_rls_dao.create.called


@patch("superset.commands.security.create.DatasetDAO")
@patch("superset.commands.security.create.populate_roles")
def test_create_command_validate_table_iteration(
    mock_populate, mock_dataset_dao, mock_table
):
    # Coverage for table iteration in validate
    mock_dataset_dao.find_by_ids.return_value = [mock_table]
    data = {"clause": "(SELECT 1)", "tables": [1], "roles": []}
    command = CreateRLSRuleCommand(data)
    with pytest.raises(RLSRuleInvalidError):
        command.validate()


@patch("superset.commands.security.update.RLSDAO")
@patch("superset.commands.security.update.DatasetDAO")
@patch("superset.commands.security.update.populate_roles")
def test_update_rls_command_run_success(
    mock_populate, mock_dataset_dao, mock_rls_dao, mock_table
):
    mock_dataset_dao.find_by_ids.return_value = [mock_table]
    mock_model = MagicMock()
    mock_model.tables = [mock_table]
    mock_rls_dao.find_by_id.return_value = mock_model
    mock_rls_dao.update.return_value = mock_model
    data = {"clause": "2=2", "tables": [1]}
    command = UpdateRLSRuleCommand(1, data)
    command.run()
    assert mock_rls_dao.update.called


@patch("superset.commands.security.update.RLSDAO")
@patch("superset.commands.security.update.DatasetDAO")
@patch("superset.commands.security.update.populate_roles")
def test_update_command_validate_table_iteration(
    mock_populate, mock_dataset_dao, mock_rls_dao, mock_table
):
    mock_model = MagicMock()
    mock_model.tables = [mock_table]
    mock_rls_dao.find_by_id.return_value = mock_model
    # Coverage for the table loop in update.py:82
    data = {"clause": "(SELECT 1)", "tables": [1]}
    command = UpdateRLSRuleCommand(1, data)
    with pytest.raises(RLSRuleInvalidError):
        command.validate()


@patch("superset.commands.security.delete.RLSDAO")
def test_delete_command_success(mock_rls_dao):
    mock_rls_dao.find_by_ids.return_value = [MagicMock()]
    command = DeleteRLSRuleCommand([1])
    command.run()
    assert mock_rls_dao.delete.called


# --- API Tests ---
def test_api_post_error_paths(app):
    api = RLSRestApi()
    api.response_422 = MagicMock()
    api.response_400 = MagicMock()
    api.response = MagicMock()
    with app.test_request_context(json={"name": "test"}):
        # ValidationError
        with patch.object(
            api.add_model_schema, "load", side_effect=ValidationError({"err": "msg"})
        ):
            api.post.__wrapped__(api)
            assert api.response_400.called
        # RLSRuleInvalidError
        with patch.object(api.add_model_schema, "load", return_value={"name": "test"}):
            with patch(
                "superset.row_level_security.api.CreateRLSRuleCommand"
            ) as mock_command:
                mock_command.return_value.run.side_effect = RLSRuleInvalidError(
                    exceptions=[MagicMock()]
                )
                api.post.__wrapped__(api)
                assert api.response_422.called
            with patch(
                "superset.row_level_security.api.CreateRLSRuleCommand"
            ) as mock_command:
                mock_command.return_value.run.side_effect = (
                    RolesNotFoundValidationError()
                )
                api.post.__wrapped__(api)
                assert api.response_422.called
            with patch(
                "superset.row_level_security.api.CreateRLSRuleCommand"
            ) as mock_command:
                mock_command.return_value.run.side_effect = (
                    DatasourceNotFoundValidationError()
                )
                api.post.__wrapped__(api)
                assert api.response_422.called
            with patch(
                "superset.row_level_security.api.CreateRLSRuleCommand"
            ) as mock_command:
                mock_command.return_value.run.side_effect = SQLAlchemyError()
                api.post.__wrapped__(api)
                assert api.response_422.called


def test_api_put_error_paths(app):
    api = RLSRestApi()
    api.response_422 = MagicMock()
    api.response_404 = MagicMock()
    api.response_400 = MagicMock()
    with app.test_request_context(json={"clause": "1=1"}):
        # ValidationError
        with patch.object(
            api.edit_model_schema, "load", side_effect=ValidationError({"err": "msg"})
        ):
            api.put.__wrapped__(api, pk=1)
            assert api.response_400.called
        with patch.object(
            api.edit_model_schema, "load", return_value={"clause": "1=1"}
        ):
            with patch(
                "superset.row_level_security.api.UpdateRLSRuleCommand"
            ) as mock_command:
                mock_command.return_value.run.side_effect = RLSRuleInvalidError(
                    exceptions=[MagicMock()]
                )
                api.put.__wrapped__(api, pk=1)
                assert api.response_422.called
            with patch(
                "superset.row_level_security.api.UpdateRLSRuleCommand"
            ) as mock_command:
                mock_command.return_value.run.side_effect = (
                    RolesNotFoundValidationError()
                )
                api.put.__wrapped__(api, pk=1)
                assert api.response_422.called
            with patch(
                "superset.row_level_security.api.UpdateRLSRuleCommand"
            ) as mock_command:
                mock_command.return_value.run.side_effect = (
                    DatasourceNotFoundValidationError()
                )
                api.put.__wrapped__(api, pk=1)
                assert api.response_422.called
            with patch(
                "superset.row_level_security.api.UpdateRLSRuleCommand"
            ) as mock_command:
                mock_command.return_value.run.side_effect = SQLAlchemyError()
                api.put.__wrapped__(api, pk=1)
                assert api.response_422.called
            with patch(
                "superset.row_level_security.api.UpdateRLSRuleCommand"
            ) as mock_command:
                mock_command.return_value.run.side_effect = RLSRuleNotFoundError()
                api.put.__wrapped__(api, pk=1)
                assert api.response_404.called


def test_api_bulk_delete_coverage(app):
    api = RLSRestApi()
    api.response = MagicMock()
    api.response_404 = MagicMock()
    with app.test_request_context():
        with patch(
            "superset.row_level_security.api.DeleteRLSRuleCommand"
        ) as mock_command:
            # Success
            api.bulk_delete.__wrapped__(api, rison=[1, 2])
            assert api.response.called
            # Not found
            mock_command.return_value.run.side_effect = RLSRuleNotFoundError()
            api.bulk_delete.__wrapped__(api, rison=[1, 2])
            assert api.response_404.called
