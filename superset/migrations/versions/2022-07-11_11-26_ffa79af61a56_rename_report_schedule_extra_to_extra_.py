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
"""rename report_schedule.extra to extra_json

So we can reuse the ExtraJSONMixin

Revision ID: ffa79af61a56
Revises: 409c7b420ab0
Create Date: 2022-07-11 11:26:00.010714

"""

# revision identifiers, used by Alembic.
revision = "ffa79af61a56"
down_revision = "409c7b420ab0"

from alembic import op  # noqa: E402
from sqlalchemy.types import Text  # noqa: E402


def upgrade():
    op.alter_column(
        "report_schedule",
        "extra",
        new_column_name="extra_json",
        # existing info is required for MySQL
        existing_type=Text,
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        "report_schedule",
        "extra_json",
        new_column_name="extra",
        existing_type=Text,
        existing_nullable=True,
    )
