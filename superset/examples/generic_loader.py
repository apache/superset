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
"""Generic Parquet example data loader."""

import logging
import uuid as uuid_module
from functools import partial
from typing import Any, Callable, Optional

import numpy as np
from sqlalchemy import inspect

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.examples.helpers import read_example_data
from superset.models.core import Database
from superset.sql.parse import Table
from superset.utils import json
from superset.utils.database import get_example_database

logger = logging.getLogger(__name__)


def _find_dataset(
    table_name: str,
    database_id: int,
    uuid: Optional[str] = None,
    schema: Optional[str] = None,
) -> tuple[Optional[SqlaTable], bool]:
    """Find a dataset by UUID first, then fall back to table_name + database_id.

    Includes schema in the fallback lookup to prevent cross-schema collisions.

    This avoids unique constraint violations when a duplicate row exists.

    Args:
        table_name: The table name to look up
        database_id: The database ID
        uuid: Optional UUID to look up first
        schema: Optional schema to include in fallback lookup

    Returns:
        A tuple of (dataset or None, found_by_uuid bool)
    """
    tbl = None
    found_by_uuid = False

    if uuid:
        tbl = db.session.query(SqlaTable).filter_by(uuid=uuid).first()
        if tbl:
            found_by_uuid = True

    if not tbl:
        # First try exact schema match for cross-schema safety
        tbl = (
            db.session.query(SqlaTable)
            .filter_by(table_name=table_name, database_id=database_id, schema=schema)
            .first()
        )
        # If no exact match and schema was specified, fall back to rows with schema=None
        # so we can backfill schema/UUID on legacy datasets
        if not tbl and schema is not None:
            tbl = (
                db.session.query(SqlaTable)
                .filter_by(table_name=table_name, database_id=database_id, schema=None)
                .first()
            )

    return tbl, found_by_uuid


