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
"""Add canvases.

Creates ``canvases`` (a canvas and its definition), ``canvas_editors`` and
``canvas_viewers`` (sharing, like dashboards), and ``canvas_ops`` (the log of
applied definition operations per revision).

Revision ID: 6d55f8a0851e
Revises: 95d8a99c822e
Create Date: 2026-09-30 12:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import create_table, drop_table
from superset.utils.core import MediumText

revision = "6d55f8a0851e"
down_revision = "95d8a99c822e"


def _subject_table(name: str) -> None:
    create_table(
        name,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.Column("canvas_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["subject_id"],
            ["subjects.id"],
            name=f"fk_{name}_subject_id_subjects",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["canvas_id"],
            ["canvases.id"],
            name=f"fk_{name}_canvas_id_canvases",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("subject_id", "canvas_id", name=f"uq_{name}"),
    )


def upgrade() -> None:
    create_table(
        "canvases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("definition", MediumText(), nullable=False),
        sa.Column("definition_version", sa.Integer(), nullable=False),
        sa.Column("revision", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by_fk"], ["ab_user.id"], name="fk_canvases_created_by_fk_ab_user"
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"], ["ab_user.id"], name="fk_canvases_changed_by_fk_ab_user"
        ),
        sa.UniqueConstraint("uuid", name="uq_canvases_uuid"),
    )
    _subject_table("canvas_editors")
    _subject_table("canvas_viewers")
    create_table(
        "canvas_ops",
        sa.Column(
            "id",
            sa.BigInteger().with_variant(sa.Integer(), "sqlite"),
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column("canvas_id", sa.Integer(), nullable=False),
        sa.Column("revision", sa.BigInteger(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("op", sa.Text(), nullable=False),
        sa.Column("touched", sa.Text(), nullable=False),
        sa.Column("created_on", sa.DateTime(), nullable=False),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["canvas_id"],
            ["canvases.id"],
            name="fk_canvas_ops_canvas_id_canvases",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"],
            ["ab_user.id"],
            name="fk_canvas_ops_created_by_fk_ab_user",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint(
            "canvas_id",
            "revision",
            "sequence",
            name="uq_canvas_ops_revision_sequence",
        ),
    )


def downgrade() -> None:
    drop_table("canvas_ops")
    drop_table("canvas_viewers")
    drop_table("canvas_editors")
    drop_table("canvases")
