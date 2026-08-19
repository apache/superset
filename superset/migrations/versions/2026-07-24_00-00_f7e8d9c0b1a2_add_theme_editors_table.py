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
"""add theme_editors table

Revision ID: f7e8d9c0b1a2
Revises: e5f6a7b8c9d0
Create Date: 2026-07-24 00:00:00.000000

"""

from alembic import op
from sqlalchemy import (
    Boolean,
    Column,
    column as sa_column,
    Integer,
    select,
    table as sa_table,
    UniqueConstraint,
)

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "f7e8d9c0b1a2"
down_revision = "1072de5ed955"

SUBJECTS_TABLE = "subjects"
THEME_EDITORS = "theme_editors"

# Subject.type value for USER-type subjects (see the subjects migration seed).
SUBJECT_TYPE_USER = 1


def _create_junction_table(
    table_name: str, resource_col: str, resource_table: str
) -> None:
    create_table(
        table_name,
        Column("id", Integer, primary_key=True),
        Column("subject_id", Integer, nullable=False),
        Column(resource_col, Integer, nullable=False),
        UniqueConstraint("subject_id", resource_col),
    )
    create_fks_for_table(
        foreign_key_name=f"fk_{table_name}_subject_id_subjects",
        table_name=table_name,
        referenced_table=SUBJECTS_TABLE,
        local_cols=["subject_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name=f"fk_{table_name}_{resource_col}_{resource_table}",
        table_name=table_name,
        referenced_table=resource_table,
        local_cols=[resource_col],
        remote_cols=["id"],
        ondelete="CASCADE",
    )


def _backfill_theme_creators_as_editors() -> None:
    """Seed each non-system theme's creator as an editor.

    An empty editors list means admin-only, so without this backfill an upgrade
    would strip edit access from every existing non-system theme's author (OSS
    allows non-admins to author themes). For each non-system theme that has a
    creator, insert a ``(theme_id, subject_id)`` row pointing at that user's
    USER-type Subject.

    System themes stay admin-only, themes with a NULL creator are skipped, and a
    creator without a USER Subject is skipped by the join (no crash). Works on
    sqlite/postgres/mysql via a single SELECT..INSERT.
    """
    conn = op.get_bind()

    themes = sa_table(
        "themes",
        sa_column("id", Integer),
        sa_column("is_system", Boolean),
        sa_column("created_by_fk", Integer),
    )
    subjects = sa_table(
        "subjects",
        sa_column("id", Integer),
        sa_column("user_id", Integer),
        sa_column("type", Integer),
    )
    theme_editors = sa_table(
        "theme_editors",
        sa_column("subject_id", Integer),
        sa_column("theme_id", Integer),
    )

    creator_editors = (
        select(themes.c.id, subjects.c.id)
        .select_from(
            themes.join(
                subjects,
                (subjects.c.user_id == themes.c.created_by_fk)
                & (subjects.c.type == SUBJECT_TYPE_USER),
            )
        )
        .where(~themes.c.is_system)
        .where(themes.c.created_by_fk.isnot(None))
        .distinct()
    )
    conn.execute(
        theme_editors.insert().from_select(["theme_id", "subject_id"], creator_editors)
    )


def upgrade() -> None:
    _create_junction_table(THEME_EDITORS, "theme_id", "themes")
    # Preserve edit access for existing themes: backfill each non-system theme's
    # creator as an editor (system themes remain admin-only).
    _backfill_theme_creators_as_editors()


def downgrade() -> None:
    # Dropping the table removes the backfilled rows, so there is nothing else
    # to undo.
    drop_table(THEME_EDITORS)
