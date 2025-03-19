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
"""Adding metric warning_text

Revision ID: 19a814813610
Revises: ca69c70ec99b
Create Date: 2017-09-15 15:09:40.495345

"""

# revision identifiers, used by Alembic.
revision = "19a814813610"
down_revision = "ca69c70ec99b"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("metrics", sa.Column("warning_text", sa.Text(), nullable=True))
    op.add_column("sql_metrics", sa.Column("warning_text", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("sql_metrics") as batch_op_sql_metrics:
        batch_op_sql_metrics.drop_column("warning_text")
    with op.batch_alter_table("metrics") as batch_op_metrics:
        batch_op_metrics.drop_column("warning_text")
