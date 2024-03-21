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
"""Added aws columns

Revision ID: 307a065963ec
Revises: be1b217cd8cd
Create Date: 2024-03-20 11:55:35.734823

"""

# revision identifiers, used by Alembic.
revision = "307a065963ec"
down_revision = "be1b217cd8cd"

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import EncryptedType


def upgrade():
    op.add_column(
        "report_schedule",
        sa.Column("aws_key", EncryptedType(sa.String(1024)), nullable=True),
    )
    op.add_column(
        "report_schedule",
        sa.Column("aws_secret_key", EncryptedType(sa.String(1024)), nullable=True),
    )
    op.add_column(
        "report_schedule",
        sa.Column("aws_s3_types", sa.String(length=200), nullable=True),
    )


def downgrade():
    op.drop_column("report_schedule", "aws_key")
    op.drop_column("report_schedule", "aws_secret_key")
    op.drop_column("report_schedule", "aws_s3_types")
