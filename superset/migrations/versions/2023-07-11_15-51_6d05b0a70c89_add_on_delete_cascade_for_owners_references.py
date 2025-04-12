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
"""add on delete cascade for owners references

Revision ID: 6d05b0a70c89
Revises: f92a3124dd66
Create Date: 2023-07-11 15:51:57.964635

"""

# revision identifiers, used by Alembic.
revision = "6d05b0a70c89"
down_revision = "f92a3124dd66"

from superset.migrations.shared.constraints import ForeignKey, redefine  # noqa: E402

foreign_keys = [
    ForeignKey(
        table="dashboard_user",
        referent_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
    ),
    ForeignKey(
        table="dashboard_user",
        referent_table="dashboards",
        local_cols=["dashboard_id"],
        remote_cols=["id"],
    ),
    ForeignKey(
        table="report_schedule_user",
        referent_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
    ),
    ForeignKey(
        table="report_schedule_user",
        referent_table="report_schedule",
        local_cols=["report_schedule_id"],
        remote_cols=["id"],
    ),
    ForeignKey(
        table="slice_user",
        referent_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
    ),
    ForeignKey(
        table="slice_user",
        referent_table="slices",
        local_cols=["slice_id"],
        remote_cols=["id"],
    ),
]


def upgrade():
    for foreign_key in foreign_keys:
        redefine(foreign_key, on_delete="CASCADE")


def downgrade():
    for foreign_key in foreign_keys:
        redefine(foreign_key)
