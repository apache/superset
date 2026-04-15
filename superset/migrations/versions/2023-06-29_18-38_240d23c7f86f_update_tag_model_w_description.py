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
"""update_tag_model_w_description

Revision ID: 240d23c7f86f
Revises: 8e5b0fb85b9a
Create Date: 2023-06-29 18:38:30.033529

"""

# revision identifiers, used by Alembic.
revision = "240d23c7f86f"
down_revision = "8e5b0fb85b9a"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("tag", sa.Column("description", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("tag", "description")
