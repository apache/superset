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
"""change_mediumtext_to_longtext
Revision ID: f7b6750b67e8
Revises: f84fde59123a
Create Date: 2024-05-09 19:19:46.630140
"""

# revision identifiers, used by Alembic.
revision = "f7b6750b67e8"
down_revision = "f84fde59123a"

from alembic import op  # noqa: E402
from sqlalchemy.dialects.mysql import MEDIUMTEXT  # noqa: E402
from sqlalchemy.dialects.mysql.base import MySQLDialect  # noqa: E402

from superset.migrations.shared.utils import get_table_column  # noqa: E402
from superset.utils.core import LongText, MediumText  # noqa: E402


def upgrade():
    if isinstance(op.get_bind().dialect, MySQLDialect):
        for item in ["query.executed_sql", "query.select_sql"]:
            table_name, column_name = item.split(".")

            if (column := get_table_column(table_name, column_name)) and isinstance(
                column["type"],
                MEDIUMTEXT,
            ):
                with op.batch_alter_table(table_name) as batch_op:
                    batch_op.alter_column(
                        column_name,
                        existing_type=MediumText(),
                        type_=LongText(),
                        existing_nullable=True,
                    )


def downgrade():
    pass
