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
Revises: 48cbb571fa3a
Create Date: 2024-07-19 16:11:26.740368
"""

import logging

from alembic import op
from migration_utils import create_unique_constraint, drop_unique_constraint
from sqlalchemy.engine.reflection import Inspector

from superset.utils.core import generic_find_uq_constraint_name

# revision identifiers, used by Alembic.
revision = "df3d7e2eb9a4"
down_revision = "48cbb571fa3a"

logger = logging.getLogger(__name__)


def upgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)

    # Unfortunately the DB migration that creates this constraint has a
    # try/except block, so that we can't know for sure if the constraint exists.
    if constraint_name := generic_find_uq_constraint_name(
        "tables",
        ["database_id", "schema", "table_name"],
        inspector,
    ):
        drop_unique_constraint(op, constraint_name, "tables")


def downgrade():
    create_unique_constraint(
        op,
        "_customer_location_uc",
        "tables",
        ["database_id", "schema", "table_name"],
    )
