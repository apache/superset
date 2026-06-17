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
"""SQLAlchemy models for dataset relationships.

This module defines the ORM models that map to the ``dataset_relationships``
and ``dataset_relationship_columns`` tables created by migration
``a8b9c0d1e2f3``.  These models are the backbone of the *Dataset Relationship
Engine*  They allow users to declare typed,
directed relationships between any two Superset datasets (``SqlaTable``),
including cross-database ones, and to specify the column pairs that form the
join condition.

Typical usage::

    from superset.models.dataset_relationships import (
        DatasetRelationship,
        DatasetRelationshipColumn,
    )

    rel = DatasetRelationship(
        source_dataset_id=1,
        target_dataset_id=2,
        relationship_type="many_to_one",
        join_type="LEFT",
    )
    rel.columns.append(
        DatasetRelationshipColumn(
            source_column_name="customer_id",
            target_column_name="id",
        )
    )
    db.session.add(rel)
    db.session.commit()
"""

from __future__ import annotations

import logging
import uuid as uuid_module
from typing import Any

from flask_appbuilder import Model
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from superset.models.helpers import AuditMixinNullable

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Valid relationship cardinality types.
RELATIONSHIP_TYPES: tuple[str, ...] = (
    "one_to_one",
    "one_to_many",
    "many_to_one",
    "many_to_many",
)

#: Valid SQL join types supported by the engine.
JOIN_TYPES: tuple[str, ...] = (
    "INNER",
    "LEFT",
    "RIGHT",
    "FULL",
)

#: Valid operators for column-pair join conditions.
COLUMN_OPERATORS: tuple[str, ...] = (
    "=",
    "!=",
    ">",
    "<",
    ">=",
    "<=",
)


# ---------------------------------------------------------------------------
# Model: DatasetRelationship
# ---------------------------------------------------------------------------


