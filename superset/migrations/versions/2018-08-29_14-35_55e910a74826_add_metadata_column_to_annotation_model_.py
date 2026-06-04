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
"""add_metadata_column_to_annotation_model.py

Revision ID: 55e910a74826
Revises: 1a1d627ebd8e
Create Date: 2018-08-29 14:35:20.407743

"""

# revision identifiers, used by Alembic.
revision = "55e910a74826"
down_revision = "1a1d627ebd8e"

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    op.add_column("annotation", sa.Column("json_metadata", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("annotation", "json_metadata")
