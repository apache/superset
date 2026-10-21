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
"""add theme_editors.theme_id index

Revision ID: 00fab727cd0a
Revises: 884a2115ebd3
Create Date: 2026-09-16 00:01:00.000000

"""

from alembic import op
from sqlalchemy.dialects.mysql.base import MySQLDialect

from superset.migrations.shared.utils import create_index, drop_index

# revision identifiers, used by Alembic.
revision = "00fab727cd0a"
down_revision = "884a2115ebd3"

TABLE_NAME = "theme_editors"
INDEX_NAME = "ix_theme_editors_theme_id"


def _is_mysql() -> bool:
    return isinstance(op.get_bind().dialect, MySQLDialect)


def upgrade() -> None:
    """Add an index on theme_editors.theme_id."""
    # theme_editors' only index is the UNIQUE(subject_id, theme_id) constraint
    # from its creation (#42404), which leads with subject_id -- most engines
    # can't use a composite index to serve a lookup filtered on its trailing
    # column alone. Loading a theme's editor list filters on theme_id only,
    # so that's a table scan on every load without a dedicated index.
    #
    # MySQL is the exception: InnoDB auto-creates a single-column index on
    # theme_id to support the theme_id foreign key, so the lookup is already
    # indexed there and this index would just duplicate it.
    if _is_mysql():
        return
    create_index(TABLE_NAME, INDEX_NAME, ["theme_id"])


def downgrade() -> None:
    """Drop the theme_editors.theme_id index."""
    # Never created on MySQL (see upgrade()), and the FK's auto-generated
    # index must stay there or dropping it fails with MySQL error 1553.
    if _is_mysql():
        return
    drop_index(TABLE_NAME, INDEX_NAME)