class DatasetRelationship(Model, AuditMixinNullable):
    """Represents a declared relationship between two Superset datasets.

    A relationship links a *source* dataset to a *target* dataset via one or
    more column-pair mappings (see :class:`DatasetRelationshipColumn`).  The
    relationship carries metadata such as cardinality
    (``relationship_type``), the SQL join flavour (``join_type``), whether the
    two datasets live in different databases (``is_cross_database``), and an
    activation flag (``is_active``).

    The engine uses this information at query time to:

    * Append a SQL ``JOIN`` clause when both datasets share the same database.
    * Perform an application-level Pandas merge when the datasets reside in
      different databases.
    """

    __tablename__ = "dataset_relationships"
    __table_args__ = (
        UniqueConstraint(
            "source_dataset_id",
            "target_dataset_id",
            name="uq_dataset_relationship",
        ),
    )

    # -- Primary key & UUID ------------------------------------------------

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(
        String(36),
        default=lambda: str(uuid_module.uuid4()),
        unique=True,
        nullable=False,
    )

    # -- Foreign keys ------------------------------------------------------

    source_dataset_id: int = Column(
        Integer,
        ForeignKey("tables.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_dataset_id: int = Column(
        Integer,
        ForeignKey("tables.id", ondelete="CASCADE"),
        nullable=False,
    )

    # -- Relationship metadata ---------------------------------------------

    relationship_type: str = Column(
        String(20),
        nullable=False,
        default="many_to_one",
        server_default="many_to_one",
    )
    join_type: str = Column(
        String(10),
        nullable=False,
        default="LEFT",
        server_default="LEFT",
    )
    is_cross_database: bool = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    is_active: bool = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    # -- Descriptive fields ------------------------------------------------

    name: str | None = Column(String(256), nullable=True)
    description: str | None = Column(Text, nullable=True)

    # -- ORM relationships -------------------------------------------------

    source_dataset = relationship(
        "SqlaTable",
        foreign_keys=[source_dataset_id],
        backref="outgoing_relationships",
        lazy="joined",
    )
    target_dataset = relationship(
        "SqlaTable",
        foreign_keys=[target_dataset_id],
        backref="incoming_relationships",
        lazy="joined",
    )
    columns: list[DatasetRelationshipColumn] = relationship(
        "DatasetRelationshipColumn",
        back_populates="relationship_obj",
        cascade="all, delete-orphan",
        order_by="DatasetRelationshipColumn.ordinal",
        lazy="joined",
    )

    # -- Validation helpers ------------------------------------------------

    def validate_relationship_type(self) -> bool:
        """Return ``True`` if :attr:`relationship_type` is a known value.

        Raises:
            ValueError: When the type is not in :data:`RELATIONSHIP_TYPES`.
        """
        if self.relationship_type not in RELATIONSHIP_TYPES:
            raise ValueError(
                f"Invalid relationship_type '{self.relationship_type}'. "
                f"Must be one of {RELATIONSHIP_TYPES}."
            )
        return True

    def validate_join_type(self) -> bool:
        """Return ``True`` if :attr:`join_type` is a known value.

        Raises:
            ValueError: When the type is not in :data:`JOIN_TYPES`.
        """
        if self.join_type not in JOIN_TYPES:
            raise ValueError(
                f"Invalid join_type '{self.join_type}'. "
                f"Must be one of {JOIN_TYPES}."
            )
        return True

    def validate(self) -> bool:
        """Run all field-level validations.

        Returns:
            ``True`` when every check passes.

        Raises:
            ValueError: On the first validation failure encountered.
        """
        self.validate_relationship_type()
        self.validate_join_type()
        if self.source_dataset_id == self.target_dataset_id:
            raise ValueError(
                "source_dataset_id and target_dataset_id must be different."
            )
        if not self.columns:
            raise ValueError(
                "A relationship must have at least one column mapping."
            )
        return True

    # -- Utility methods ---------------------------------------------------

    def is_cross_db(self) -> bool:
        """Check whether the related datasets belong to different databases.

        This method first consults the persisted ``is_cross_database`` flag.
        If both relationship endpoints are loaded, it also performs a live
        comparison of their ``database_id`` attributes.
        """
        if self.is_cross_database:
            return True
        # Fallback: compare database IDs when both sides are loaded.
        if self.source_dataset and self.target_dataset:
            return (
                self.source_dataset.database_id
                != self.target_dataset.database_id
            )
        return self.is_cross_database

    def to_dict(self) -> dict[str, Any]:
        """Serialise the relationship to a plain dictionary.

        Returns:
            A JSON-serialisable ``dict`` containing all relevant fields,
            including nested column mappings.
        """
        return {
            "id": self.id,
            "uuid": str(self.uuid) if self.uuid else None,
            "source_dataset_id": self.source_dataset_id,
            "target_dataset_id": self.target_dataset_id,
            "relationship_type": self.relationship_type,
            "join_type": self.join_type,
            "is_cross_database": self.is_cross_database,
            "is_active": self.is_active,
            "name": self.name,
            "description": self.description,
            "columns": [col.to_dict() for col in (self.columns or [])],
        }

    def __repr__(self) -> str:  # noqa: D105
        return (
            f"<DatasetRelationship "
            f"id={self.id} "
            f"src={self.source_dataset_id} -> tgt={self.target_dataset_id} "
            f"type={self.relationship_type!r} "
            f"join={self.join_type!r} "
            f"active={self.is_active}>"
        )


# ---------------------------------------------------------------------------
# Model: DatasetRelationshipColumn
# ---------------------------------------------------------------------------


class DatasetRelationshipColumn(Model, AuditMixinNullable):
    """Maps a single column pair within a :class:`DatasetRelationship`.

    Each instance describes one element of the join condition, e.g.
    ``source.customer_id = target.id``.  Multiple instances with increasing
    ``ordinal`` values form a composite (multi-column) join key.
    """

    __tablename__ = "dataset_relationship_columns"
    __table_args__ = (
        UniqueConstraint(
            "relationship_id",
            "source_column_name",
            "target_column_name",
            name="uq_rel_column_pair",
        ),
    )

    # -- Primary key -------------------------------------------------------

    id: int = Column(Integer, primary_key=True, autoincrement=True)

    # -- Foreign key -------------------------------------------------------

    relationship_id: int = Column(
        Integer,
        ForeignKey("dataset_relationships.id", ondelete="CASCADE"),
        nullable=False,
    )

    # -- Column mapping fields ---------------------------------------------

    source_column_name: str = Column(String(256), nullable=False)
    target_column_name: str = Column(String(256), nullable=False)

    operator: str = Column(
        String(10),
        nullable=False,
        default="=",
        server_default="=",
    )

    ordinal: int = Column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    # -- ORM relationships -------------------------------------------------

    # NOTE: The Python attribute is named ``relationship_obj`` to avoid
    # shadowing ``sqlalchemy.orm.relationship``.  The ``back_populates``
    # value on :class:`DatasetRelationship.columns` must reference the
    # attribute name on *this* class, so we keep them in sync via a
    # dedicated alias property and use ``back_populates="relationship_obj"``
    # on both sides.
    relationship_obj: DatasetRelationship = relationship(
        "DatasetRelationship",
        back_populates="columns",
    )

    # -- Validation helpers ------------------------------------------------

    def validate_operator(self) -> bool:
        """Return ``True`` if :attr:`operator` is a known value.

        Raises:
            ValueError: When the operator is not in :data:`COLUMN_OPERATORS`.
        """
        if self.operator not in COLUMN_OPERATORS:
            raise ValueError(
                f"Invalid operator '{self.operator}'. "
                f"Must be one of {COLUMN_OPERATORS}."
            )
        return True

    def validate_column_names(self) -> bool:
        """Ensure that both column name fields are non-empty strings.

        Raises:
            ValueError: When a column name is ``None`` or blank.
        """
        if not self.source_column_name or not self.source_column_name.strip():
            raise ValueError("source_column_name must be a non-empty string.")
        if not self.target_column_name or not self.target_column_name.strip():
            raise ValueError("target_column_name must be a non-empty string.")
        return True

    def validate(self) -> bool:
        """Run all field-level validations.

        Returns:
            ``True`` when every check passes.

        Raises:
            ValueError: On the first validation failure encountered.
        """
        self.validate_operator()
        self.validate_column_names()
        return True

    # -- Utility methods ---------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        """Serialise the column mapping to a plain dictionary."""
        return {
            "id": self.id,
            "relationship_id": self.relationship_id,
            "source_column_name": self.source_column_name,
            "target_column_name": self.target_column_name,
            "operator": self.operator,
            "ordinal": self.ordinal,
        }

    def __repr__(self) -> str:  # noqa: D105
        return (
            f"<DatasetRelationshipColumn "
            f"id={self.id} "
            f"rel={self.relationship_id} "
            f"src={self.source_column_name!r} "
            f"{self.operator} "
            f"tgt={self.target_column_name!r}>"
        )
