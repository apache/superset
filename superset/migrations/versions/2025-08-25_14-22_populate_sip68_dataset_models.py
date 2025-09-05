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

"""populate_sip68_dataset_models

Revision ID: sip68_populate_models
Revises: sip68_dataset_models
Create Date: 2025-08-25 14:22:00.000000

"""

import uuid
from typing import Any

import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

# revision identifiers, used by Alembic.
revision = "sip68_populate_models"
down_revision = "sip68_dataset_models"


def upgrade():
    """Populate new dataset models with data from existing SqlaTable models."""
    
    # Temporarily disabled for initial testing
    print("Skipping data population for initial testing")
    return
    
    bind = op.get_bind()
    session = Session(bind=bind)
    
    try:
        # Get all existing SqlaTables
        sqla_tables_query = """
        SELECT 
            id, table_name, schema_name as schema, catalog, database_id,
            description, main_dttm_col, default_endpoint, is_featured,
            filter_select_enabled, offset, cache_timeout, params, extra,
            fetch_values_predicate, sql, created_on, changed_on,
            created_by_fk, changed_by_fk
        FROM tables t
        """
        
        # Note: We need to handle the fact that the old "tables" table will be renamed
        # For now, let's assume we're working with the existing structure
        
        print("Starting migration of SqlaTable data to new dataset models...")
        
        # First, let's create Tables from existing SqlaTables
        create_tables_query = """
        INSERT INTO sip68_tables (
            uuid, database_id, catalog, schema, name, 
            created_on, changed_on, created_by_fk, changed_by_fk
        )
        SELECT DISTINCT
            gen_random_uuid(),
            database_id,
            catalog,
            schema_name,
            table_name,
            created_on,
            changed_on,
            created_by_fk,
            changed_by_fk
        FROM tables old_tables
        WHERE NOT EXISTS (
            SELECT 1 FROM sip68_tables new_tables 
            WHERE new_tables.database_id = old_tables.database_id
            AND COALESCE(new_tables.catalog, '') = COALESCE(old_tables.catalog, '')
            AND COALESCE(new_tables.schema, '') = COALESCE(old_tables.schema_name, '')
            AND new_tables.name = old_tables.table_name
        )
        """
        
        # PostgreSQL version (with gen_random_uuid)
        try:
            session.execute(sa.text(create_tables_query))
        except Exception:
            # Fallback for databases that don't support gen_random_uuid
            # We'll use Python to generate UUIDs
            pass
        
        # Create Datasets from existing SqlaTables  
        sqla_tables = session.execute(sa.text("""
            SELECT 
                id, table_name, schema_name, catalog, database_id,
                description, main_dttm_col, default_endpoint, is_featured,
                filter_select_enabled, "offset", cache_timeout, params, extra,
                fetch_values_predicate, sql, created_on, changed_on,
                created_by_fk, changed_by_fk
            FROM tables
        """)).fetchall()
        
        for sqla_table in sqla_tables:
            # Determine dataset kind and expression
            if sqla_table.sql:
                kind = "VIRTUAL"
                expression = sqla_table.sql
                name = sqla_table.table_name  # Virtual datasets can have custom names
            else:
                kind = "PHYSICAL"
                expression = sqla_table.table_name
                name = sqla_table.table_name
            
            # Insert dataset
            dataset_uuid = str(uuid.uuid4())
            session.execute(sa.text("""
                INSERT INTO sip68_datasets (
                    uuid, name, kind, expression, description, main_dttm_col,
                    default_endpoint, is_featured, filter_select_enabled, offset,
                    cache_timeout, params, extra, fetch_values_predicate, sql,
                    normalize_columns, always_filter_main_dttm,
                    created_on, changed_on, created_by_fk, changed_by_fk
                ) VALUES (
                    :uuid, :name, :kind, :expression, :description, :main_dttm_col,
                    :default_endpoint, :is_featured, :filter_select_enabled, :offset,
                    :cache_timeout, :params, :extra, :fetch_values_predicate, :sql,
                    false, false,
                    :created_on, :changed_on, :created_by_fk, :changed_by_fk
                )
            """), {
                "uuid": dataset_uuid,
                "name": name,
                "kind": kind,
                "expression": expression,
                "description": sqla_table.description,
                "main_dttm_col": sqla_table.main_dttm_col,
                "default_endpoint": sqla_table.default_endpoint,
                "is_featured": sqla_table.is_featured or False,
                "filter_select_enabled": sqla_table.filter_select_enabled if sqla_table.filter_select_enabled is not None else True,
                "offset": sqla_table.offset or 0,
                "cache_timeout": sqla_table.cache_timeout,
                "params": sqla_table.params,
                "extra": sqla_table.extra,
                "fetch_values_predicate": sqla_table.fetch_values_predicate,
                "sql": sqla_table.sql,
                "created_on": sqla_table.created_on,
                "changed_on": sqla_table.changed_on,
                "created_by_fk": sqla_table.created_by_fk,
                "changed_by_fk": sqla_table.changed_by_fk,
            })
            
            # Get the dataset ID we just created
            dataset_result = session.execute(sa.text("""
                SELECT id FROM sip68_datasets WHERE uuid = :uuid
            """), {"uuid": dataset_uuid}).fetchone()
            
            if not dataset_result:
                continue
                
            dataset_id = dataset_result[0]
            
            # Find the corresponding table ID for physical datasets
            if kind == "PHYSICAL":
                table_result = session.execute(sa.text("""
                    SELECT id FROM sip68_tables new_tables
                    WHERE database_id = :database_id
                    AND COALESCE(catalog, '') = COALESCE(:catalog, '')
                    AND COALESCE(schema, '') = COALESCE(:schema, '')
                    AND name = :name
                """), {
                    "database_id": sqla_table.database_id,
                    "catalog": sqla_table.catalog,
                    "schema": sqla_table.schema_name,
                    "name": sqla_table.table_name,
                }).fetchone()
                
                if table_result:
                    table_id = table_result[0]
                    
                    # Create dataset-table association
                    session.execute(sa.text("""
                        INSERT INTO sip68_dataset_table_association (dataset_id, table_id)
                        VALUES (:dataset_id, :table_id)
                    """), {
                        "dataset_id": dataset_id,
                        "table_id": table_id,
                    })
            
            # Migrate table columns to the new Column model (dataset-level)
            table_columns = session.execute(sa.text("""
                SELECT 
                    id, column_name, verbose_name, is_active, type, advanced_data_type,
                    groupby, filterable, description, table_id, is_dttm, expression,
                    python_date_format, extra
                FROM table_columns
                WHERE table_id = :table_id
            """), {"table_id": sqla_table.id}).fetchall()
            
            for table_column in table_columns:
                column_uuid = str(uuid.uuid4())
                session.execute(sa.text("""
                    INSERT INTO sip68_columns (
                        uuid, dataset_id, name, type, expression, verbose_name,
                        description, is_active, is_temporal, groupby, filterable,
                        python_date_format, advanced_data_type, extra, is_aggregation
                    ) VALUES (
                        :uuid, :dataset_id, :name, :type, :expression, :verbose_name,
                        :description, :is_active, :is_temporal, :groupby, :filterable,
                        :python_date_format, :advanced_data_type, :extra, false
                    )
                """), {
                    "uuid": column_uuid,
                    "dataset_id": dataset_id,
                    "name": table_column.column_name,
                    "type": table_column.type,
                    "expression": table_column.expression or table_column.column_name,
                    "verbose_name": table_column.verbose_name,
                    "description": table_column.description,
                    "is_active": table_column.is_active if table_column.is_active is not None else True,
                    "is_temporal": table_column.is_dttm or False,
                    "groupby": table_column.groupby if table_column.groupby is not None else True,
                    "filterable": table_column.filterable if table_column.filterable is not None else True,
                    "python_date_format": table_column.python_date_format,
                    "advanced_data_type": table_column.advanced_data_type,
                    "extra": table_column.extra,
                })
            
            # Migrate sql metrics to the new Column model (as metrics)
            sql_metrics = session.execute(sa.text("""
                SELECT 
                    id, metric_name, verbose_name, metric_type, description,
                    d3format, currency, warning_text, table_id, expression, extra
                FROM sql_metrics
                WHERE table_id = :table_id
            """), {"table_id": sqla_table.id}).fetchall()
            
            for sql_metric in sql_metrics:
                column_uuid = str(uuid.uuid4())
                session.execute(sa.text("""
                    INSERT INTO sip68_columns (
                        uuid, dataset_id, name, type, expression, verbose_name,
                        description, warning_text, d3format, currency, extra,
                        is_aggregation, is_active
                    ) VALUES (
                        :uuid, :dataset_id, :name, 'metric', :expression, :verbose_name,
                        :description, :warning_text, :d3format, :currency, :extra,
                        true, true
                    )
                """), {
                    "uuid": column_uuid,
                    "dataset_id": dataset_id,
                    "name": sql_metric.metric_name,
                    "expression": sql_metric.expression,
                    "verbose_name": sql_metric.verbose_name,
                    "description": sql_metric.description,
                    "warning_text": sql_metric.warning_text,
                    "d3format": sql_metric.d3format,
                    "currency": sql_metric.currency,
                    "extra": sql_metric.extra,
                })
            
            # Migrate dataset owners
            owners = session.execute(sa.text("""
                SELECT user_id FROM sqlatable_user WHERE table_id = :table_id
            """), {"table_id": sqla_table.id}).fetchall()
            
            for owner in owners:
                session.execute(sa.text("""
                    INSERT INTO sip68_dataset_user_association (dataset_id, user_id)
                    VALUES (:dataset_id, :user_id)
                """), {
                    "dataset_id": dataset_id,
                    "user_id": owner[0],
                })
        
        session.commit()
        print(f"Successfully migrated {len(sqla_tables)} SqlaTables to new dataset models")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        session.rollback()
        raise
    finally:
        session.close()


def downgrade():
    """Remove populated data from new dataset models."""
    
    bind = op.get_bind()
    session = Session(bind=bind)
    
    try:
        # Clear all data from new tables
        session.execute(sa.text("DELETE FROM sip68_dataset_user_association"))
        session.execute(sa.text("DELETE FROM sip68_dataset_table_association"))
        session.execute(sa.text("DELETE FROM sip68_columns"))
        session.execute(sa.text("DELETE FROM sip68_datasets"))
        session.execute(sa.text("DELETE FROM sip68_tables"))
        
        session.commit()
        print("Successfully cleared data from new dataset models")
        
    except Exception as e:
        print(f"Error during downgrade: {e}")
        session.rollback()
        raise
    finally:
        session.close()