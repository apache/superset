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

"""add_msg_content_to_report_schedule

Revises: 291f024254b5
Revision ID: b060a1b53a06
Author: Burhanuddin Bhopalwala
Create Date: 2022-12-23 21:25:43.463243

"""

# revision identifiers, used by Alembic.
revision = "b060a1b53a06"
down_revision = "291f024254b5"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column("report_schedule", sa.Column("msg_content", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("report_schedule", "msg_content")
    # ### end Alembic commands ###
