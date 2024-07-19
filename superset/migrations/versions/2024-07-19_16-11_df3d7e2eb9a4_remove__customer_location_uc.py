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
"""
Remove _customer_location_uc

Revision ID: df3d7e2eb9a4
Revises: 02f4f7811799
Create Date: 2024-07-19 16:11:26.740368
"""

import logging

from alembic import op
from migration_utils import create_unique_constraint, drop_unique_constraint

# revision identifiers, used by Alembic.
revision = "df3d7e2eb9a4"
down_revision = "02f4f7811799"

logger = logging.getLogger(__name__)


def upgrade():
    try:
        drop_unique_constraint(op, "_customer_location_uc", "tables")
    except Exception:  # pylint: disable=broad-except
        # Unfortunately the DB migration that creates this constraint has a
        # try/except block, so that we can't know for sure if the constraint exists.
        logger.warning(
            "Error dropping constraint, This is expected for certain databases like "
            "SQLite and MySQL"
        )


def downgrade():
    create_unique_constraint(
        op,
        "_customer_location_uc",
        "tables",
        ["database_id", "schema", "table_name"],
    )
