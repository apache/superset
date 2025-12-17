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

import uuid

import pytest
from pytest_mock import MockerFixture

from superset.datasource_analyzer.commands.initiate import (
    InitiateDatasourceAnalyzerCommand,
)
from superset.datasource_analyzer.exceptions import (
    DatasourceAnalyzerAccessDeniedError,
    DatasourceAnalyzerDatabaseNotFoundError,
    DatasourceAnalyzerInvalidError,
    DatasourceAnalyzerSchemaNotFoundError,
)


def test_initiate_command_success(mocker: MockerFixture) -> None:
    """Test successful initiation of datasource analysis."""
    database = mocker.MagicMock()
    database.get_all_schema_names.return_value = ["public", "test_schema"]

    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.DatabaseDAO.find_by_id",
        return_value=database,
    )
    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.security_manager.can_access_database",
        return_value=True,
    )

    command = InitiateDatasourceAnalyzerCommand(
        database_id=1,
        schema_name="public",
    )
    result = command.run()

    assert "run_id" in result
    # Verify it's a valid UUID
    uuid.UUID(result["run_id"])


def test_initiate_command_with_catalog(mocker: MockerFixture) -> None:
    """Test initiation with a catalog parameter."""
    database = mocker.MagicMock()
    database.get_all_schema_names.return_value = ["public", "test_schema"]

    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.DatabaseDAO.find_by_id",
        return_value=database,
    )
    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.security_manager.can_access_database",
        return_value=True,
    )

    command = InitiateDatasourceAnalyzerCommand(
        database_id=1,
        schema_name="public",
        catalog_name="my_catalog",
    )
    result = command.run()

    assert "run_id" in result
    database.get_all_schema_names.assert_called_once_with(
        catalog="my_catalog",
        cache=False,
    )


def test_initiate_command_database_not_found(mocker: MockerFixture) -> None:
    """Test that command raises error when database doesn't exist."""
    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.DatabaseDAO.find_by_id",
        return_value=None,
    )

    command = InitiateDatasourceAnalyzerCommand(
        database_id=999,
        schema_name="public",
    )

    with pytest.raises(DatasourceAnalyzerDatabaseNotFoundError):
        command.run()


def test_initiate_command_access_denied(mocker: MockerFixture) -> None:
    """Test that command raises error when user lacks database access."""
    database = mocker.MagicMock()

    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.DatabaseDAO.find_by_id",
        return_value=database,
    )
    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.security_manager.can_access_database",
        return_value=False,
    )

    command = InitiateDatasourceAnalyzerCommand(
        database_id=1,
        schema_name="public",
    )

    with pytest.raises(DatasourceAnalyzerAccessDeniedError):
        command.run()


def test_initiate_command_schema_not_found(mocker: MockerFixture) -> None:
    """Test that command raises error when schema doesn't exist."""
    database = mocker.MagicMock()
    database.get_all_schema_names.return_value = ["public", "other_schema"]

    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.DatabaseDAO.find_by_id",
        return_value=database,
    )
    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.security_manager.can_access_database",
        return_value=True,
    )

    command = InitiateDatasourceAnalyzerCommand(
        database_id=1,
        schema_name="nonexistent_schema",
    )

    with pytest.raises(DatasourceAnalyzerSchemaNotFoundError):
        command.run()


def test_initiate_command_schema_fetch_error(mocker: MockerFixture) -> None:
    """Test that command handles errors when fetching schemas."""
    database = mocker.MagicMock()
    database.get_all_schema_names.side_effect = Exception("Connection failed")

    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.DatabaseDAO.find_by_id",
        return_value=database,
    )
    mocker.patch(
        "superset.datasource_analyzer.commands.initiate.security_manager.can_access_database",
        return_value=True,
    )

    command = InitiateDatasourceAnalyzerCommand(
        database_id=1,
        schema_name="public",
    )

    with pytest.raises(DatasourceAnalyzerInvalidError):
        command.run()
