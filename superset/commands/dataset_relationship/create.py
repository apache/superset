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
"""Command for creating a dataset relationship."""
from __future__ import annotations

import logging
from functools import partial
from typing import Any

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.dataset_relationship.exceptions import (
    DatasetRelationshipColumnsValidationError,
    DatasetRelationshipCreateFailedError,
    DatasetRelationshipExistsValidationError,
    DatasetRelationshipInvalidError,
    DatasetRelationshipSelfReferenceValidationError,
    DatasetRelationshipSourceNotFoundValidationError,
    DatasetRelationshipTargetNotFoundValidationError,
)
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.daos.dataset import DatasetDAO
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.extensions import db
from superset.models.dataset_relationships import RELATIONSHIP_TYPES, JOIN_TYPES
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateDatasetRelationshipCommand(BaseCommand):
    """Create a new dataset relationship.

    Expected ``data`` keys::

        {
            "source_dataset_id": int,
            "target_dataset_id": int,
            "relationship_type": str,   # optional, default "many_to_one"
            "join_type": str,           # optional, default "LEFT"
            "is_active": bool,          # optional, default True
            "name": str | None,         # optional
            "description": str | None,  # optional
            "columns": [                # at least one required
                {
                    "source_column_name": str,
                    "target_column_name": str,
                    "operator": str,    # optional, default "="
                    "ordinal": int,     # optional, default 0
                },
            ],
        }
    """

    def __init__(self, data: dict[str, Any]) -> None:
        self._properties = data.copy()

    @transaction(
        on_error=partial(on_error, reraise=DatasetRelationshipCreateFailedError)
    )
    def run(self) -> Model:
        """Validate and persist the new relationship.

        Returns:
            The created :class:`DatasetRelationship` instance.

        Raises:
            DatasetRelationshipInvalidError: On validation failure.
            DatasetRelationshipCreateFailedError: On persistence failure.
        """
        self.validate()
        relationship = DatasetRelationshipDAO.create(
            attributes=self._properties,
        )
        logger.info(
            "Created dataset relationship id=%s (%s -> %s)",
            relationship.id,
            relationship.source_dataset_id,
            relationship.target_dataset_id,
        )
        return relationship

    def validate(self) -> None:
        """Run business-rule validations before creation.

        Raises:
            DatasetRelationshipInvalidError: When one or more validations fail.
        """
        exceptions: list[ValidationError] = []

        source_dataset_id: int | None = self._properties.get("source_dataset_id")
        target_dataset_id: int | None = self._properties.get("target_dataset_id")
        columns_data: list[dict[str, Any]] | None = self._properties.get("columns")
        relationship_type: str = self._properties.get(
            "relationship_type", "many_to_one"
        )
        join_type: str = self._properties.get("join_type", "LEFT")

        # 1. Self-reference check
        if (
            source_dataset_id is not None
            and target_dataset_id is not None
            and source_dataset_id == target_dataset_id
        ):
            exceptions.append(DatasetRelationshipSelfReferenceValidationError())

        # 2. Source dataset must exist
        source_dataset = None
        if source_dataset_id is not None:
            source_dataset = DatasetDAO.find_by_id(source_dataset_id)
            if not source_dataset:
                exceptions.append(
                    DatasetRelationshipSourceNotFoundValidationError()
                )

        # 3. Target dataset must exist
        target_dataset = None
        if target_dataset_id is not None:
            target_dataset = DatasetDAO.find_by_id(target_dataset_id)
            if not target_dataset:
                exceptions.append(
                    DatasetRelationshipTargetNotFoundValidationError()
                )

        # 4. Uniqueness check
        if source_dataset_id is not None and target_dataset_id is not None:
            if not DatasetRelationshipDAO.validate_uniqueness(
                source_dataset_id, target_dataset_id
            ):
                exceptions.append(DatasetRelationshipExistsValidationError())

        # 5. Validate relationship_type
        if relationship_type not in RELATIONSHIP_TYPES:
            exceptions.append(
                ValidationError(
                    f"Invalid relationship_type '{relationship_type}'. "
                    f"Must be one of {RELATIONSHIP_TYPES}.",
                    field_name="relationship_type",
                )
            )

        # 6. Validate join_type
        if join_type not in JOIN_TYPES:
            exceptions.append(
                ValidationError(
                    f"Invalid join_type '{join_type}'. "
                    f"Must be one of {JOIN_TYPES}.",
                    field_name="join_type",
                )
            )

        # 7. Column mappings required
        if not columns_data:
            exceptions.append(
                DatasetRelationshipColumnsValidationError(
                    "At least one column mapping is required."
                )
            )
        else:
            # Validate column names exist on respective datasets
            for idx, col in enumerate(columns_data):
                src_col = col.get("source_column_name", "")
                tgt_col = col.get("target_column_name", "")
                if not src_col or not src_col.strip():
                    exceptions.append(
                        DatasetRelationshipColumnsValidationError(
                            f"Column mapping #{idx}: "
                            "source_column_name is required."
                        )
                    )
                if not tgt_col or not tgt_col.strip():
                    exceptions.append(
                        DatasetRelationshipColumnsValidationError(
                            f"Column mapping #{idx}: "
                            "target_column_name is required."
                        )
                    )

                # Validate columns exist on datasets (if datasets loaded)
                if source_dataset and src_col:
                    source_col_names = {
                        c.column_name for c in source_dataset.columns
                    }
                    if src_col not in source_col_names:
                        exceptions.append(
                            DatasetRelationshipColumnsValidationError(
                                f"Column '{src_col}' not found in source "
                                f"dataset '{source_dataset.table_name}'."
                            )
                        )
                if target_dataset and tgt_col:
                    target_col_names = {
                        c.column_name for c in target_dataset.columns
                    }
                    if tgt_col not in target_col_names:
                        exceptions.append(
                            DatasetRelationshipColumnsValidationError(
                                f"Column '{tgt_col}' not found in target "
                                f"dataset '{target_dataset.table_name}'."
                            )
                        )

        # 8. Auto-detect cross-database flag
        if source_dataset and target_dataset:
            self._properties["is_cross_database"] = (
                source_dataset.database_id != target_dataset.database_id
            )

        if exceptions:
            raise DatasetRelationshipInvalidError(exceptions=exceptions)
