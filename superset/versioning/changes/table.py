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
"""Schema definition for ``version_changes``.

Declared against the shared ``Model.metadata`` so integration tests
that build schema via ``metadata.create_all()`` pick it up without the
Alembic migration running. Mirrors the shape of the
``56cd24c07170_add_versioning_tables`` migration byte-for-byte. Typed
columns (``sa.JSON`` for path / values) are required so the
connection's bulk-insert path marshals Python lists/dicts into JSON —
a lightweight ``sa.table(...)`` would not carry the type info and
SQLite's driver would reject the ``list`` as an unsupported bind.

The schema lives in its own module to keep the listener and the
shadow-table-query helpers free of schema-construction boilerplate at
import time.
"""

from __future__ import annotations

import sqlalchemy as sa
from flask_appbuilder import Model

_metadata = Model.metadata  # pylint: disable=no-member

version_changes_table = sa.Table(
    "version_changes",
    _metadata,
    sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
    # ``transaction_id`` references ``version_transaction.id`` at the DB
    # level only — the FK + ON DELETE CASCADE live in the Alembic
    # migration. Declaring the FK here would fail to resolve at Table
    # creation time because ``version_transaction`` is built
    # dynamically by SQLAlchemy-Continuum at mapper-configuration time;
    # integration tests that materialise schema via ``metadata.create_all``
    # before Continuum runs would hit ``NoReferencedTableError``. Same
    # pattern as the other versioning tables.
    sa.Column("transaction_id", sa.BigInteger, nullable=False),
    sa.Column("entity_kind", sa.String(32), nullable=False),
    sa.Column("entity_id", sa.Integer, nullable=False),
    # Integer, not SmallInteger: matches the migration — per-entity
    # sequence within a transaction is assigned by unbounded enumerate().
    sa.Column("sequence", sa.Integer, nullable=False),
    sa.Column("kind", sa.String(32), nullable=False),
    sa.Column("operation", sa.String(16), nullable=False),
    sa.Column("path", sa.JSON, nullable=False),
    sa.Column("from_value", sa.JSON, nullable=True),
    sa.Column("to_value", sa.JSON, nullable=True),
    sa.UniqueConstraint(
        "transaction_id",
        "entity_kind",
        "entity_id",
        "sequence",
        name="uq_version_changes_tx_entity_sequence",
    ),
    sa.Index("ix_version_changes_kind", "kind"),
    # No standalone transaction_id index: the UNIQUE constraint above
    # leads with transaction_id, so its backing index already serves
    # transaction_id-prefix lookups on every dialect.
    # Extends to transaction_id so the activity read's
    # (entity_kind = ? AND entity_id IN (...) AND transaction_id >= ?)
    # filter is index-served. Mirrors the migration byte-for-byte.
    sa.Index("ix_version_changes_entity", "entity_kind", "entity_id", "transaction_id"),
    extend_existing=True,
)

# Mapping from Python class name to the ``entity_kind`` value written
# to ``version_changes.entity_kind``. The API filters change records
# by this value (``WHERE entity_kind = 'chart'`` for the chart history
# endpoint, etc.) — kept short and user-facing-ish so downstream tools
# consuming the raw table read sensibly.
ENTITY_KIND_BY_CLASS_NAME: dict[str, str] = {
    "Slice": "chart",
    "Dashboard": "dashboard",
    "SqlaTable": "dataset",
}
