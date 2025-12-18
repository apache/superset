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
from __future__ import annotations

import enum
import re
from functools import cached_property
from typing import TYPE_CHECKING

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import relationship

from superset.models.helpers import AuditMixinNullable, UUIDMixin
from superset.utils.backports import StrEnum
from superset.utils.core import GenericDataType

if TYPE_CHECKING:
    pass


# Type mapping patterns to convert SQL type strings to GenericDataType.
# Based on BaseEngineSpec._default_column_type_mappings patterns.
_TYPE_PATTERNS: list[tuple[re.Pattern[str], GenericDataType]] = [
    # String types
    (re.compile(r"^string", re.IGNORECASE), GenericDataType.STRING),
    (re.compile(r"^n((var)?char|text)", re.IGNORECASE), GenericDataType.STRING),
    (re.compile(r"^(var)?char", re.IGNORECASE), GenericDataType.STRING),
    (re.compile(r"^(tiny|medium|long)?text", re.IGNORECASE), GenericDataType.STRING),
    (re.compile(r"^uuid", re.IGNORECASE), GenericDataType.STRING),
    (re.compile(r"^json", re.IGNORECASE), GenericDataType.STRING),
    # Numeric types
    (re.compile(r"^smallint", re.IGNORECASE), GenericDataType.NUMERIC),
    (re.compile(r"^int(eger)?", re.IGNORECASE), GenericDataType.NUMERIC),
    (re.compile(r"^bigint", re.IGNORECASE), GenericDataType.NUMERIC),
    (re.compile(r"^long", re.IGNORECASE), GenericDataType.NUMERIC),
    (re.compile(r"^decimal", re.IGNORECASE), GenericDataType.NUMERIC),
    (re.compile(r"^numeric", re.IGNORECASE), GenericDataType.NUMERIC),
    (re.compile(r"^float", re.IGNORECASE), GenericDataType.NUMERIC),
    (re.compile(r"^double", re.IGNORECASE), GenericDataType.NUMERIC),
    (re.compile(r"^real", re.IGNORECASE), GenericDataType.NUMERIC),
    (re.compile(r"^(small|big)?serial", re.IGNORECASE), GenericDataType.NUMERIC),
    (re.compile(r"^money", re.IGNORECASE), GenericDataType.NUMERIC),
    # Temporal types
    (re.compile(r"^timestamp", re.IGNORECASE), GenericDataType.TEMPORAL),
    (re.compile(r"^datetime", re.IGNORECASE), GenericDataType.TEMPORAL),
    (re.compile(r"^date", re.IGNORECASE), GenericDataType.TEMPORAL),
    (re.compile(r"^time", re.IGNORECASE), GenericDataType.TEMPORAL),
    (re.compile(r"^interval", re.IGNORECASE), GenericDataType.TEMPORAL),
    # Boolean types
    (re.compile(r"^bool(ean)?", re.IGNORECASE), GenericDataType.BOOLEAN),
]


def _infer_generic_type(data_type: str) -> GenericDataType:
    """
    Infer GenericDataType from a SQL type string.

    :param data_type: SQL type string (e.g., "VARCHAR(255)", "INTEGER")
    :return: GenericDataType enum value, defaults to STRING if no match
    """
    for pattern, generic_type in _TYPE_PATTERNS:
        if pattern.match(data_type):
            return generic_type
    return GenericDataType.STRING


class AnalysisStatus(str, enum.Enum):
    RESERVED = "reserved"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class DatabaseSchemaReport(Model, AuditMixinNullable, UUIDMixin):
    """Tracks database schema analysis runs. ONE active report per database+schema."""

    __tablename__ = "database_schema_report"

    id = sa.Column(sa.Integer, primary_key=True)
    database_id = sa.Column(
        sa.Integer, sa.ForeignKey("dbs.id", ondelete="CASCADE"), nullable=False
    )
    schema_name = sa.Column(sa.String(256), nullable=False)
    celery_task_id = sa.Column(sa.String(256), nullable=True)
    status = sa.Column(
        sa.Enum(AnalysisStatus, values_callable=lambda x: [e.value for e in x]),
        default=AnalysisStatus.RESERVED,
        nullable=False,
    )
    reserved_dttm = sa.Column(sa.DateTime, nullable=True)
    start_dttm = sa.Column(sa.DateTime, nullable=True)
    end_dttm = sa.Column(sa.DateTime, nullable=True)
    error_message = sa.Column(sa.Text, nullable=True)
    confidence_score = sa.Column(sa.Float, nullable=True)
    confidence_breakdown = sa.Column(sa.Text, nullable=True)  # JSON dict
    confidence_recommendations = sa.Column(sa.Text, nullable=True)  # JSON array
    confidence_validation_notes = sa.Column(sa.Text, nullable=True)
    extra_json = sa.Column(sa.Text, nullable=True)

    # Relationships
    database = relationship("Database", backref="schema_reports")
    tables = relationship(
        "AnalyzedTable",
        back_populates="report",
        cascade="all, delete-orphan",
    )
    joins = relationship(
        "InferredJoin",
        back_populates="report",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        sa.UniqueConstraint(
            "database_id",
            "schema_name",
            name="uq_database_schema_report_database_schema",
        ),
    )


