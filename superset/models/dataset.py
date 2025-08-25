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

"""New dataset models following SIP-68 specification"""

from __future__ import annotations

import uuid
from typing import Any, Optional

from flask_appbuilder import Model
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table as SqlaTable,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from superset.models.helpers import AuditMixinNullable, ImportExportMixin, UUIDMixin
from superset.utils import core as utils
from superset.utils.backports import StrEnum

metadata = Model.metadata


class DatasetKind(StrEnum):
    PHYSICAL = "physical"
    VIRTUAL = "virtual"


# Association table for Dataset-Table many-to-many relationship
dataset_table_association = SqlaTable(
    "sip68_dataset_table_association",
    metadata,
    Column("dataset_id", Integer, ForeignKey("sip68_datasets.id", ondelete="CASCADE")),
    Column("table_id", Integer, ForeignKey("sip68_tables.id", ondelete="CASCADE")),
)

# Association table for Dataset-User (owners) many-to-many relationship
dataset_user_association = SqlaTable(
    "sip68_dataset_user_association",
    metadata,
    Column("dataset_id", Integer, ForeignKey("sip68_datasets.id", ondelete="CASCADE")),
    Column("user_id", Integer, ForeignKey("ab_user.id", ondelete="CASCADE")),
)


class Table(Model, AuditMixinNullable, ImportExportMixin, UUIDMixin):
    """
    Represents a physical table or view in a database.
    This model stores the basic table metadata without any semantic enrichment.
    """

    __tablename__ = "sip68_tables"

    id = Column(Integer, primary_key=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)

    # Database connection
    database_id = Column(Integer, ForeignKey("dbs.id"), nullable=False)
    
    # Table location
    catalog = Column(String(256), nullable=True)
    schema = Column(String(255), nullable=True)
    name = Column(String(250), nullable=False)

    # Relationships
    database = relationship("Database", back_populates="new_tables")
    columns: Mapped[list[Column]] = relationship(
        "Column",
        back_populates="table",
        cascade="all, delete-orphan",
        foreign_keys="Column.table_id",
    )
    datasets = relationship("Dataset", secondary=dataset_table_association, back_populates="tables")

    @hybrid_property
    def full_name(self) -> str:
        """Return the fully qualified table name"""
        parts = []
        if self.catalog:
            parts.append(self.catalog)
        if self.schema:
            parts.append(self.schema)
        parts.append(self.name)
        return ".".join(parts)

    def __repr__(self) -> str:
        return f"<Table {self.full_name}>"


class Dataset(Model, AuditMixinNullable, ImportExportMixin, UUIDMixin):
    """
    Represents a dataset - the semantic layer on top of physical tables.
    Datasets can be physical (1:1 with a table) or virtual (based on SQL expressions).
    """

    __tablename__ = "sip68_datasets"

    id = Column(Integer, primary_key=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)

    # Core dataset properties
    name = Column(String(250), nullable=False)
    kind = Column(Enum(DatasetKind), nullable=False, default=DatasetKind.PHYSICAL)
    
    # SQL expression defining the dataset
    # For physical datasets: simple table name
    # For virtual datasets: complex SQL query
    expression = Column(utils.MediumText(), nullable=False)
    
    # Metadata
    description = Column(Text)
    default_endpoint = Column(Text)
    is_featured = Column(Boolean, default=False)
    filter_select_enabled = Column(Boolean, default=True)
    offset = Column("offset", Integer, default=0)
    cache_timeout = Column(Integer)
    params = Column(Text)
    extra = Column(Text)
    
    # Dataset-specific configuration
    main_dttm_col = Column(String(250))
    fetch_values_predicate = Column(Text)
    normalize_columns = Column(Boolean, default=False)
    always_filter_main_dttm = Column(Boolean, default=False)
    sql = Column(utils.MediumText())  # For backward compatibility with virtual datasets

    # Relationships
    owners = relationship(User, secondary=dataset_user_association, backref="owned_datasets")
    tables = relationship("Table", secondary=dataset_table_association, back_populates="datasets")
    columns: Mapped[list[Column]] = relationship(
        "Column",
        back_populates="dataset",
        cascade="all, delete-orphan",
        foreign_keys="Column.dataset_id",
    )

    @hybrid_property
    def is_virtual(self) -> bool:
        return self.kind == DatasetKind.VIRTUAL

    @hybrid_property
    def is_physical(self) -> bool:
        return self.kind == DatasetKind.PHYSICAL

    def __repr__(self) -> str:
        return f"<Dataset {self.name} ({self.kind})>"


class Column(Model, AuditMixinNullable, ImportExportMixin, UUIDMixin):
    """
    Unified column model representing:
    1. Physical table columns
    2. Dataset metrics (aggregations)
    3. Derived/computed columns
    """

    __tablename__ = "sip68_columns"

    id = Column(Integer, primary_key=True)
    uuid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)

    # Core column properties
    name = Column(String(255), nullable=False)
    type = Column("type", String(32))  # SQL type or "metric"
    
    # SQL expression defining the column
    # For table columns: column name (e.g., "user_id")
    # For metrics: aggregation expression (e.g., "COUNT(*)")
    # For derived columns: SQL expression (e.g., "revenue - cost")
    expression = Column(utils.MediumText(), nullable=False)

    # Metadata
    verbose_name = Column(String(1024))
    description = Column(utils.MediumText())
    warning_text = Column(Text)
    units = Column(String(128))
    
    # Column properties
    is_active = Column(Boolean, default=True)
    is_temporal = Column(Boolean, default=False)
    is_spatial = Column(Boolean, default=False)
    is_partition = Column(Boolean, default=False)
    is_aggregation = Column(Boolean, default=False)  # True for metrics
    is_additive = Column(Boolean, default=True)
    
    # For exploration
    groupby = Column(Boolean, default=True)
    filterable = Column(Boolean, default=True)
    
    # Data quality metrics (can be computed offline)
    cardinality = Column(Integer)
    
    # For business logic
    increase_good = Column(Boolean, default=True)  # For metrics: is increase good?
    
    # Formatting
    d3format = Column(String(128))
    currency = Column(JSON, nullable=True)
    python_date_format = Column(String(255))
    
    # Advanced properties
    advanced_data_type = Column(String(255))
    extra = Column(Text)

    # Foreign keys - a column can belong to either a table or a dataset
    table_id = Column(Integer, ForeignKey("sip68_tables.id", ondelete="CASCADE"), nullable=True)
    dataset_id = Column(Integer, ForeignKey("sip68_datasets.id", ondelete="CASCADE"), nullable=True)

    # Relationships
    table = relationship("Table", back_populates="columns", foreign_keys=[table_id])
    dataset = relationship("Dataset", back_populates="columns", foreign_keys=[dataset_id])

    @hybrid_property
    def is_metric(self) -> bool:
        return self.is_aggregation

    @hybrid_property
    def is_derived(self) -> bool:
        """True if this is a computed column (not a direct table column)"""
        return self.table_id is None and not self.is_aggregation

    @hybrid_property
    def column_name(self) -> str:
        """Backward compatibility property"""
        return self.name

    @hybrid_property
    def metric_name(self) -> str:
        """Backward compatibility property for metrics"""
        return self.name if self.is_metric else ""

    def __repr__(self) -> str:
        col_type = "metric" if self.is_metric else "derived" if self.is_derived else "column"
        return f"<Column {self.name} ({col_type})>"