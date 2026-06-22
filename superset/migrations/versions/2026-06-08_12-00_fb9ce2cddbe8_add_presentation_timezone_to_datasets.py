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
"""Add presentation/source time zone to datasets

Adds two nullable columns on ``tables``: ``presentation_timezone`` (the
dataset's presentation zone) and ``source_timezone`` (the IANA zone the dataset's
naive temporal columns are stored in; treated as UTC when NULL). Both default
NULL, so the change is additive, inert, and reversible.

Revision ID: fb9ce2cddbe8
Revises: 78a40c08b4be
Create Date: 2026-06-08 12:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "fb9ce2cddbe8"
down_revision = "78a40c08b4be"


def upgrade():
    add_columns(
        "tables",
        sa.Column("presentation_timezone", sa.String(length=64), nullable=True),
        sa.Column("source_timezone", sa.String(length=64), nullable=True),
    )


def downgrade():
    drop_columns("tables", "source_timezone", "presentation_timezone")
