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
"""add_dataset_relationships

Revision ID: a8b9c0d1e2f3
Revises: ce6bd21901ab
Create Date: 2026-05-14 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a8b9c0d1e2f3"
down_revision = "33d7e0e21daa"


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Table: dataset_relationships
    # Stores declared relationships between two Superset datasets.
    # ------------------------------------------------------------------
    op.create_table(
        "dataset_relationships",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "uuid",
            sa.String(length=36),
            unique=True,
            nullable=False,
        ),
        # Source / Target dataset foreign keys → tables.id (SqlaTable)
        sa.Column(
            "source_dataset_id",
            sa.Integer(),
            sa.ForeignKey("tables.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_dataset_id",
            sa.Integer(),
            sa.ForeignKey("tables.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Relationship metadata
        sa.Column(
            "relationship_type",
            sa.String(length=20),
            nullable=False,
            server_default="many_to_one",
        ),
        sa.Column(
            "join_type",
            sa.String(length=10),
            nullable=False,
            server_default="LEFT",
        ),
        sa.Column(
            "is_cross_database",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        # Descriptive
        sa.Column("name", sa.String(length=256), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        # Audit columns (AuditMixinNullable pattern)
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column(
            "created_by_fk",
            sa.Integer(),
            sa.ForeignKey("ab_user.id"),
            nullable=True,
        ),
        sa.Column(
            "changed_by_fk",
            sa.Integer(),
            sa.ForeignKey("ab_user.id"),
            nullable=True,
        ),
        # Unique constraint: only one relationship per dataset pair
        sa.UniqueConstraint(
            "source_dataset_id",
            "target_dataset_id",
            name="uq_dataset_relationship",
        ),
    )

    # Performance indexes for dataset_relationships
    op.create_index(
        "ix_dataset_relationships_source_id",
        "dataset_relationships",
        ["source_dataset_id"],
    )
    op.create_index(
        "ix_dataset_relationships_target_id",
        "dataset_relationships",
        ["target_dataset_id"],
    )
    op.create_index(
        "ix_dataset_relationships_is_active",
        "dataset_relationships",
        ["is_active"],
    )

    # ------------------------------------------------------------------
    # Table: dataset_relationship_columns
    # Column pair mappings within a dataset relationship (join keys).
    # ------------------------------------------------------------------
    op.create_table(
        "dataset_relationship_columns",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "relationship_id",
            sa.Integer(),
            sa.ForeignKey("dataset_relationships.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Column mapping
        sa.Column("source_column_name", sa.String(length=256), nullable=False),
        sa.Column("target_column_name", sa.String(length=256), nullable=False),
        # Operator for join condition (default '=')
        sa.Column(
            "operator",
            sa.String(length=10),
            nullable=False,
            server_default="=",
        ),
        # Order of this column pair in multi-column joins
        sa.Column(
            "ordinal",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        # Audit columns (AuditMixinNullable pattern)
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column(
            "created_by_fk",
            sa.Integer(),
            sa.ForeignKey("ab_user.id"),
            nullable=True,
        ),
        sa.Column(
            "changed_by_fk",
            sa.Integer(),
            sa.ForeignKey("ab_user.id"),
            nullable=True,
        ),
        # Unique constraint: one mapping per (relationship, source, target) triple
        sa.UniqueConstraint(
            "relationship_id",
            "source_column_name",
            "target_column_name",
            name="uq_rel_column_pair",
        ),
    )

    # Performance index for relationship_columns lookup
    op.create_index(
        "ix_rel_columns_relationship_id",
        "dataset_relationship_columns",
        ["relationship_id"],
    )


def downgrade() -> None:
    # Drop child table first (foreign key dependency)
    op.drop_index("ix_rel_columns_relationship_id", table_name="dataset_relationship_columns")
    op.drop_table("dataset_relationship_columns")

    # Drop parent table
    op.drop_index("ix_dataset_relationships_is_active", table_name="dataset_relationships")
    op.drop_index("ix_dataset_relationships_target_id", table_name="dataset_relationships")
    op.drop_index("ix_dataset_relationships_source_id", table_name="dataset_relationships")
    op.drop_table("dataset_relationships")
