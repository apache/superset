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
"""drop_keyvalue_table

Revision ID: 8bddef7ba68d
Revises: 06dd9ff00fe8
Create Date: 2023-12-28 14:18:14.895436

"""

# revision identifiers, used by Alembic.
revision = "8bddef7ba68d"
down_revision = "06dd9ff00fe8"


from importlib import import_module

from sqlalchemy.dialects import postgresql

module = import_module(
    "superset.migrations.versions.2017-01-10_11-47_bcf3126872fc_add_keyvalue"
)


def upgrade():
    module.downgrade()


def downgrade():
    module.upgrade()
