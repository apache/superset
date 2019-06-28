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
"""empty message

Revision ID: 979c03af3341
Revises: ('db527d8c4c78', 'ea033256294a')
Create Date: 2017-03-21 15:41:34.383808

"""

# revision identifiers, used by Alembic.
revision = "979c03af3341"
down_revision = ("db527d8c4c78", "ea033256294a")

from alembic import op
import sqlalchemy as sa


def upgrade():
    pass


def downgrade():
    pass
