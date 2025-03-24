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
"""drop_url_table

Revision ID: e863403c0c50
Revises: 214f580d09c9
Create Date: 2023-12-28 16:03:31.691033

"""

# revision identifiers, used by Alembic.
revision = "e863403c0c50"
down_revision = "214f580d09c9"

from importlib import import_module  # noqa: E402

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402

module = import_module("superset.migrations.versions.2016-01-13_20-24_8e80a26a31db_")


def upgrade():
    module.downgrade()


def downgrade():
    module.upgrade()
    op.alter_column("url", "changed_on", existing_type=sa.DATETIME(), nullable=True)
    op.alter_column("url", "created_on", existing_type=sa.DATETIME(), nullable=True)
