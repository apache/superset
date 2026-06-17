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
"""Command for updating a dataset relationship."""
from __future__ import annotations

import logging
from functools import partial
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.dataset_relationship.exceptions import (
    DatasetRelationshipColumnsValidationError,
    DatasetRelationshipExistsValidationError,
    DatasetRelationshipInvalidError,
    DatasetRelationshipNotFoundError,
    DatasetRelationshipSelfReferenceValidationError,
    DatasetRelationshipSourceNotFoundValidationError,
    DatasetRelationshipTargetNotFoundValidationError,
    DatasetRelationshipUpdateFailedError,
)
from superset.daos.dataset import DatasetDAO
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.models.dataset_relationships import (
    DatasetRelationship,
    JOIN_TYPES,
    RELATIONSHIP_TYPES,
)
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateDatasetRelationshipCommand(BaseCommand):
    """Update an existing dataset relationship.

    Only the keys present in ``data`` are modified; absent keys are left
    untouched.
    """

    def __init__(self, model_id: int, data: dict[str, Any]) -> None:
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[DatasetRelationship] = None

    @transaction(
        on_error=partial(on_error, reraise=DatasetRelationshipUpdateFailedError)
    )
    def run(self) -> Model:
        """Validate and persist the update.

        Returns:
            The updated :class:`DatasetRelationship` instance.

        Raises:
            DatasetRelationshipNotFoundError: If the relationship does not exist.
            DatasetRelationshipInvalidError: On validation failure.
            DatasetRelationshipUpdateFailedError: On persistence failure.
        """
        self.validate()
        assert self._model is not None
        relationship = DatasetRelationshipDAO.update(
            item=self._model,
            attributes=self._properties,
        )
        logger.info(
            "Updated dataset relationship id=%s",
            relationship.id,
        )
        return relationship

    def validate(self) -> None:
        """Run business-rule validations before update.

        Raises:
            DatasetRelationshipNotFoundError: If the relationship does not exist.
            DatasetRelationshipInvalidError: When one or more validations fail.
        """
        # Fetch existing model
        self._model = DatasetRelationshipDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatasetRelationshipNotFoundError()

        exceptions: list[ValidationError] = []

        source_dataset_id: int = self._properties.get(
            "source_dataset_id", self._model.source_dataset_id
        )
        target_dataset_id: int = self._properties.get(
            "target_dataset_id", self._model.target_dataset_id
        )

        # 1. Self-reference check
        if source_dataset_id == target_dataset_id:
            exceptions.append(DatasetRelationshipSelfReferenceValidationError())

        # 2. Validate datasets exist (only if they are being changed)
        source_dataset = None
        if "source_dataset_id" in self._properties:
            source_dataset = DatasetDAO.find_by_id(source_dataset_id)
            if not source_dataset:
                exceptions.append(
                    DatasetRelationshipSourceNotFoundValidationError()
                )
        else:
            source_dataset = self._model.source_dataset

        target_dataset = None
        if "target_dataset_id" in self._properties:
            target_dataset = DatasetDAO.find_by_id(target_dataset_id)
            if not target_dataset:
                exceptions.append(
                    DatasetRelationshipTargetNotFoundValidationError()
                )
        else:
            target_dataset = self._model.target_dataset

        # 3. Uniqueness check (if datasets changed)
        if (
            "source_dataset_id" in self._properties
            or "target_dataset_id" in self._properties
        ):
            if not DatasetRelationshipDAO.validate_uniqueness(
                source_dataset_id,
                target_dataset_id,
                relationship_id=self._model_id,
            ):
                exceptions.append(DatasetRelationshipExistsValidationError())

        # 4. Validate relationship_type (if being changed)
        if "relationship_type" in self._properties:
            rel_type = self._properties["relationship_type"]
            if rel_type not in RELATIONSHIP_TYPES:
                exceptions.append(
                    ValidationError(
                        f"Invalid relationship_type '{rel_type}'. "
                        f"Must be one of {RELATIONSHIP_TYPES}.",
                        field_name="relationship_type",
                    )
                )

        # 5. Validate join_type (if being changed)
        if "join_type" in self._properties:
            jt = self._properties["join_type"]
            if jt not in JOIN_TYPES:
                exceptions.append(
                    ValidationError(
                        f"Invalid join_type '{jt}'. "
                        f"Must be one of {JOIN_TYPES}.",
                        field_name="join_type",
                    )
                )

        # 6. Validate column mappings (if being changed)
        columns_data = self._properties.get("columns")
        if columns_data is not None:
            if not columns_data:
                exceptions.append(
                    DatasetRelationshipColumnsValidationError(
                        "At least one column mapping is required."
                    )
                )
            else:
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

        # 7. Auto-detect cross-database flag
        if source_dataset and target_dataset:
            self._properties["is_cross_database"] = (
                source_dataset.database_id != target_dataset.database_id
            )

        if exceptions:
            raise DatasetRelationshipInvalidError(exceptions=exceptions)
