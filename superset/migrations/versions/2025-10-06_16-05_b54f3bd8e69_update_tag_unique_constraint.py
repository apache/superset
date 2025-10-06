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

from alembic import op

# revision identifiers, used by Alembic.
revision = "b54f3bd8e69"
down_revision = "c233f5365c9e"


def upgrade():
    """
    Change tag unique constraint from name only to (name, type) composite.
    This allows the same tag name to exist with different types (e.g., 'type:dashboard'
    can be both a system tag with type='type' and a custom tag with type='custom').
    """
    try:
        # Drop the old unique constraint on name only
        op.drop_constraint("tag_name_key", "tag", type_="unique")

        # Create new composite unique constraint on (name, type)
        op.create_unique_constraint("uix_tag_name_type", "tag", ["name", "type"])
    except Exception:  # noqa: S110
        # SQLite doesn't support constraint operations well
        pass


def downgrade():
    """
    Revert to name-only unique constraint.
    Note: This may fail if there are duplicate names with different types.
    """
    try:
        # Drop the composite unique constraint
        op.drop_constraint("uix_tag_name_type", "tag", type_="unique")

        # Recreate the old unique constraint on name only
        op.create_unique_constraint("tag_name_key", "tag", ["name"])
    except Exception:  # noqa: S110
        # SQLite doesn't support constraint operations well
        pass
