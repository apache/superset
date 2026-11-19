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
"""Add canvas_id to logs.

The ``logs`` table carries an integer column per object kind a request can
touch, so an event can be attributed without parsing ``logs.json``. Canvas had
no such column, which left every canvas event with ``dashboard_id`` and
``slice_id`` both null and made canvas activity unqueryable.

Nullable, no foreign key and no index, matching ``dashboard_id`` and
``slice_id`` as added in ``430039611635_log_more``. ``logs`` is append-heavy and
the queries this column exists for aggregate across all of it, so an index
would be paid for on every write without being used by the read.

Revision ID: c4a7e9d21f08
Revises: bf1a95a43c2d
Create Date: 2026-11-17 10:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns

revision = "c4a7e9d21f08"
down_revision = "bf1a95a43c2d"

TABLE = "logs"
COLUMN = "canvas_id"


def upgrade():
    add_columns(TABLE, sa.Column(COLUMN, sa.Integer(), nullable=True))


def downgrade():
    drop_columns(TABLE, COLUMN)
