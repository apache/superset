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
"""testing performance

Revision ID: b47bb0d9fddb
Revises: 6f139c533bea
Create Date: 2022-05-24 17:48:22.786769

"""

# revision identifiers, used by Alembic.
from superset.models.sql_lab import Query
from sqlalchemy.dialects import postgresql
import sqlalchemy as sa
from alembic import op
from superset import db
revision = 'b47bb0d9fddb'
down_revision = '6f139c533bea'


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    count_query = session.query(Query).with_entities(sa.func.count(Query.id))
    count = count_query.scalar()
    print(f"COUNTCOUNT {count}")


def downgrade():
    pass
