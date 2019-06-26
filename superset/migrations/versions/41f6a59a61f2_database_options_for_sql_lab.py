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
"""database options for sql lab

Revision ID: 41f6a59a61f2
Revises: 3c3ffe173e4f
Create Date: 2016-08-31 10:26:37.969107

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "41f6a59a61f2"
down_revision = "3c3ffe173e4f"


def upgrade():
    op.add_column("dbs", sa.Column("allow_ctas", sa.Boolean(), nullable=True))
    op.add_column("dbs", sa.Column("expose_in_sqllab", sa.Boolean(), nullable=True))
    op.add_column(
        "dbs", sa.Column("force_ctas_schema", sa.String(length=250), nullable=True)
    )


def downgrade():
    op.drop_column("dbs", "force_ctas_schema")
    op.drop_column("dbs", "expose_in_sqllab")
    op.drop_column("dbs", "allow_ctas")
