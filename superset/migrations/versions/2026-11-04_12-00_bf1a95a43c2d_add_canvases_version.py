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
"""Add canvases_version.

The Continuum shadow table for ``canvases``, in the validity-strategy shape of
the other parent shadow tables (``56cd24c07170_add_versioning_tables``), with
the live-row index ``8f3a1b2c4d5e_shadow_live_row_indexes`` adds to them.

Revision ID: bf1a95a43c2d
Revises: e18dda53ce53
Create Date: 2026-11-04 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

from superset.utils.core import MediumText

revision = "bf1a95a43c2d"
down_revision = "e18dda53ce53"

TABLE = "canvases_version"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("uuid", UUIDType(binary=True), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("definition", MediumText(), nullable=True),
        sa.Column("definition_version", sa.Integer(), nullable=True),
        sa.Column("revision", sa.BigInteger(), nullable=True),
        sa.Column("slug", sa.String(255), nullable=True),
        sa.Column("css", MediumText(), nullable=True),
        sa.Column("theme_id", sa.Integer(), nullable=True),
        sa.Column("certified_by", sa.Text(), nullable=True),
        sa.Column("certification_details", sa.Text(), nullable=True),
        sa.Column("is_managed_externally", sa.Boolean(), nullable=True),
        sa.Column("external_url", sa.Text(), nullable=True),
        sa.Column("transaction_id", sa.BigInteger(), nullable=False),
        sa.Column("end_transaction_id", sa.BigInteger(), nullable=True),
        sa.Column("operation_type", sa.SmallInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id", "transaction_id"),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["version_transaction.id"],
            name=f"fk_{TABLE}_transaction_id",
        ),
        sa.ForeignKeyConstraint(
            ["end_transaction_id"],
            ["version_transaction.id"],
            name=f"fk_{TABLE}_end_transaction_id",
        ),
    )
    for column in ("end_transaction_id", "operation_type", "transaction_id"):
        op.create_index(f"ix_{TABLE}_{column}", TABLE, [column])

    # The "live row of entity X" lookup: a partial index where supported.
    dialect = op.get_bind().dialect.name
    live = sa.text("end_transaction_id IS NULL")
    if dialect == "postgresql":
        op.create_index(f"ix_{TABLE}_live_id", TABLE, ["id"], postgresql_where=live)
    elif dialect == "sqlite":
        op.create_index(f"ix_{TABLE}_live_id", TABLE, ["id"], sqlite_where=live)
    else:
        op.create_index(f"ix_{TABLE}_live_id", TABLE, ["id", "end_transaction_id"])


def downgrade() -> None:
    op.drop_table(TABLE)
