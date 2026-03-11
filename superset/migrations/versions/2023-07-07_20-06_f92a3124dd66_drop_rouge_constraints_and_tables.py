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
"""drop rouge constraints and tables

Revision ID: f92a3124dd66
Revises: 240d23c7f86f
Create Date: 2023-07-07 20:06:22.659096

"""

# revision identifiers, used by Alembic.
revision = "f92a3124dd66"
down_revision = "240d23c7f86f"

from alembic import op  # noqa: E402
from sqlalchemy.engine.reflection import Inspector  # noqa: E402

from superset.utils.core import generic_find_fk_constraint_name  # noqa: E402


def upgrade():
    bind = op.get_bind()
    insp = Inspector.from_engine(bind)
    tables = insp.get_table_names()
    conv = {"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}

    if "datasources" in tables:
        with op.batch_alter_table("slices", naming_convention=conv) as batch_op:
            if constraint := generic_find_fk_constraint_name(
                table="slices",
                columns={"id"},
                referenced="datasources",
                insp=insp,
            ):
                batch_op.drop_constraint(constraint, type_="foreignkey")

    for table in [  # Child tables are ordered first.
        "alert_logs",
        "alert_owner",
        "sql_observations",
        "alerts",
        "columns",
        "metrics",
        "druiddatasource_user",
        "datasources",
        "clusters",
        "dashboard_email_schedules",
        "slice_email_schedules",
    ]:
        if table in tables:
            op.drop_table(table)


def downgrade():
    pass
