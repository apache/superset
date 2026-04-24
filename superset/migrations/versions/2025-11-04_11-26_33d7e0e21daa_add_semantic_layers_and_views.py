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
"""add_semantic_layers_and_views

Revision ID: 33d7e0e21daa
Revises: ce6bd21901ab
Create Date: 2025-11-04 11:26:00.000000

"""

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType
from sqlalchemy_utils.types.json import JSONType

from superset.extensions import encrypted_field_factory
from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "33d7e0e21daa"
down_revision = "ce6bd21901ab"


def upgrade() -> None:
    # Create semantic_layers table
    create_table(
        "semantic_layers",
        sa.Column("uuid", UUIDType(binary=True), default=uuid.uuid4, nullable=False),
        # created_on and changed_on are nullable=True to match AuditMixinNullable
        sa.Column("created_on", sa.DateTime(), nullable=False),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=250), nullable=False),
        sa.Column(
            "configuration",
            encrypted_field_factory.create(JSONType),
            nullable=True,
        ),
        # configuration_version tracks the schema version of the configuration
        # JSON field to aid with migrations as the schema evolves over time.
        sa.Column(
            "configuration_version",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
        sa.Column("cache_timeout", sa.Integer(), nullable=True),
        sa.Column("perm", sa.String(length=1000), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("uuid"),
    )

    # Create foreign key constraints for semantic_layers
    create_fks_for_table(
        "fk_semantic_layers_created_by_fk_ab_user",
        "semantic_layers",
        "ab_user",
        ["created_by_fk"],
        ["id"],
    )

    create_fks_for_table(
        "fk_semantic_layers_changed_by_fk_ab_user",
        "semantic_layers",
        "ab_user",
        ["changed_by_fk"],
        ["id"],
    )

    # Create semantic_views table.
    # The integer `id` is the primary key (auto-increment across all supported
    # databases) and `uuid` is a secondary unique identifier. This follows the
    # standard Superset model pattern and avoids using sa.Identity(), which is
    # not supported in MySQL or SQLite.
    create_table(
        "semantic_views",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("uuid", UUIDType(binary=True), default=uuid.uuid4, nullable=False),
        # created_on and changed_on are nullable=True to match AuditMixinNullable
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "configuration",
            encrypted_field_factory.create(JSONType),
            nullable=True,
        ),
        # configuration_version tracks the schema version of the configuration
        # JSON field to aid with migrations as the schema evolves over time.
        sa.Column(
            "configuration_version",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
        sa.Column("cache_timeout", sa.Integer(), nullable=True),
        sa.Column(
            "semantic_layer_uuid",
            UUIDType(binary=True),
            sa.ForeignKey("semantic_layers.uuid", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )

    # Create foreign key constraints for semantic_views
    create_fks_for_table(
        "fk_semantic_views_created_by_fk_ab_user",
        "semantic_views",
        "ab_user",
        ["created_by_fk"],
        ["id"],
    )

    create_fks_for_table(
        "fk_semantic_views_changed_by_fk_ab_user",
        "semantic_views",
        "ab_user",
        ["changed_by_fk"],
        ["id"],
    )

    # Update chart datasource constraint to allow semantic_view
    with op.batch_alter_table("slices") as batch_op:
        batch_op.drop_constraint("ck_chart_datasource", type_="check")
        batch_op.create_check_constraint(
            "ck_chart_datasource",
            "datasource_type in ('table', 'semantic_view')",
        )


def downgrade() -> None:
    # Restore original constraint
    with op.batch_alter_table("slices") as batch_op:
        batch_op.drop_constraint("ck_chart_datasource", type_="check")
        batch_op.create_check_constraint(
            "ck_chart_datasource", "datasource_type in ('table')"
        )

    drop_table("semantic_views")
    drop_table("semantic_layers")
