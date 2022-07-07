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
"""update datasources

Revision ID: 937d04c16b64
Revises: d94d33dbe938
Create Date: 2018-07-20 16:08:10.195843

"""

# revision identifiers, used by Alembic.
revision = "937d04c16b64"
down_revision = "d94d33dbe938"

import sqlalchemy as sa
from alembic import op


def upgrade():

    # Enforce that the datasource_name column be non-nullable.
    with op.batch_alter_table("datasources") as batch_op:
        batch_op.alter_column(
            "datasource_name", existing_type=sa.String(255), nullable=False
        )


def downgrade():

    # Forego that the datasource_name column be non-nullable.
    with op.batch_alter_table("datasources") as batch_op:
        batch_op.alter_column(
            "datasource_name", existing_type=sa.String(255), nullable=True
        )
