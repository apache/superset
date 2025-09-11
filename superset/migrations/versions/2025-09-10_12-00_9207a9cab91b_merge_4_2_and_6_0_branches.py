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
"""merge_4_2_and_6_0_branches

Revision ID: 9207a9cab91b
Revises: 8c5432bb4823, 363a9b1e8992
Create Date: 2025-09-10 12:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "9207a9cab91b"
down_revision = ("8c5432bb4823", "363a9b1e8992")


def upgrade():
    # This is a merge migration - no schema changes needed
    # The purpose is to merge the 4.2-release and 6.0 migration branches:
    # - 4.2-release branch: 8c5432bb4823 (currency conversion)
    # - 6.0 branch: 363a9b1e8992 (includes d482d51c15ca in its lineage)
    # This preserves migration history for all database variants
    pass


def downgrade():
    # No schema changes to revert
    pass
