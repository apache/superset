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
"""change_owner_to_m2m_relation_on_datasources.py

Revision ID: fe656ab8e651
Revises: e66350340759
Create Date: 2019-04-04 20:01:53.964275

"""

# revision identifiers, used by Alembic.
revision = 'fe656ab8e651'
down_revision = 'e66350340759'

from superset import db
from superset.utils.core import generic_find_fk_constraint_name

from alembic import op
import sqlalchemy as sa

def upgrade():
    pass


def downgrade():
    pass
