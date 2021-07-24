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
"""Delete table_name unique constraint in mysql

Revision ID: 18532d70ab98
Revises: 3fbbc6e8d654
Create Date: 2020-09-25 10:56:13.711182

"""

# revision identifiers, used by Alembic.
revision = "18532d70ab98"
down_revision = "3fbbc6e8d654"

from alembic import op
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.engine.reflection import Inspector

from superset.utils.core import generic_find_uq_constraint_name


def upgrade():
    bind = op.get_bind()

    # Uniqueness constraint if present only exists in MySQL.
    if isinstance(bind.dialect, MySQLDialect):
        constraint_name = generic_find_uq_constraint_name(
            "tables", {"table_name"}, Inspector.from_engine(bind)
        )

        if constraint_name:
            op.drop_constraint(constraint_name, "tables", type_="unique")


def downgrade():
    pass
