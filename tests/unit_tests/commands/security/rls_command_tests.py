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
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.extensions["babel"] = MagicMock()
    app.extensions["sqlalchemy"] = MagicMock()
    return app


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
    # Bypass transaction decorator
    get_unwrapped_func(command.run)(command)
    assert mock_rls_dao.create.called


@patch("superset.commands.security.create.DatasetDAO")
@patch("superset.commands.security.create.populate_roles")
def test_create_command_validate_error_paths(mock_populate, mock_dataset_dao):
    # No tables found
    mock_dataset_dao.find_by_ids.return_value = []
    command = CreateRLSRuleCommand({"tables": [1]})
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
    get_unwrapped_func(command.run)(command)
    assert mock_rls_dao.update.called


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
