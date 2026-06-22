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
"""Periodic tasks for dataset relationship health checks.

Provides a Celery task that validates the physical column names referenced
by every active ``DatasetRelationship`` against the real tables in the
database.  If a source or target column has been renamed or removed
(schema drift), the relationship is **deactivated** and an admin alert is
logged.
"""

from __future__ import annotations

import logging
from typing import Any

from superset.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="dataset_relationships.check_schemas")
def check_all_relationship_schemas() -> dict[str, Any]:
    """Check that every active relationship's column refs still exist.

    For each active :class:`DatasetRelationship`:

    1.  Fetch real column names from the **source** table via the
        database inspector.
    2.  Fetch real column names from the **target** table.
    3.  Compare every ``source_column_name`` / ``target_column_name``
        registered on the relationship against the live columns.
    4.  If any column is missing on either side, deactivate the
        relationship and log a warning.

    Returns
    -------
    dict[str, Any]
        Summary of checks performed::

            {
                "checked": 5,
                "deactivated": 1,
                "warnings": ["Relationship 42 deactivated: source col
                             'foo' not found in table 'orders'"]
            }
    """
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.dataset_relationship import DatasetRelationshipDAO
    from superset.models.dataset_relationships import DatasetRelationship

    result: dict[str, Any] = {"checked": 0, "deactivated": 0, "warnings": []}

    # Get all active relationships
    all_rels = DatasetRelationshipDAO.find_all()
    active_rels = [r for r in all_rels if getattr(r, "is_active", False)]
    result["checked"] = len(active_rels)

    for rel in active_rels:
        warnings = _check_single_relationship(rel)
        if warnings:
            # Deactivate — one or more columns are dead
            rel.is_active = False
            db.session.flush()
            result["deactivated"] += 1
            result["warnings"].extend(warnings)
            logger.warning(
                "Schema drift: deactivated relationship %d (%s: col %s)",
                rel.id,
                "; ".join(warnings),
                [c.source_column_name for c in (rel.columns or [])],
                extra={"component": "superset"})

    db.session.commit()
    return result


def _check_single_relationship(
    rel: DatasetRelationship,
) -> list[str]:
    """Check one relationship and return warnings (empty = healthy)."""
    from superset.connectors.sqla.models import SqlaTable

    warnings: list[str] = []

    # Resolve source dataset
    source_ds: SqlaTable | None = (
        rel.source_dataset if hasattr(rel, "source_dataset") else None
    )
    target_ds: SqlaTable | None = (
        rel.target_dataset if hasattr(rel, "target_dataset") else None
    )

    if source_ds is None:
        warnings.append(
            f"Relationship #{rel.id}: source_dataset not loaded"
        )
        return warnings

    if target_ds is None:
        warnings.append(
            f"Relationship #{rel.id}: target_dataset not loaded"
        )
        return warnings

    # Fetch live column names from the database
    source_cols = _get_table_column_names(source_ds)
    target_cols = _get_table_column_names(target_ds)

    if source_cols is None:
        warnings.append(
            f"Relationship #{rel.id}: could not inspect source "
            f"table '{source_ds.table_name}'"
        )
        return warnings

    if target_cols is None:
        warnings.append(
            f"Relationship #{rel.id}: could not inspect target "
            f"table '{target_ds.table_name}'"
        )
        return warnings

    for rel_col in (rel.columns or []):
        src_name = rel_col.source_column_name
        tgt_name = rel_col.target_column_name

        if src_name is not None and src_name not in source_cols:
            warnings.append(
                f"Relationship #{rel.id}: source column '{src_name}' "
                f"not found in table '{source_ds.table_name}'"
            )
        if tgt_name is not None and tgt_name not in target_cols:
            warnings.append(
                f"Relationship #{rel.id}: target column '{tgt_name}' "
                f"not found in table '{target_ds.table_name}'"
            )

    return warnings


def _get_table_column_names(
    dataset: SqlaTable,
) -> set[str] | None:
    """Return the set of real column names for *dataset*'s physical table.

    Returns ``None`` when the inspection fails (e.g. table doesn't exist,
    connectivity error).
    """
    from superset.models.core import Database
    from superset.sql.parse import Table

    database: Database | None = (
        dataset.database if hasattr(dataset, "database") else None
    )
    if database is None:
        return None

    try:
        tbl = Table(
            table=dataset.table_name,
            catalog=getattr(dataset, "catalog", None),
            schema=getattr(dataset, "schema", None),
        )
        columns = database.get_columns(tbl)
        return {col.get("column_name") or col.get("name") for col in columns}

    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "Failed to inspect columns for dataset %d (%s)",
            dataset.id,
            dataset.table_name,
        )
        return None
