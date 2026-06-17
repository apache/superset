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
"""Command for deleting dataset relationships."""
from __future__ import annotations

import logging
from functools import partial
from typing import Optional

from superset.commands.base import BaseCommand
from superset.commands.dataset_relationship.exceptions import (
    DatasetRelationshipDeleteFailedError,
    DatasetRelationshipForbiddenError,
    DatasetRelationshipNotFoundError,
)
from superset.daos.dataset_relationship import DatasetRelationshipDAO
from superset.models.dataset_relationships import DatasetRelationship
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteDatasetRelationshipCommand(BaseCommand):
    """Delete one or more dataset relationships by their IDs."""

    def __init__(self, model_ids: list[int]) -> None:
        self._model_ids = model_ids
        self._models: Optional[list[DatasetRelationship]] = None

    @transaction(
        on_error=partial(on_error, reraise=DatasetRelationshipDeleteFailedError)
    )
    def run(self) -> None:
        """Validate and delete the relationships.

        Raises:
            DatasetRelationshipNotFoundError: If any relationship is missing.
            DatasetRelationshipDeleteFailedError: On persistence failure.
        """
        self.validate()
        assert self._models is not None
        DatasetRelationshipDAO.delete(self._models)
        logger.info(
            "Deleted dataset relationship(s) with ids=%s",
            self._model_ids,
        )

    def validate(self) -> None:
        """Ensure all requested relationships exist.

        Raises:
            DatasetRelationshipNotFoundError: If any relationship cannot be
                found.
        """
        self._models = DatasetRelationshipDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise DatasetRelationshipNotFoundError()
