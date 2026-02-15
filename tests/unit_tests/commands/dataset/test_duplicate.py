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
from unittest.mock import MagicMock, Mock, patch

import pytest

from superset.commands.dataset.duplicate import DuplicateDatasetCommand
from superset.commands.dataset.exceptions import (
    DatasetExistsValidationError,
    DatasetInvalidError,
    DatasetNotFoundError,
)
from superset.commands.exceptions import DatasourceTypeInvalidError
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.models.core import Database


def test_duplicate_dataset_success():
    """Test successful duplication of a virtual dataset."""
    # Create a mock base model (virtual dataset)
    mock_base_model = Mock(spec=SqlaTable)
    mock_base_model.id = 1
    mock_base_model.database_id = 1
    mock_base_model.table_name = "original_dataset"
    mock_base_model.schema = "public"
    mock_base_model.catalog = None
    mock_base_model.kind = "virtual"
    mock_base_model.sql = "SELECT 1 as c"
    mock_base_model.template_params = None
    mock_base_model.normalize_columns = False
    mock_base_model.always_filter_main_dttm = False
    mock_base_model.columns = []
    mock_base_model.metrics = []

    # Create a mock database without spec to allow SQLAlchemy relationship assignment
    mock_database = MagicMock()
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = None
    # Add _sa_instance_state to allow SQLAlchemy relationship assignment
    mock_database._sa_instance_state = MagicMock()

    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=mock_base_model,
    ):
        with patch(
            "superset.commands.dataset.duplicate.db.session.query"
        ) as mock_query:
            mock_query.return_value.get.return_value = mock_database
            with patch(
                "superset.commands.dataset.duplicate.DatasetDAO.validate_uniqueness",
                return_value=True,
            ):
                with patch(
                    "superset.commands.dataset.duplicate.DuplicateDatasetCommand.populate_owners",
                    return_value=[],
                ):
                    with patch("superset.commands.dataset.duplicate.db.session.add"):
                        command = DuplicateDatasetCommand(
                            {
                                "base_model_id": 1,
                                "table_name": "duplicated_dataset",
                                "owners": [],
                            }
                        )

                        # Should not raise any errors
                        command.validate()
                        # Test the actual duplication
                        result = command.run()
                        assert result.table_name == "duplicated_dataset"
                        assert result.database.id == 1
                        assert result.schema == "public"
                        assert result.is_sqllab_view is True
                        assert result.sql == "SELECT 1 as c"


def test_duplicate_dataset_not_found():
    """Test duplication when base dataset doesn't exist."""
    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=None,
    ):
        with patch(
            "superset.commands.dataset.duplicate.DuplicateDatasetCommand.populate_owners",
            return_value=[],
        ):
            command = DuplicateDatasetCommand(
                {
                    "base_model_id": 999,
                    "table_name": "duplicated_dataset",
                    "owners": [],
                }
            )

            with pytest.raises(DatasetInvalidError) as exc_info:
                command.validate()

            # Verify the exception contains DatasetNotFoundError
            validation_errors = exc_info.value._exceptions
            assert any(
                isinstance(error, DatasetNotFoundError) for error in validation_errors
            )


def test_duplicate_dataset_not_virtual():
    """Test that duplication fails for physical (non-virtual) datasets."""
    mock_base_model = Mock(spec=SqlaTable)
    mock_base_model.id = 1
    mock_base_model.database_id = 1
    mock_base_model.kind = "physical"  # Not virtual

    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=mock_base_model,
    ):
        with patch(
            "superset.commands.dataset.duplicate.DuplicateDatasetCommand.populate_owners",
            return_value=[],
        ):
            command = DuplicateDatasetCommand(
                {
                    "base_model_id": 1,
                    "table_name": "duplicated_dataset",
                    "owners": [],
                }
            )

            with pytest.raises(DatasetInvalidError) as exc_info:
                command.validate()

            # Verify the exception contains DatasourceTypeInvalidError
            validation_errors = exc_info.value._exceptions
            assert len(validation_errors) == 1
            assert isinstance(validation_errors[0], DatasourceTypeInvalidError)


def test_duplicate_dataset_name_exists_same_database_schema():
    """Test that duplication fails when name exists in same database/schema."""
    mock_base_model = Mock(spec=SqlaTable)
    mock_base_model.id = 1
    mock_base_model.database_id = 1
    mock_base_model.table_name = "original_dataset"
    mock_base_model.schema = "public"
    mock_base_model.catalog = None
    mock_base_model.kind = "virtual"

    mock_database = Mock(spec=Database)
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = None

    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=mock_base_model,
    ):
        with patch(
            "superset.commands.dataset.duplicate.db.session.query"
        ) as mock_query:
            mock_query.return_value.get.return_value = mock_database
            with patch(
                "superset.commands.dataset.duplicate.DatasetDAO.validate_uniqueness",
                return_value=False,  # Name already exists
            ):
                with patch(
                    "superset.commands.dataset.duplicate.DuplicateDatasetCommand.populate_owners",
                    return_value=[],
                ):
                    command = DuplicateDatasetCommand(
                        {
                            "base_model_id": 1,
                            "table_name": "existing_dataset",
                            "owners": [],
                        }
                    )

                    with pytest.raises(DatasetInvalidError) as exc_info:
                        command.validate()

                    # Verify the exception contains DatasetExistsValidationError
                    validation_errors = exc_info.value._exceptions
                    assert len(validation_errors) == 1
                    assert isinstance(
                        validation_errors[0], DatasetExistsValidationError
                    )


