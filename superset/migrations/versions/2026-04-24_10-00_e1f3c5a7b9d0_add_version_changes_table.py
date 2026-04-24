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
"""add_version_changes_table

Creates ``version_changes``, a field-level diff log keyed to a
(transaction, entity) pair. Each row describes one atomic change
(one field or one child-collection element) that occurred to one
entity during a save. Phase-2 UI will render these rows into
human-readable summaries via the frontend translator.

Shape:

    (id, transaction_id, entity_kind, entity_id,
     sequence, kind, path, from_value, to_value)

- ``transaction_id`` joins to ``version_transaction`` with ON DELETE
  CASCADE so retention pruning of a version row drops its change
  records automatically.
- ``entity_kind`` identifies which model type the record is about
  (``"chart"`` / ``"dashboard"`` / ``"dataset"``). Required because
  a single Continuum transaction can touch more than one versioned
  entity (import pipelines, bulk operations, fixture loads), and the
  API needs to filter a given entity's records precisely.
- ``entity_id`` is the entity's primary key — joins to ``slices.id``
  / ``dashboards.id`` / ``tables.id`` depending on ``entity_kind``.
- ``sequence`` orders records within one ``(transaction, entity)``
  triple — deterministic replay is ``set(state, path, to_value)`` in
  ascending sequence.
- ``kind`` is indexed for the Phase-2 "filter history by change type"
  query (``WHERE kind = 'filter'``).
- ``path``, ``from_value``, ``to_value`` are JSON because they are
  inherently structured (arrays of segments, scalar or object values).

See spec FR-016..FR-021 and data-model.md §``version_changes``.

Revision ID: e1f3c5a7b9d0
Revises: d8e9f0a1b2c3
Create Date: 2026-04-24 10:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e1f3c5a7b9d0"
down_revision = "d8e9f0a1b2c3"


def upgrade() -> None:
    op.create_table(
        "version_changes",
        sa.Column(
            "id",
            sa.BigInteger(),
            primary_key=True,
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "transaction_id",
            sa.BigInteger(),
            sa.ForeignKey("version_transaction.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "entity_kind",
            sa.String(length=32),
            nullable=False,
        ),
        sa.Column(
            "entity_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "sequence",
            sa.SmallInteger(),
            nullable=False,
        ),
        sa.Column(
            "kind",
            sa.String(length=32),
            nullable=False,
        ),
        sa.Column("path", sa.JSON(), nullable=False),
        sa.Column("from_value", sa.JSON(), nullable=True),
        sa.Column("to_value", sa.JSON(), nullable=True),
        sa.UniqueConstraint(
            "transaction_id",
            "entity_kind",
            "entity_id",
            "sequence",
            name="uq_version_changes_tx_entity_sequence",
        ),
    )
    op.create_index(
        "ix_version_changes_kind",
        "version_changes",
        ["kind"],
    )
    op.create_index(
        "ix_version_changes_transaction_id",
        "version_changes",
        ["transaction_id"],
    )
    op.create_index(
        "ix_version_changes_entity",
        "version_changes",
        ["entity_kind", "entity_id"],
    )


def downgrade() -> None:
    op.drop_table("version_changes")
