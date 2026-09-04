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
"""Migrating legacy Area

Revision ID: 06e1e70058c7
Revises: c747c78868b6
Create Date: 2022-06-13 14:17:51.872706

"""

from alembic import op

from superset import db
from superset.migrations.shared.migrate_viz import MigrateAreaChart

# revision identifiers, used by Alembic.
revision = "06e1e70058c7"
down_revision = "c747c78868b6"


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    MigrateAreaChart.upgrade(session)


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    MigrateAreaChart.downgrade(session)
