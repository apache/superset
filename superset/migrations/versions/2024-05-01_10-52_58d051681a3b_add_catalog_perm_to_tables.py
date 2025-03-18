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
"""Add catalog_perm to tables

Revision ID: 58d051681a3b
Revises: 4a33124c18ad
Create Date: 2024-05-01 10:52:31.458433

"""

import sqlalchemy as sa

from superset.migrations.shared.catalogs import (
    downgrade_catalog_perms,
    upgrade_catalog_perms,
)
from superset.migrations.shared.utils import add_columns, drop_columns

# revision identifiers, used by Alembic.
revision = "58d051681a3b"
down_revision = "4a33124c18ad"


def upgrade():
    add_columns(
        "tables", sa.Column("catalog_perm", sa.String(length=1000), nullable=True)
    )
    add_columns(
        "slices", sa.Column("catalog_perm", sa.String(length=1000), nullable=True)
    )
    upgrade_catalog_perms(engines={"postgresql"})


def downgrade():
    downgrade_catalog_perms(engines={"postgresql"})
    drop_columns("slices", "catalog_perm")
    drop_columns("tables", "catalog_perm")
