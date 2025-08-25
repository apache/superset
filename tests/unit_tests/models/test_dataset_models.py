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

"""Tests for new dataset models and shadow writing (SIP-68)."""

import pytest
from unittest.mock import patch

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.datasets.shadow_writer import ShadowWriter
from superset.models.core import Database
from superset.models.dataset import Column, Dataset, DatasetKind, Table
from tests.integration_tests.base_tests import SupersetTestCase


class TestDatasetModels(SupersetTestCase):
    """Test the new dataset models and shadow writing functionality."""

    def setUp(self) -> None:
        super().setUp()
        self.shadow_writer = ShadowWriter()

    def test_table_model_creation(self) -> None:
        """Test creating a Table model."""
        # Get a database for testing
        database = db.session.query(Database).first()
        
        table = Table(
            database_id=database.id,
            catalog=None,
            schema="public",
            name="test_table",
        )
        db.session.add(table)
        db.session.commit()
        
        # Verify table was created
        assert table.id is not None
        assert table.uuid is not None
        assert table.full_name == "public.test_table"
        
        # Clean up
        db.session.delete(table)
        db.session.commit()

    def test_dataset_model_creation(self) -> None:
        """Test creating a Dataset model."""
        dataset = Dataset(
            name="test_dataset",
            kind=DatasetKind.PHYSICAL,
            expression="test_table",
            description="Test dataset",
        )
        db.session.add(dataset)
        db.session.commit()
        
        # Verify dataset was created
        assert dataset.id is not None
        assert dataset.uuid is not None
        assert dataset.is_physical
        assert not dataset.is_virtual
        
        # Clean up
        db.session.delete(dataset)
        db.session.commit()

    def test_column_model_creation(self) -> None:
        """Test creating a Column model."""
        # Create a dataset first
        dataset = Dataset(
            name="test_dataset",
            kind=DatasetKind.PHYSICAL,
            expression="test_table",
        )
        db.session.add(dataset)
        db.session.flush()
        
        # Create a column
        column = Column(
            dataset_id=dataset.id,
            name="test_column",
            type="INTEGER",
            expression="test_column",
            is_aggregation=False,
        )
        db.session.add(column)
        db.session.commit()
        
        # Verify column was created
        assert column.id is not None
        assert column.uuid is not None
        assert not column.is_metric
        assert not column.is_derived
        
        # Clean up
        db.session.delete(column)
        db.session.delete(dataset)
        db.session.commit()

    def test_metric_column_creation(self) -> None:
        """Test creating a metric Column model."""
        # Create a dataset first
        dataset = Dataset(
            name="test_dataset",
            kind=DatasetKind.PHYSICAL,
            expression="test_table",
        )
        db.session.add(dataset)
        db.session.flush()
        
        # Create a metric column
        metric = Column(
            dataset_id=dataset.id,
            name="count_all",
            type="metric",
            expression="COUNT(*)",
            is_aggregation=True,
        )
        db.session.add(metric)
        db.session.commit()
        
        # Verify metric was created
        assert metric.id is not None
        assert metric.is_metric
        assert metric.is_aggregation
        
        # Clean up
        db.session.delete(metric)
        db.session.delete(dataset)
        db.session.commit()

    def test_shadow_writer_disabled_by_default(self) -> None:
        """Test that shadow writing is disabled by default."""
        assert not self.shadow_writer.is_shadow_writing_enabled()

    @patch("superset.is_feature_enabled")
    def test_shadow_writer_sync_disabled(self, mock_feature_enabled) -> None:
        """Test shadow writing when disabled."""
        mock_feature_enabled.return_value = False
        
        # Create a mock SqlaTable
        database = db.session.query(Database).first()
        sqla_table = SqlaTable(
            table_name="test_table",
            database_id=database.id,
        )
        
        # Should return None when disabled
        table, dataset = self.shadow_writer.sync_sqla_table_to_new_models(sqla_table)
        assert table is None
        assert dataset is None

    @patch("superset.is_feature_enabled")
    def test_shadow_writer_find_or_create_table(self, mock_feature_enabled) -> None:
        """Test shadow writer table creation."""
        mock_feature_enabled.return_value = True
        
        # Get a database for testing
        database = db.session.query(Database).first()
        
        # Create a SqlaTable
        sqla_table = SqlaTable(
            table_name="shadow_test_table",
            database_id=database.id,
            schema="public",
        )
        db.session.add(sqla_table)
        db.session.commit()
        
        try:
            # Test table creation via shadow writer
            table = self.shadow_writer._find_or_create_table(sqla_table)
            
            assert table is not None
            assert table.name == "shadow_test_table"
            assert table.schema == "public"
            assert table.database_id == database.id
            
        finally:
            # Clean up
            # First delete any new model objects
            tables_to_delete = db.session.query(Table).filter(
                Table.name == "shadow_test_table"
            ).all()
            for table in tables_to_delete:
                db.session.delete(table)
            
            # Then delete the original SqlaTable
            db.session.delete(sqla_table)
            db.session.commit()

    def test_dataset_table_association(self) -> None:
        """Test the many-to-many relationship between datasets and tables."""
        database = db.session.query(Database).first()
        
        # Create a table
        table = Table(
            database_id=database.id,
            name="assoc_test_table",
        )
        db.session.add(table)
        db.session.flush()
        
        # Create a dataset
        dataset = Dataset(
            name="assoc_test_dataset",
            kind=DatasetKind.PHYSICAL,
            expression="assoc_test_table",
        )
        db.session.add(dataset)
        db.session.flush()
        
        # Associate them
        dataset.tables.append(table)
        db.session.commit()
        
        # Verify association
        assert len(dataset.tables) == 1
        assert dataset.tables[0].name == "assoc_test_table"
        assert len(table.datasets) == 1
        assert table.datasets[0].name == "assoc_test_dataset"
        
        # Clean up
        dataset.tables.clear()
        db.session.delete(dataset)
        db.session.delete(table)
        db.session.commit()

    def test_virtual_dataset_creation(self) -> None:
        """Test creating a virtual dataset."""
        dataset = Dataset(
            name="virtual_test_dataset",
            kind=DatasetKind.VIRTUAL,
            expression="SELECT * FROM some_table",
            description="A virtual dataset",
        )
        db.session.add(dataset)
        db.session.commit()
        
        # Verify virtual dataset properties
        assert dataset.is_virtual
        assert not dataset.is_physical
        assert "SELECT" in dataset.expression
        
        # Clean up
        db.session.delete(dataset)
        db.session.commit()