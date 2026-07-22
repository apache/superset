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
"""Unit tests for DuplicateDatasetCommand.

Covers both the per-object access check and the virtual dataset
duplication/validation behavior (including catalog handling).
"""

from unittest.mock import MagicMock, Mock, patch

import pytest
from sqlalchemy.orm.session import Session

from superset.commands.dataset.duplicate import DuplicateDatasetCommand
from superset.commands.dataset.exceptions import (
    DatasetAccessDeniedError,
    DatasetExistsValidationError,
    DatasetInvalidError,
    DatasetNotFoundError,
)
from superset.commands.exceptions import DatasourceTypeInvalidError
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException


def _security_exception() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            message="Access denied to dataset",
            level=ErrorLevel.ERROR,
        )
    )


def test_duplicate_dataset_forbidden_when_no_access() -> None:
    """DuplicateDatasetCommand.validate() must raise DatasetAccessDeniedError
    when the caller lacks read access to the source dataset."""
    mock_dataset = MagicMock()
    mock_dataset.id = 1
    mock_dataset.kind = "virtual"

    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=mock_dataset,
    ):
        with patch(
            "superset.commands.dataset.duplicate.security_manager.raise_for_access",
            side_effect=_security_exception(),
        ):
            command = DuplicateDatasetCommand(
                {
                    "base_model_id": 1,
                    "table_name": "duplicate_name",
                    "is_managed_externally": False,
                }
            )
            with pytest.raises(DatasetAccessDeniedError):
                command.validate()


def test_duplicate_dataset_access_check_passes_through() -> None:
    """DuplicateDatasetCommand.validate() must not raise DatasetAccessDeniedError
    when security_manager.raise_for_access() does not raise."""
    mock_dataset = MagicMock()
    mock_dataset.id = 1
    mock_dataset.kind = "virtual"

    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=mock_dataset,
    ):
        with patch(
            "superset.commands.dataset.duplicate.security_manager.raise_for_access"
        ) as mock_access:
            with patch(
                "superset.commands.dataset.duplicate.DatasetDAO.validate_uniqueness",
                return_value=True,
            ):
                with patch(
                    "superset.commands.utils.populate_subject_list",
                    return_value=[],
                ):
                    command = DuplicateDatasetCommand(
                        {
                            "base_model_id": 1,
                            "table_name": "new_unique_name",
                            "is_managed_externally": False,
                        }
                    )
                    command.validate()  # should not raise
                    # Confirm access check was called with the base dataset
                    mock_access.assert_called_once_with(datasource=mock_dataset)


