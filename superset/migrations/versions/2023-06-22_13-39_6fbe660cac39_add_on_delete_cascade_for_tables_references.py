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
"""add on delete cascade for tables references

Revision ID: 6fbe660cac39
Revises: 90139bf715e4
Create Date: 2023-06-22 13:39:47.989373

"""

# revision identifiers, used by Alembic.
revision = "6fbe660cac39"
down_revision = "90139bf715e4"

from superset.migrations.shared.constraints import ForeignKey, redefine  # noqa: E402

foreign_keys = [
    ForeignKey(
        table="sql_metrics",
        referent_table="tables",
        local_cols=["table_id"],
        remote_cols=["id"],
    ),
    ForeignKey(
        table="table_columns",
        referent_table="tables",
        local_cols=["table_id"],
        remote_cols=["id"],
    ),
    ForeignKey(
        table="sqlatable_user",
        referent_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
    ),
    ForeignKey(
        table="sqlatable_user",
        referent_table="tables",
        local_cols=["table_id"],
        remote_cols=["id"],
    ),
]


def upgrade():
    for foreign_key in foreign_keys:
        redefine(foreign_key, on_delete="CASCADE")


def downgrade():
    for foreign_key in foreign_keys:
        redefine(foreign_key)
