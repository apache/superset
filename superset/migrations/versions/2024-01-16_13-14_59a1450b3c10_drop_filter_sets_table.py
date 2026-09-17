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
"""drop_filter_sets_table

Revision ID: 59a1450b3c10
Revises: 65a167d4c62e
Create Date: 2023-12-27 13:14:27.268232

"""

# revision identifiers, used by Alembic.
revision = "59a1450b3c10"
down_revision = "65a167d4c62e"

from importlib import import_module  # noqa: E402

module = import_module(
    "superset.migrations.versions.2021-03-29_11-15_3ebe0993c770_filterset_table"
)


def upgrade():
    module.downgrade()


def downgrade():
    module.upgrade()