class TableType(StrEnum):
    TABLE = "table"
    VIEW = "view"
    MATERIALIZED_VIEW = "materialized_view"


class AnalyzedTable(Model, AuditMixinNullable, UUIDMixin):
    """Stores metadata for each table/view discovered during schema analysis."""

    __tablename__ = "analyzed_table"

    id = sa.Column(sa.Integer, primary_key=True)
    report_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("database_schema_report.id", ondelete="CASCADE"),
        nullable=False,
    )
    table_name = sa.Column(sa.String(256), nullable=False)
    table_type = sa.Column(
        sa.Enum(TableType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    db_comment = sa.Column(sa.Text, nullable=True)
    ai_description = sa.Column(sa.Text, nullable=True)
    extra_json = sa.Column(sa.Text, nullable=True)

    # Relationships
    report = relationship("DatabaseSchemaReport", back_populates="tables")
    columns = relationship(
        "AnalyzedColumn",
        back_populates="table",
        cascade="all, delete-orphan",
    )
    source_joins = relationship(
        "InferredJoin",
        back_populates="source_table",
        foreign_keys="InferredJoin.source_table_id",
        cascade="all, delete-orphan",
    )
    target_joins = relationship(
        "InferredJoin",
        back_populates="target_table",
        foreign_keys="InferredJoin.target_table_id",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        sa.UniqueConstraint(
            "report_id", "table_name", name="uq_analyzed_table_report_table"
        ),
    )


class AnalyzedColumn(Model, AuditMixinNullable, UUIDMixin):
    """Stores metadata for each column discovered during schema analysis."""

    __tablename__ = "analyzed_column"

    id = sa.Column(sa.Integer, primary_key=True)
    table_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("analyzed_table.id", ondelete="CASCADE"),
        nullable=False,
    )
    column_name = sa.Column(sa.String(256), nullable=False)
    data_type = sa.Column(sa.String(256), nullable=False)
    ordinal_position = sa.Column(sa.Integer, nullable=False)
    is_primary_key = sa.Column(sa.Boolean, default=False, nullable=False)
    is_foreign_key = sa.Column(sa.Boolean, default=False, nullable=False)
    db_comment = sa.Column(sa.Text, nullable=True)
    ai_description = sa.Column(sa.Text, nullable=True)
    extra_json = sa.Column(sa.Text, nullable=True)

    # Relationships
    table = relationship("AnalyzedTable", back_populates="columns")

    __table_args__ = (
        sa.UniqueConstraint(
            "table_id", "column_name", name="uq_analyzed_column_table_column"
        ),
        sa.CheckConstraint(
            "ordinal_position >= 1", name="ck_analyzed_column_ordinal_position"
        ),
    )

    @cached_property
    def type_generic(self) -> GenericDataType:
        """
        Infer generic data type from the column's SQL data type string.

        Uses regex pattern matching based on common SQL type conventions
        (consistent with BaseEngineSpec._default_column_type_mappings).

        :return: GenericDataType enum value
        """
        return _infer_generic_type(self.data_type)


class JoinType(StrEnum):
    INNER = "inner"
    LEFT = "left"
    RIGHT = "right"
    FULL = "full"
    CROSS = "cross"


class Cardinality(StrEnum):
    ONE_TO_ONE = "1:1"
    ONE_TO_MANY = "1:N"
    MANY_TO_ONE = "N:1"
    MANY_TO_MANY = "N:M"


class InferredJoin(Model, AuditMixinNullable, UUIDMixin):
    """Stores ALL AI-inferred joins. Multiple joins per table pair allowed."""

    __tablename__ = "inferred_join"

    id = sa.Column(sa.Integer, primary_key=True)
    report_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("database_schema_report.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_table_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("analyzed_table.id", ondelete="CASCADE"),
        nullable=False,
    )
    target_table_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("analyzed_table.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_columns = sa.Column(sa.Text, nullable=False)  # JSON array
    target_columns = sa.Column(sa.Text, nullable=False)  # JSON array
    join_type = sa.Column(
        sa.Enum(JoinType, values_callable=lambda x: [e.value for e in x]),
        default=JoinType.INNER,
        nullable=False,
    )
    cardinality = sa.Column(
        sa.Enum(Cardinality, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    semantic_context = sa.Column(sa.Text, nullable=True)
    extra_json = sa.Column(sa.Text, nullable=True)

    # Relationships
    report = relationship("DatabaseSchemaReport", back_populates="joins")
    source_table = relationship(
        "AnalyzedTable",
        back_populates="source_joins",
        foreign_keys=[source_table_id],
    )
    target_table = relationship(
        "AnalyzedTable",
        back_populates="target_joins",
        foreign_keys=[target_table_id],
    )
