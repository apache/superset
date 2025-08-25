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

"""
Shadow writing mechanism for dataset model migration (SIP-68).

This module provides functionality to keep the old SqlaTable model
and new Dataset/Table/Column models in sync during the transition period.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from flask import current_app

from superset import is_feature_enabled
from sqlalchemy import and_
from sqlalchemy.orm import Session

from superset import db
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.models.core import Database
from superset.models.dataset import Column, Dataset, DatasetKind, Table

logger = logging.getLogger(__name__)


class ShadowWriter:
    """
    Handles synchronization between old and new dataset models.
    
    This class implements shadow writing, ensuring that changes to either
    the old SqlaTable model or the new Dataset/Table/Column models are
    reflected in both representations.
    """

    def __init__(self, session: Optional[Session] = None) -> None:
        self.session = session or db.session

    def is_shadow_writing_enabled(self) -> bool:
        """Check if shadow writing is enabled via feature flags."""
        return is_feature_enabled("DATASET_SHADOW_WRITING_ENABLED")

    def sync_sqla_table_to_new_models(self, sqla_table: SqlaTable) -> tuple[Table, Dataset]:
        """
        Synchronize a SqlaTable to the new Table and Dataset models.
        
        Args:
            sqla_table: The SqlaTable instance to sync
            
        Returns:
            Tuple of (Table, Dataset) instances
        """
        if not self.is_shadow_writing_enabled():
            return None, None

        try:
            # Use a separate session to avoid conflicts with ongoing transactions
            from sqlalchemy.orm import sessionmaker
            Session = sessionmaker(bind=self.session.bind)
            shadow_session = Session()
            
            # Create a new shadow writer instance with the separate session
            shadow_writer_instance = ShadowWriter(shadow_session)
            
            # Find or create the corresponding Table
            table = shadow_writer_instance._find_or_create_table(sqla_table)
            
            # Find or create the corresponding Dataset
            dataset = shadow_writer_instance._find_or_create_dataset(sqla_table, table)
            
            # Sync columns and metrics
            shadow_writer_instance._sync_columns_and_metrics(sqla_table, table, dataset)
            
            # Commit the shadow session
            shadow_session.commit()
            shadow_session.close()
            
            logger.debug(
                "Synced SqlaTable %s to Table %s and Dataset %s",
                sqla_table.id,
                table.id if table else None,
                dataset.id if dataset else None,
            )
            
            return table, dataset
            
        except Exception as e:
            logger.warning(
                "Error syncing SqlaTable %s to new models: %s",
                sqla_table.id,
                str(e)
            )
            if 'shadow_session' in locals():
                shadow_session.rollback()
                shadow_session.close()
            return None, None

    def sync_new_models_to_sqla_table(self, dataset: Dataset) -> Optional[SqlaTable]:
        """
        Synchronize a Dataset back to the SqlaTable model.
        
        Args:
            dataset: The Dataset instance to sync
            
        Returns:
            The corresponding SqlaTable instance
        """
        if not self.is_shadow_writing_enabled():
            return None

        # For now, we only support physical datasets in reverse sync
        if dataset.is_virtual:
            logger.warning("Reverse sync not supported for virtual datasets yet")
            return None

        # Get the primary table for this dataset
        if not dataset.tables:
            logger.warning("Dataset %s has no associated tables", dataset.id)
            return None

        primary_table = dataset.tables[0]  # For physical datasets, there should be only one
        
        # Find or create corresponding SqlaTable
        sqla_table = self._find_or_create_sqla_table(dataset, primary_table)
        
        # Sync properties
        sqla_table.table_name = primary_table.name
        sqla_table.schema = primary_table.schema
        sqla_table.catalog = primary_table.catalog
        sqla_table.database_id = primary_table.database_id
        sqla_table.description = dataset.description
        sqla_table.main_dttm_col = dataset.main_dttm_col
        sqla_table.default_endpoint = dataset.default_endpoint
        sqla_table.is_featured = dataset.is_featured
        sqla_table.filter_select_enabled = dataset.filter_select_enabled
        sqla_table.offset = dataset.offset
        sqla_table.cache_timeout = dataset.cache_timeout
        sqla_table.params = dataset.params
        sqla_table.extra = dataset.extra
        sqla_table.fetch_values_predicate = dataset.fetch_values_predicate
        
        # Sync columns and metrics back
        self._sync_new_columns_to_sqla_table(dataset, sqla_table)
        
        logger.debug(
            "Synced Dataset %s back to SqlaTable %s",
            dataset.id,
            sqla_table.id,
        )
        
        return sqla_table

    def _find_or_create_table(self, sqla_table: SqlaTable) -> Table:
        """Find or create a Table instance corresponding to a SqlaTable."""
        # Look for existing Table
        table = (
            self.session.query(Table)
            .filter(
                and_(
                    Table.database_id == sqla_table.database_id,
                    Table.catalog == sqla_table.catalog,
                    Table.schema == sqla_table.schema,
                    Table.name == sqla_table.table_name,
                )
            )
            .first()
        )
        
        if not table:
            table = Table(
                database_id=sqla_table.database_id,
                catalog=sqla_table.catalog,
                schema=sqla_table.schema,
                name=sqla_table.table_name,
            )
            self.session.add(table)
            self.session.flush()  # Get the ID
            
        return table

    def _find_or_create_dataset(self, sqla_table: SqlaTable, table: Table) -> Dataset:
        """Find or create a Dataset instance corresponding to a SqlaTable."""
        # For physical datasets, use the table name as dataset name
        # For virtual datasets, use the existing table_name (which contains the custom name)
        
        kind = DatasetKind.VIRTUAL if sqla_table.sql else DatasetKind.PHYSICAL
        name = sqla_table.table_name
        expression = sqla_table.sql or sqla_table.table_name
        
        # Look for existing Dataset
        # We'll use a combination of name and expression to find existing datasets
        dataset = (
            self.session.query(Dataset)
            .filter(
                and_(
                    Dataset.name == name,
                    Dataset.expression == expression,
                )
            )
            .first()
        )
        
        if not dataset:
            dataset = Dataset(
                name=name,
                kind=kind,
                expression=expression,
                description=sqla_table.description,
                main_dttm_col=sqla_table.main_dttm_col,
                default_endpoint=sqla_table.default_endpoint,
                is_featured=sqla_table.is_featured,
                filter_select_enabled=sqla_table.filter_select_enabled,
                offset=sqla_table.offset,
                cache_timeout=sqla_table.cache_timeout,
                params=sqla_table.params,
                extra=sqla_table.extra,
                fetch_values_predicate=sqla_table.fetch_values_predicate,
                sql=sqla_table.sql,  # For backward compatibility
            )
            self.session.add(dataset)
            self.session.flush()  # Get the ID
            
            # Associate with the table
            if kind == DatasetKind.PHYSICAL:
                dataset.tables.append(table)
        
        return dataset

    def _find_or_create_sqla_table(self, dataset: Dataset, table: Table) -> SqlaTable:
        """Find or create a SqlaTable instance corresponding to a Dataset."""
        # Look for existing SqlaTable
        sqla_table = (
            self.session.query(SqlaTable)
            .filter(
                and_(
                    SqlaTable.database_id == table.database_id,
                    SqlaTable.catalog == table.catalog,
                    SqlaTable.schema == table.schema,
                    SqlaTable.table_name == table.name,
                )
            )
            .first()
        )
        
        if not sqla_table:
            sqla_table = SqlaTable(
                table_name=table.name,
                schema=table.schema,
                catalog=table.catalog,
                database_id=table.database_id,
            )
            self.session.add(sqla_table)
            self.session.flush()  # Get the ID
            
        return sqla_table

    def _sync_columns_and_metrics(
        self, sqla_table: SqlaTable, table: Table, dataset: Dataset
    ) -> None:
        """Sync columns and metrics from SqlaTable to new models."""
        
        # Sync table columns to Column model (table-level)
        for table_column in sqla_table.columns:
            if table_column.is_active:  # Only sync active columns
                self._sync_table_column(table_column, table)
        
        # Sync columns to Column model (dataset-level) - these are dataset-specific column configs
        for table_column in sqla_table.columns:
            if table_column.is_active:
                self._sync_dataset_column(table_column, dataset)
        
        # Sync metrics to Column model (dataset-level)
        for metric in sqla_table.metrics:
            self._sync_metric(metric, dataset)

    def _sync_table_column(self, table_column: TableColumn, table: Table) -> Column:
        """Sync a TableColumn to a table-level Column."""
        # Look for existing column
        column = (
            self.session.query(Column)
            .filter(
                and_(
                    Column.table_id == table.id,
                    Column.name == table_column.column_name,
                )
            )
            .first()
        )
        
        if not column:
            column = Column(
                table_id=table.id,
                name=table_column.column_name,
                type=table_column.type,
                expression=table_column.expression or table_column.column_name,
                is_temporal=table_column.is_dttm,
                python_date_format=table_column.python_date_format,
                advanced_data_type=table_column.advanced_data_type,
                extra=table_column.extra,
            )
            self.session.add(column)
        else:
            # Update existing column
            column.type = table_column.type
            column.expression = table_column.expression or table_column.column_name
            column.is_temporal = table_column.is_dttm
            column.python_date_format = table_column.python_date_format
            column.advanced_data_type = table_column.advanced_data_type
            column.extra = table_column.extra
            
        return column

    def _sync_dataset_column(self, table_column: TableColumn, dataset: Dataset) -> Column:
        """Sync a TableColumn to a dataset-level Column."""
        # Look for existing dataset column
        column = (
            self.session.query(Column)
            .filter(
                and_(
                    Column.dataset_id == dataset.id,
                    Column.name == table_column.column_name,
                    Column.is_aggregation == False,  # Not a metric
                )
            )
            .first()
        )
        
        if not column:
            column = Column(
                dataset_id=dataset.id,
                name=table_column.column_name,
                type=table_column.type,
                expression=table_column.expression or table_column.column_name,
                verbose_name=table_column.verbose_name,
                description=table_column.description,
                is_active=table_column.is_active,
                is_temporal=table_column.is_dttm,
                groupby=table_column.groupby,
                filterable=table_column.filterable,
                python_date_format=table_column.python_date_format,
                advanced_data_type=table_column.advanced_data_type,
                extra=table_column.extra,
                is_aggregation=False,
            )
            self.session.add(column)
        else:
            # Update existing column
            column.type = table_column.type
            column.expression = table_column.expression or table_column.column_name
            column.verbose_name = table_column.verbose_name
            column.description = table_column.description
            column.is_active = table_column.is_active
            column.is_temporal = table_column.is_dttm
            column.groupby = table_column.groupby
            column.filterable = table_column.filterable
            column.python_date_format = table_column.python_date_format
            column.advanced_data_type = table_column.advanced_data_type
            column.extra = table_column.extra
            
        return column

    def _sync_metric(self, metric: SqlMetric, dataset: Dataset) -> Column:
        """Sync a SqlMetric to a Column with is_aggregation=True."""
        # Look for existing metric column
        column = (
            self.session.query(Column)
            .filter(
                and_(
                    Column.dataset_id == dataset.id,
                    Column.name == metric.metric_name,
                    Column.is_aggregation == True,
                )
            )
            .first()
        )
        
        if not column:
            column = Column(
                dataset_id=dataset.id,
                name=metric.metric_name,
                type="metric",
                expression=metric.expression,
                verbose_name=metric.verbose_name,
                description=metric.description,
                warning_text=metric.warning_text,
                d3format=metric.d3format,
                currency=metric.currency,
                extra=metric.extra,
                is_aggregation=True,
                is_active=True,
            )
            self.session.add(column)
        else:
            # Update existing metric column
            column.expression = metric.expression
            column.verbose_name = metric.verbose_name
            column.description = metric.description
            column.warning_text = metric.warning_text
            column.d3format = metric.d3format
            column.currency = metric.currency
            column.extra = metric.extra
            
        return column

    def _sync_new_columns_to_sqla_table(self, dataset: Dataset, sqla_table: SqlaTable) -> None:
        """Sync columns from new models back to SqlaTable."""
        # This is a simplified reverse sync - in practice, you'd want more sophisticated logic
        # to handle the bidirectional mapping properly
        
        # For now, we'll just ensure that the basic structure is in place
        # Full implementation would require more complex mapping logic
        pass


# Global instance for easy access
shadow_writer = ShadowWriter()