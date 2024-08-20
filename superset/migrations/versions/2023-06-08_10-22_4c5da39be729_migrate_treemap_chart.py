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
"""migrate_treemap_chart

Revision ID: 4c5da39be729
Revises: 9ba2ce3086e5
Create Date: 2023-06-08 10:22:23.192064

"""

from alembic import op
from sqlalchemy.dialects.mysql.base import MySQLDialect

from superset import db
from superset.migrations.shared.migrate_viz import MigrateTreeMap

# revision identifiers, used by Alembic.
revision = "4c5da39be729"
down_revision = "9ba2ce3086e5"


def upgrade():
    bind = op.get_bind()

    # Ensure `slice.params` and `slice.query_context`` in MySQL is MEDIUMTEXT
    # before migration, as the migration will save a duplicate form_data backup
    # which may significantly increase the size of these fields.
    if isinstance(bind.dialect, MySQLDialect):
        # If the columns are already MEDIUMTEXT, this is a no-op
        op.execute("ALTER TABLE slices MODIFY params MEDIUMTEXT")
        op.execute("ALTER TABLE slices MODIFY query_context MEDIUMTEXT")

    session = db.Session(bind=bind)
    MigrateTreeMap.upgrade(session)


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    MigrateTreeMap.downgrade(session)