def test_duplicate_dataset_blocked_by_soft_deleted_twin(session: Session) -> None:
    """validate() rejects a duplicate whose name matches a soft-deleted
    dataset at the same (database, schema).

    The previous name-only ``find_one_or_none`` lookup ran through the
    soft-delete visibility filter, so a soft-deleted twin was invisible and
    the duplicate proceeded — hitting whichever DB constraint applies as an
    opaque IntegrityError, or creating an active twin that permanently
    blocks restore where none does. The shared ``validate_uniqueness``
    check bypasses the filter and refuses with a clean validation error.
    """
    from datetime import datetime, timezone

    from superset import db
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="dup_db", sqlalchemy_uri="sqlite://")
    base = SqlaTable(
        table_name="base_view",
        schema="main",
        database=database,
        sql="select 1",
    )
    hidden_twin = SqlaTable(
        table_name="dup_name",
        schema="main",
        database=database,
        deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    db.session.add_all([database, base, hidden_twin])
    db.session.flush()

    with (
        # find_by_id applies the security base filter, which needs a request
        # user; return the seeded row directly. validate_uniqueness — the
        # behaviour under test — runs for real against the session.
        patch(
            "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
            return_value=base,
        ),
        patch("superset.commands.dataset.duplicate.security_manager.raise_for_access"),
        patch(
            "superset.commands.utils.populate_subject_list",
            return_value=[],
        ),
    ):
        command = DuplicateDatasetCommand(
            {
                "base_model_id": base.id,
                "table_name": "dup_name",
                "is_managed_externally": False,
            }
        )
        with pytest.raises(DatasetInvalidError):
            command.validate()


def test_duplicate_dataset_success() -> None:
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

    with (
        patch(
            "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
            return_value=mock_base_model,
        ),
        patch("superset.commands.dataset.duplicate.security_manager.raise_for_access"),
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
                    "superset.commands.utils.populate_subject_list",
                    return_value=[],
                ):
                    with patch("superset.commands.dataset.duplicate.db.session.add"):
                        command = DuplicateDatasetCommand(
                            {
                                "base_model_id": 1,
                                "table_name": "duplicated_dataset",
                                "editors": [],
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


def test_duplicate_dataset_not_found() -> None:
    """Test duplication when base dataset doesn't exist."""
    with patch(
        "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
        return_value=None,
    ):
        with patch(
            "superset.commands.utils.populate_subject_list",
            return_value=[],
        ):
            command = DuplicateDatasetCommand(
                {
                    "base_model_id": 999,
                    "table_name": "duplicated_dataset",
                    "editors": [],
                }
            )

            with pytest.raises(DatasetInvalidError) as exc_info:
                command.validate()

            # Verify the exception contains DatasetNotFoundError
            validation_errors = exc_info.value._exceptions
            assert any(
                isinstance(error, DatasetNotFoundError) for error in validation_errors
            )


def test_duplicate_dataset_not_virtual() -> None:
    """Test that duplication fails for physical (non-virtual) datasets."""
    mock_base_model = Mock(spec=SqlaTable)
    mock_base_model.id = 1
    mock_base_model.database_id = 1
    mock_base_model.kind = "physical"  # Not virtual

    with (
        patch(
            "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
            return_value=mock_base_model,
        ),
        patch("superset.commands.dataset.duplicate.security_manager.raise_for_access"),
    ):
        with patch(
            "superset.commands.dataset.duplicate.DatasetDAO.validate_uniqueness",
            return_value=True,
        ):
            with patch(
                "superset.commands.utils.populate_subject_list",
                return_value=[],
            ):
                command = DuplicateDatasetCommand(
                    {
                        "base_model_id": 1,
                        "table_name": "duplicated_dataset",
                        "editors": [],
                    }
                )

                with pytest.raises(DatasetInvalidError) as exc_info:
                    command.validate()

                # Verify the exception contains DatasourceTypeInvalidError
                validation_errors = exc_info.value._exceptions
                assert len(validation_errors) == 1
                assert isinstance(validation_errors[0], DatasourceTypeInvalidError)


def test_duplicate_dataset_name_exists_same_database_schema() -> None:
    """Test that duplication fails when name exists in same database/schema."""
    mock_base_model = Mock(spec=SqlaTable)
    mock_base_model.id = 1
    mock_base_model.database_id = 1
    mock_base_model.table_name = "original_dataset"
    mock_base_model.schema = "public"
    mock_base_model.catalog = None
    mock_base_model.kind = "virtual"

    with (
        patch(
            "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
            return_value=mock_base_model,
        ),
        patch("superset.commands.dataset.duplicate.security_manager.raise_for_access"),
    ):
        with patch(
            "superset.commands.dataset.duplicate.DatasetDAO.validate_uniqueness",
            return_value=False,  # Name already exists
        ):
            with patch(
                "superset.commands.utils.populate_subject_list",
                return_value=[],
            ):
                command = DuplicateDatasetCommand(
                    {
                        "base_model_id": 1,
                        "table_name": "existing_dataset",
                        "editors": [],
                    }
                )

                with pytest.raises(DatasetInvalidError) as exc_info:
                    command.validate()

                # Verify the exception contains DatasetExistsValidationError
                validation_errors = exc_info.value._exceptions
                assert len(validation_errors) == 1
                assert isinstance(validation_errors[0], DatasetExistsValidationError)


def test_duplicate_dataset_catalog_preserved() -> None:
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

    with (
        patch(
            "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
            return_value=mock_base_model,
        ),
        patch("superset.commands.dataset.duplicate.security_manager.raise_for_access"),
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
                    "superset.commands.utils.populate_subject_list",
                    return_value=[],
                ):
                    with patch("superset.commands.dataset.duplicate.db.session.add"):
                        command = DuplicateDatasetCommand(
                            {
                                "base_model_id": 1,
                                "table_name": "duplicated_dataset",
                                "editors": [],
                            }
                        )

                        result = command.run()

                        # Verify catalog was preserved
                        assert result.catalog == "prod_catalog"


def test_duplicate_dataset_catalog_passed_to_uniqueness_check() -> None:
    """The uniqueness check receives the base model's database and a Table
    scoped to its schema/catalog.

    Default-catalog resolution for a NULL catalog happens inside
    ``DatasetDAO.validate_uniqueness``; the command passes the raw catalog
    through.
    """
    mock_base_model = Mock(spec=SqlaTable)
    mock_base_model.id = 1
    mock_base_model.database_id = 1
    mock_base_model.table_name = "original_dataset"
    mock_base_model.schema = "public"
    mock_base_model.catalog = "prod_catalog"
    mock_base_model.kind = "virtual"

    with (
        patch(
            "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
            return_value=mock_base_model,
        ),
        patch("superset.commands.dataset.duplicate.security_manager.raise_for_access"),
    ):
        with patch(
            "superset.commands.dataset.duplicate.DatasetDAO.validate_uniqueness",
            return_value=True,
        ) as mock_validate:
            with patch(
                "superset.commands.utils.populate_subject_list",
                return_value=[],
            ):
                command = DuplicateDatasetCommand(
                    {
                        "base_model_id": 1,
                        "table_name": "duplicated_dataset",
                        "editors": [],
                    }
                )

                command.validate()

                # Verify the check is scoped to the base model's
                # database/schema/catalog
                mock_validate.assert_called_once()
                database_arg, table_arg = mock_validate.call_args[0]
                assert database_arg is mock_base_model.database
                assert table_arg.table == "duplicated_dataset"
                assert table_arg.schema == "public"
                assert table_arg.catalog == "prod_catalog"


def test_duplicate_dataset_with_columns_and_metrics() -> None:
    """Test duplication preserves columns and metrics."""
    mock_column = Mock(spec=TableColumn)
    mock_column.column_name = "col1"
    mock_column.verbose_name = "Column 1"
    mock_column.expression = None
    mock_column.is_dttm = False
    mock_column.type = "VARCHAR"
    mock_column.description = "Test column"
    mock_column.filterable = False
    mock_column.groupby = False

    mock_metric = Mock(spec=SqlMetric)
    mock_metric.metric_name = "count"
    mock_metric.verbose_name = "Count"
    mock_metric.expression = "COUNT(*)"
    mock_metric.metric_type = "count"
    mock_metric.description = "Row count"
    mock_metric.d3format = ",.2f"
    mock_metric.currency = None
    mock_metric.warning_text = "approximate"
    mock_metric.extra = None

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

    with (
        patch(
            "superset.commands.dataset.duplicate.DatasetDAO.find_by_id",
            return_value=mock_base_model,
        ),
        patch("superset.commands.dataset.duplicate.security_manager.raise_for_access"),
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
                    "superset.commands.utils.populate_subject_list",
                    return_value=[],
                ):
                    with patch("superset.commands.dataset.duplicate.db.session.add"):
                        command = DuplicateDatasetCommand(
                            {
                                "base_model_id": 1,
                                "table_name": "duplicated_dataset",
                                "editors": [],
                            }
                        )

                        result = command.run()

                        # Verify columns were duplicated
                        assert len(result.columns) == 1
                        assert result.columns[0].column_name == "col1"
                        # Non-default groupby/filterable flags must survive the
                        # clone rather than being reset to the column defaults.
                        assert result.columns[0].filterable is False
                        assert result.columns[0].groupby is False

                        # Verify metrics were duplicated
                        assert len(result.metrics) == 1
                        assert result.metrics[0].metric_name == "count"
                        # Formatting/metadata fields must survive the clone too.
                        assert result.metrics[0].d3format == ",.2f"
                        assert result.metrics[0].warning_text == "approximate"