def test_duplicate_dataset_catalog_preserved():
    """Test that catalog is preserved during duplication."""
    mock_base_model = Mock(spec=SqlaTable)
    mock_base_model.id = 1
    mock_base_model.database_id = 1
    mock_base_model.table_name = "original_dataset"
    mock_base_model.schema = "public"
    mock_base_model.catalog = "prod_catalog"
    mock_base_model.kind = "virtual"
    mock_base_model.sql = "SELECT 1 as c"
    mock_base_model.template_params = None
    mock_base_model.normalize_columns = False
    mock_base_model.always_filter_main_dttm = False
    mock_base_model.columns = []
    mock_base_model.metrics = []

    # Create a mock database without spec to allow SQLAlchemy relationship assignment
    mock_database = MagicMock()
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = None
    # Add _sa_instance_state to allow SQLAlchemy relationship assignment
    mock_database._sa_instance_state = MagicMock()

    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=mock_base_model,
    ):
        with patch(
            "superset.commands.dataset.duplicate.db.session.query"
        ) as mock_query:
            mock_query.return_value.get.return_value = mock_database
            with patch(
                "superset.commands.dataset.duplicate.DatasetDAO.validate_uniqueness",
                return_value=True,
            ):
                with patch(
                    "superset.commands.dataset.duplicate.DuplicateDatasetCommand.populate_owners",
                    return_value=[],
                ):
                    with patch("superset.commands.dataset.duplicate.db.session.add"):
                        command = DuplicateDatasetCommand(
                            {
                                "base_model_id": 1,
                                "table_name": "duplicated_dataset",
                                "owners": [],
                            }
                        )

                        result = command.run()

                        # Verify catalog was preserved
                        assert result.catalog == "prod_catalog"


def test_duplicate_dataset_default_catalog_used():
    """Test that catalog=None is preserved when base model has no catalog."""
    mock_base_model = Mock(spec=SqlaTable)
    mock_base_model.id = 1
    mock_base_model.database_id = 1
    mock_base_model.table_name = "original_dataset"
    mock_base_model.schema = "public"
    mock_base_model.catalog = None
    mock_base_model.kind = "virtual"

    mock_database = Mock(spec=Database)
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = "default_catalog"

    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=mock_base_model,
    ):
        with patch(
            "superset.commands.dataset.duplicate.db.session.query"
        ) as mock_query:
            mock_query.return_value.get.return_value = mock_database
            with patch(
                "superset.commands.dataset.duplicate.DatasetDAO.validate_uniqueness",
                return_value=True,
            ) as mock_validate:
                with patch(
                    "superset.commands.dataset.duplicate.DuplicateDatasetCommand.populate_owners",
                    return_value=[],
                ):
                    command = DuplicateDatasetCommand(
                        {
                            "base_model_id": 1,
                            "table_name": "duplicated_dataset",
                            "owners": [],
                        }
                    )

                    command.validate()

                    # Verify catalog=None is resolved to default catalog for validation
                    mock_validate.assert_called_once()
                    call_args = mock_validate.call_args
                    table_arg = call_args[0][1]  # Second argument is the Table object
                    assert table_arg.catalog == "default_catalog"


def test_duplicate_dataset_with_columns_and_metrics():
    """Test duplication preserves columns and metrics."""
    mock_column = Mock(spec=TableColumn)
    mock_column.column_name = "col1"
    mock_column.verbose_name = "Column 1"
    mock_column.expression = None
    mock_column.is_dttm = False
    mock_column.type = "VARCHAR"
    mock_column.description = "Test column"

    mock_metric = Mock(spec=SqlMetric)
    mock_metric.metric_name = "count"
    mock_metric.verbose_name = "Count"
    mock_metric.expression = "COUNT(*)"
    mock_metric.metric_type = "count"
    mock_metric.description = "Row count"

    mock_base_model = Mock(spec=SqlaTable)
    mock_base_model.id = 1
    mock_base_model.database_id = 1
    mock_base_model.table_name = "original_dataset"
    mock_base_model.schema = "public"
    mock_base_model.catalog = None
    mock_base_model.kind = "virtual"
    mock_base_model.sql = "SELECT 1 as c"
    mock_base_model.template_params = None
    mock_base_model.normalize_columns = False
    mock_base_model.always_filter_main_dttm = False
    mock_base_model.columns = [mock_column]
    mock_base_model.metrics = [mock_metric]

    # Create a mock database without spec to allow SQLAlchemy relationship assignment
    mock_database = MagicMock()
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = None
    # Add _sa_instance_state to allow SQLAlchemy relationship assignment
    mock_database._sa_instance_state = MagicMock()

    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=mock_base_model,
    ):
        with patch(
            "superset.commands.dataset.duplicate.db.session.query"
        ) as mock_query:
            mock_query.return_value.get.return_value = mock_database
            with patch(
                "superset.commands.dataset.duplicate.DatasetDAO.validate_uniqueness",
                return_value=True,
            ):
                with patch(
                    "superset.commands.dataset.duplicate.DuplicateDatasetCommand.populate_owners",
                    return_value=[],
                ):
                    with patch("superset.commands.dataset.duplicate.db.session.add"):
                        command = DuplicateDatasetCommand(
                            {
                                "base_model_id": 1,
                                "table_name": "duplicated_dataset",
                                "owners": [],
                            }
                        )

                        result = command.run()

                        # Verify columns were duplicated
                        assert len(result.columns) == 1
                        assert result.columns[0].column_name == "col1"

                        # Verify metrics were duplicated
                        assert len(result.metrics) == 1
                        assert result.metrics[0].metric_name == "count"
