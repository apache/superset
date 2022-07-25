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
"""Migrating legacy TreeMap

Revision ID: c747c78868b6
Revises: cdcf3d64daf4
Create Date: 2022-06-30 22:04:17.686635

"""
from superset.migrations.shared.migrate_viz import MigrateTreeMap

# revision identifiers, used by Alembic.
revision = "c747c78868b6"
down_revision = "cdcf3d64daf4"


def upgrade():
    MigrateTreeMap.upgrade()


def downgrade():
    MigrateTreeMap.downgrade()
