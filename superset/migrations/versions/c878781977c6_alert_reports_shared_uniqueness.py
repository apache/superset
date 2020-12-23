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
"""alert reports shared uniqueness

Revision ID: c878781977c6
Revises: 73fd22e742ab
Create Date: 2020-12-23 11:34:53.882200

"""

# revision identifiers, used by Alembic.
revision = "c878781977c6"
down_revision = "73fd22e742ab"

import sqlalchemy as sa
from alembic import op


def upgrade():
    try:
        op.drop_constraint("uq_report_schedule_name", "report_schedule", type_="unique")
        op.drop_constraint(
            "report_schedule_name_key", "report_schedule", type_="unique"
        )
    except Exception:
        # Expected to fail on SQLite
        pass

    try:
        op.create_unique_constraint(
            "uq_report_schedule_name_type", "report_schedule", ["name", "type"]
        )
    except Exception:
        # Expected to fail on SQLite
        pass


def downgrade():
    try:
        op.drop_constraint(
            "uq_report_schedule_name_type", "report_schedule", type_="unique"
        )
    except Exception:
        # Expected to fail on SQLite
        pass
    try:
        op.create_unique_constraint(
            "uq_report_schedule_name", "report_schedule", ["name"]
        )
    except Exception:
        # Expected to fail on SQLite and if there are already non unique values on names
        pass
