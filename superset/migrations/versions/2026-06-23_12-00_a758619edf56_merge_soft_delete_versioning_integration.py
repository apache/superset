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
"""merge soft delete and versioning integration

Joins the parallel soft-delete (slices/dashboards/datasets), versioning, and
upstream master heads into a single revision so the deletion-retention purge
migration can build on a unified base.

Revision ID: a758619edf56
Revises: a7d3f1b9c2e4, c233f5365c9e, 7c4a8d09ca37, 9e1f3b8c4d2a, 3a8e6f2c1b95, d3b9a1f6c204
Create Date: 2026-06-23 12:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "a758619edf56"
down_revision = (
    "a7d3f1b9c2e4",
    "c233f5365c9e",
    "7c4a8d09ca37",
    "9e1f3b8c4d2a",
    "3a8e6f2c1b95",
    "d3b9a1f6c204",
)


def upgrade():
    pass


def downgrade():
    pass