def serialize_numpy_arrays(obj: Any) -> Any:  # noqa: C901
    """Convert numpy arrays to JSON-serializable format."""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.generic):
        # Handle numpy scalar types
        return obj.item()
    elif isinstance(obj, (list, tuple)):
        return [serialize_numpy_arrays(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: serialize_numpy_arrays(val) for key, val in obj.items()}
    return obj


def load_parquet_table(  # noqa: C901
    parquet_file: str,
    table_name: str,
    database: Optional[Database] = None,
    only_metadata: bool = False,
    force: bool = False,
    sample_rows: Optional[int] = None,
    data_file: Optional[Any] = None,
    schema: Optional[str] = None,
    uuid: Optional[str] = None,
) -> SqlaTable:
    """Load a Parquet file into the example database.

    Args:
        parquet_file: Name of the Parquet file (e.g., "birth_names")
        table_name: Name for the table in the target database
        database: Target database (defaults to example database)
        only_metadata: If True, only create metadata without loading data
        force: If True, replace existing table
        sample_rows: If specified, only load this many rows
        data_file: Optional specific file path (Path object) to load from
        schema: Schema to load into (defaults to database default schema)
        uuid: UUID for the dataset (from YAML config) for import flow matching

    Returns:
        The created SqlaTable object
    """
    from sqlalchemy import text

    if database is None:
        database = get_example_database()

    # Determine schema - use provided or fall back to database default
    with database.get_sqla_engine() as engine:
        if schema is None:
            schema = inspect(engine).default_schema_name
        else:
            # Create schema if it doesn't exist (PostgreSQL)
            with engine.begin() as conn:
                conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))

    table_exists = database.has_table(Table(table_name, schema=schema))
    if table_exists and not force:
        logger.info("Table %s already exists, skipping data load", table_name)
        tbl, found_by_uuid = _find_dataset(table_name, database.id, uuid, schema)
        if tbl:
            needs_update = False
            # Backfill UUID if found by table_name (not UUID) and UUID not set
            if uuid and not tbl.uuid and not found_by_uuid:
                tbl.uuid = uuid_module.UUID(uuid)
                needs_update = True
            # Backfill schema if existing table has no schema set
            if schema and not tbl.schema:
                tbl.schema = schema
                needs_update = True
            if needs_update:
                db.session.merge(tbl)
                db.session.commit()  # pylint: disable=consider-using-transaction
            return tbl

    # Load data if not metadata only
    if not only_metadata:
        logger.info("Loading data for %s from %s.parquet", table_name, parquet_file)

        # Read from Parquet - use specific file path if provided
        if data_file is not None:
            pdf = read_example_data(f"file://{data_file}")
        else:
            pdf = read_example_data(f"examples://{parquet_file}")

        # Sample if requested (handle sample_rows=0 correctly)
        if sample_rows is not None:
            pdf = pdf.head(sample_rows)

        # Check for columns with complex types (numpy arrays, nested structures)
        for col in pdf.columns:
            # Check if any value in the column is a numpy array or nested structure
            if pdf[col].dtype == object:
                try:
                    # Check if the first non-null value is complex
                    sample_val = (
                        pdf[col].dropna().iloc[0]
                        if not pdf[col].dropna().empty
                        else None
                    )
                    if sample_val is not None and isinstance(
                        sample_val, (np.ndarray, list, dict)
                    ):
                        logger.info("Converting complex column %s to JSON string", col)

                        # Convert to JSON string for database storage
                        def safe_serialize(x: Any, column_name: str) -> Optional[str]:
                            if x is None:
                                return None
                            try:
                                return json.dumps(serialize_numpy_arrays(x))
                            except (TypeError, ValueError) as e:
                                logger.warning(
                                    "Failed to serialize value in column %s: %s",
                                    column_name,
                                    e,
                                )
                                # Convert to string representation as fallback
                                return str(x)

                        # Avoid loop variable binding issues with partial
                        serialize_col = partial(safe_serialize, column_name=col)
                        pdf[col] = pdf[col].apply(serialize_col)
                except Exception as e:
                    logger.warning("Could not process column %s: %s", col, e)

        # Write to target database
        with database.get_sqla_engine() as engine:
            pdf.to_sql(
                table_name,
                engine,
                schema=schema,
                if_exists="replace",
                chunksize=500,
                method="multi",
                index=False,
            )

        logger.info("Loaded %d rows into %s", len(pdf), table_name)

    # Create or update SqlaTable metadata using UUID-first lookup
    tbl, found_by_uuid = _find_dataset(table_name, database.id, uuid, schema)

    if not tbl:
        tbl = SqlaTable(table_name=table_name, database_id=database.id)
        tbl.database = database
        tbl.schema = schema
        if uuid:
            tbl.uuid = uuid_module.UUID(uuid)
    else:
        # Backfill UUID if found by table_name (not UUID) and UUID not set
        if uuid and not tbl.uuid and not found_by_uuid:
            tbl.uuid = uuid_module.UUID(uuid)
        # Backfill schema if existing table has no schema set
        if schema and not tbl.schema:
            tbl.schema = schema

    if not only_metadata:
        # Ensure database reference is set before fetching metadata
        if not tbl.database:
            tbl.database = database
        tbl.fetch_metadata()

    db.session.merge(tbl)
    db.session.commit()  # pylint: disable=consider-using-transaction

    return tbl


def create_generic_loader(
    parquet_file: str,
    table_name: Optional[str] = None,
    description: Optional[str] = None,
    sample_rows: Optional[int] = None,
    data_file: Optional[Any] = None,
    schema: Optional[str] = None,
    uuid: Optional[str] = None,
) -> Callable[..., None]:
    """Create a loader function for a specific Parquet file.

    This factory function creates loaders that match the existing pattern
    used by Superset examples.

    Args:
        parquet_file: Name of the Parquet file (without .parquet extension)
        table_name: Table name (defaults to parquet_file)
        description: Description for the dataset
        sample_rows: Default number of rows to sample
        data_file: Optional specific file path (Path object) for data/ folder pattern
        schema: Schema to load into (defaults to database default schema)
        uuid: UUID for the dataset (from YAML config) for import flow matching

    Returns:
        A loader function with the standard signature
    """
    if table_name is None:
        table_name = parquet_file

    def loader(
        only_metadata: bool = False,
        force: bool = False,
        sample: bool = False,
    ) -> None:
        """Load the dataset."""
        rows = sample_rows if sample and sample_rows is not None else None

        tbl = load_parquet_table(
            parquet_file=parquet_file,
            table_name=table_name,
            only_metadata=only_metadata,
            force=force,
            sample_rows=rows,
            data_file=data_file,
            schema=schema,
            uuid=uuid,
        )

        if description and tbl:
            tbl.description = description
            db.session.merge(tbl)
            db.session.commit()  # pylint: disable=consider-using-transaction

    # Set function name and docstring
    loader.__name__ = f"load_{parquet_file}"
    loader.__doc__ = description or f"Load {parquet_file} dataset"

    return loader
