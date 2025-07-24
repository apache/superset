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
"""drop tables constraint

Revision ID: 31b2a1039d4a
Revises: ae1ed299413b
Create Date: 2021-07-27 08:25:20.755453

"""

from alembic import op
from sqlalchemy import engine

from superset.utils.core import generic_find_uq_constraint_name

# revision identifiers, used by Alembic.
revision = "31b2a1039d4a"
down_revision = "ae1ed299413b"

conv = {"uq": "uq_%(table_name)s_%(column_0_name)s"}


def upgrade():
    bind = op.get_bind()
    insp = engine.reflection.Inspector.from_engine(bind)

    # Drop the uniqueness constraint if it exists.

    if constraint := generic_find_uq_constraint_name("tables", {"table_name"}, insp):
        with op.batch_alter_table("tables", naming_convention=conv) as batch_op:
            batch_op.drop_constraint(constraint, type_="unique")


def downgrade():
    # One cannot simply re-add the uniqueness constraint as it may not have previously
    # existed.
    pass
