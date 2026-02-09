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
Revises: 9787190b3d89
Create Date: 2025-11-04 11:26:00.000000

"""

import uuid

import sqlalchemy as sa
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
down_revision = "9787190b3d89"


def upgrade():
    # Create semantic_layers table
    create_table(
        "semantic_layers",
        sa.Column("uuid", UUIDType(binary=True), default=uuid.uuid4, nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=250), nullable=False),
        sa.Column(
            "configuration",
            encrypted_field_factory.create(JSONType),
            nullable=True,
        ),
        sa.Column("cache_timeout", sa.Integer(), nullable=True),
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

    # Create semantic_views table
    create_table(
        "semantic_views",
        sa.Column("uuid", UUIDType(binary=True), default=uuid.uuid4, nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "configuration",
            encrypted_field_factory.create(JSONType),
            nullable=True,
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
        sa.PrimaryKeyConstraint("uuid"),
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


def downgrade():
    drop_table("semantic_views")
    drop_table("semantic_layers")
