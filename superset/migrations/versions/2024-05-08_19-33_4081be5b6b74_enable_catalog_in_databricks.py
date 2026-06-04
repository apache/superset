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
"""Enable catalog in Databricks

Revision ID: 4081be5b6b74
Revises: 645bb206f96c
Create Date: 2024-05-08 19:33:18.311411

"""

from superset.migrations.shared.catalogs import (
    downgrade_catalog_perms,
    upgrade_catalog_perms,
)

# revision identifiers, used by Alembic.
revision = "4081be5b6b74"
down_revision = "645bb206f96c"


def upgrade():
    upgrade_catalog_perms(engines={"databricks"})


def downgrade():
    downgrade_catalog_perms(engines={"databricks"})
