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
"""update_tag_unique_constraint

Revision ID: b54f3bd8e69
Revises: c233f5365c9e
Create Date: 2025-10-06 16:05:00.000000

"""

import enum

import migration_utils as utils
from alembic import op
from sqlalchemy import Column, Enum, Integer, MetaData, String, Table, Text
from sqlalchemy.sql import func, select

# revision identifiers, used by Alembic.
revision = "b54f3bd8e69"
down_revision = "c233f5365c9e"


class TagType(enum.Enum):
    # pylint: disable=invalid-name
    custom = 1
    type = 2
    owner = 3
    favorited_by = 4


# Define the tag table structure for data operations
metadata = MetaData()
tag_table = Table(
    "tag",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(250)),
    Column("type", Enum(TagType)),
    Column("description", Text),
)

old_constraint_name = "tag_name_key"
new_constraint_name = "uix_tag_name_type"
table_name = "tag"
new_constraint_columns = ["name", "type"]


def upgrade():
    """
    Change tag unique constraint from name only to (name, type) composite.
    This allows the same tag name to exist with different types (e.g., 'type:dashboard'
    can be both a system tag with type='type' and a custom tag with type='custom').
    """
    bind = op.get_bind()

    # Reflect the current database state to get existing tables
    metadata.reflect(bind=bind)

    # Delete duplicate tags if any, keeping the one with the lowest ID
    min_id_subquery = (
        select(
            [
                func.min(tag_table.c.id).label("min_id"),
                tag_table.c.name,
                tag_table.c.type,
            ]
        )
        .group_by(
            tag_table.c.name,
            tag_table.c.type,
        )
        .alias("min_ids")
    )

    delete_query = tag_table.delete().where(
        tag_table.c.id.notin_(select([min_id_subquery.c.min_id]))
    )

    bind.execute(delete_query)

    # Drop the old unique constraint on name only
    utils.drop_unique_constraint(op, old_constraint_name, table_name)

    # Create new composite unique constraint on (name, type)
    utils.create_unique_constraint(
        op, new_constraint_name, table_name, new_constraint_columns
    )


def downgrade():
    """
    Revert to name-only unique constraint.

    WARNING: This downgrade will fail if there are duplicate tag names with
    different types in the database. Before downgrading, ensure there are no
    tags with the same name but different types, or manually consolidate them.
    """
    # Drop the composite unique constraint
    utils.drop_unique_constraint(op, new_constraint_name, table_name)

    # Recreate the old unique constraint on name only
    utils.create_unique_constraint(op, old_constraint_name, table_name, ["name"])
