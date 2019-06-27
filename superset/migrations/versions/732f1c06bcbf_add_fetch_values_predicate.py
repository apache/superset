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
"""add fetch values predicate

Revision ID: 732f1c06bcbf
Revises: d6db5a5cdb5d
Create Date: 2017-03-03 09:15:56.800930

"""

# revision identifiers, used by Alembic.
revision = "732f1c06bcbf"
down_revision = "d6db5a5cdb5d"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column(
        "datasources",
        sa.Column("fetch_values_from", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "tables",
        sa.Column("fetch_values_predicate", sa.String(length=1000), nullable=True),
    )


def downgrade():
    op.drop_column("tables", "fetch_values_predicate")
    op.drop_column("datasources", "fetch_values_from")
