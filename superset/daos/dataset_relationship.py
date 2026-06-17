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
"""DAO for dataset relationship CRUD operations.

Provides data access methods for :class:`DatasetRelationship` and
:class:`DatasetRelationshipColumn` models, following the standard Superset
DAO pattern (``BaseDAO`` subclass with classmethods).
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.models.dataset_relationships import (
    DatasetRelationship,
    DatasetRelationshipColumn,
)

logger = logging.getLogger(__name__)


class DatasetRelationshipDAO(BaseDAO[DatasetRelationship]):
    """Data-access object for :class:`DatasetRelationship` instances.

    Inherits generic CRUD helpers from :class:`BaseDAO` and adds
    relationship-specific query methods used by the Command layer.
    """

    @classmethod
    def find_by_id(  # type: ignore[override]
        cls,
        model_id: int | str,
        skip_base_filter: bool = False,
        id_column: str | None = None,
        query_options: list[Any] | None = None,
    ) -> DatasetRelationship | None:
        """Find a relationship by its primary key, eager-loading columns.

        Args:
            model_id: The relationship ID.
            skip_base_filter: Whether to skip any base filter.
            id_column: Optional column name to use for lookup.
            query_options: Optional extra SQLAlchemy query options.

        Returns:
            The :class:`DatasetRelationship` instance or ``None``.
        """
        options = query_options or []
        if not any(
            str(opt) == str(joinedload(DatasetRelationship.columns))
            for opt in options
        ):
            options.append(joinedload(DatasetRelationship.columns))
        return super().find_by_id(
            model_id,
            skip_base_filter=skip_base_filter,
            id_column=id_column,
            query_options=options,
        )

    @classmethod
    def find_by_datasets(
        cls,
        source_dataset_id: int,
        target_dataset_id: int,
    ) -> DatasetRelationship | None:
        """Find a relationship between a specific source and target dataset pair.

        Args:
            source_dataset_id: The source dataset ID.
            target_dataset_id: The target dataset ID.

        Returns:
            The matching :class:`DatasetRelationship` or ``None``.
        """
        try:
            return (
                db.session.query(DatasetRelationship)
                .filter(
                    DatasetRelationship.source_dataset_id == source_dataset_id,
                    DatasetRelationship.target_dataset_id == target_dataset_id,
                )
                .one_or_none()
            )
        except SQLAlchemyError:
            logger.exception(
                "Error finding relationship for datasets %s -> %s",
                source_dataset_id,
                target_dataset_id,
            )
            return None

    @classmethod
    def find_active(cls) -> list[DatasetRelationship]:
        """Return all active relationships.

        Returns:
            A list of active :class:`DatasetRelationship` instances.
        """
        try:
            return (
                db.session.query(DatasetRelationship)
                .filter(DatasetRelationship.is_active.is_(True))
                .all()
            )
        except SQLAlchemyError:
            logger.exception("Error fetching active relationships")
            return []

    @classmethod
    def find_by_dataset_id(
        cls,
        dataset_id: int,
        active_only: bool = True,
    ) -> list[DatasetRelationship]:
        """Return all relationships where *dataset_id* is source or target.

        Args:
            dataset_id: The dataset ID to search for.
            active_only: If ``True`` (default), only return active
                relationships.

        Returns:
            A list of matching :class:`DatasetRelationship` instances.
        """
        try:
            query = db.session.query(DatasetRelationship).filter(
                db.or_(
                    DatasetRelationship.source_dataset_id == dataset_id,
                    DatasetRelationship.target_dataset_id == dataset_id,
                )
            )
            if active_only:
                query = query.filter(DatasetRelationship.is_active.is_(True))
            return query.all()
        except SQLAlchemyError:
            logger.exception(
                "Error fetching relationships for dataset %s", dataset_id
            )
            return []

    @classmethod
    def validate_uniqueness(
        cls,
        source_dataset_id: int,
        target_dataset_id: int,
        relationship_id: int | None = None,
    ) -> bool:
        """Check that no other relationship exists for the same dataset pair.

        Args:
            source_dataset_id: The source dataset ID.
            target_dataset_id: The target dataset ID.
            relationship_id: If provided, exclude this relationship from the
                check (useful during updates).

        Returns:
            ``True`` if the pair is unique (no duplicate), ``False`` otherwise.
        """
        try:
            query = db.session.query(DatasetRelationship).filter(
                DatasetRelationship.source_dataset_id == source_dataset_id,
                DatasetRelationship.target_dataset_id == target_dataset_id,
            )
            if relationship_id is not None:
                query = query.filter(
                    DatasetRelationship.id != relationship_id
                )
            return query.count() == 0
        except SQLAlchemyError:
            logger.exception("Error validating uniqueness for relationship")
            return False

    @classmethod
    def create(
        cls,
        item: DatasetRelationship | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> DatasetRelationship:
        """Create a new :class:`DatasetRelationship` with optional column mappings.

        Handles the nested ``columns`` key in *attributes*, converting dicts
        into :class:`DatasetRelationshipColumn` instances before persisting.

        Args:
            item: An optional pre-built model instance.
            attributes: Key-value pairs to set on the model.

        Returns:
            The newly created :class:`DatasetRelationship`.
        """
        if not item:
            item = DatasetRelationship()

        if attributes:
            columns_data = attributes.pop("columns", None)
            for key, value in attributes.items():
                setattr(item, key, value)

            if columns_data:
                for col_data in columns_data:
                    if isinstance(col_data, dict):
                        col = DatasetRelationshipColumn(**col_data)
                    else:
                        col = col_data
                    item.columns.append(col)

        db.session.add(item)
        return item

    @classmethod
    def update(
        cls,
        item: DatasetRelationship | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> DatasetRelationship:
        """Update an existing :class:`DatasetRelationship`.

        When ``columns`` is present in *attributes*, the existing column
        mappings are replaced wholesale (delete-orphan cascade handles
        removal of old entries).

        Args:
            item: The model instance to update.
            attributes: Key-value pairs to set on the model.

        Returns:
            The updated :class:`DatasetRelationship`.
        """
        if not item:
            raise ValueError("An existing DatasetRelationship item is required for update.")

        if attributes:
            columns_data = attributes.pop("columns", None)
            for key, value in attributes.items():
                setattr(item, key, value)

            if columns_data is not None:
                # Replace column mappings entirely
                item.columns.clear()
                for col_data in columns_data:
                    if isinstance(col_data, dict):
                        col = DatasetRelationshipColumn(**col_data)
                    else:
                        col = col_data
                    item.columns.append(col)

        if item not in db.session:
            return db.session.merge(item)

        return item

    @classmethod
    def delete(cls, items: list[DatasetRelationship]) -> None:
        """Delete one or more relationships and their column mappings.

        Args:
            items: The list of :class:`DatasetRelationship` instances to
                remove.  Associated columns are removed via cascade.
        """
        for item in items:
            db.session.delete(item)
