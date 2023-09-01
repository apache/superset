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
"""add on delete cascade for dashboard slices

Revision ID: 8ace289026f3
Revises: 2e826adca42c
Create Date: 2023-08-09 14:17:53.326191

"""

# revision identifiers, used by Alembic.
revision = "8ace289026f3"
down_revision = "2e826adca42c"

from alembic import op
from sqlalchemy import create_engine
from sqlalchemy.engine.reflection import Inspector

from superset.migrations.shared.constraints import ForeignKey, redefine
from superset.utils.core import generic_find_fk_constraint_name

foreign_keys = [
    ForeignKey(
        table="dashboard_slices",
        referent_table="dashboards",
        local_cols=["dashboard_id"],
        remote_cols=["id"],
    ),
    ForeignKey(
        table="dashboard_slices",
        referent_table="slices",
        local_cols=["slice_id"],
        remote_cols=["id"],
    ),
]


def upgrade():
    for foreign_key in foreign_keys:
        bind = op.get_bind()
        insp = Inspector.from_engine(bind)
        db_dialect = bind.engine.url.drivername

        if db_dialect == "postgresql":
            if constraint := generic_find_fk_constraint_name(
                table=foreign_key.table,
                columns=set(foreign_key.remote_cols),
                referenced=foreign_key.referent_table,
                insp=insp,
            ):
                # rename the constraint so that we can drop it later- non-blocking
                # this only works on postgres
                op.execute(
                    f"ALTER TABLE {foreign_key.table} RENAME CONSTRAINT {constraint} TO {foreign_key.constraint_name}_old"
                )

            # create the new constraint- uses a non-blocking ALTER TABLE Not Valid property
            op.create_foreign_key(
                constraint_name=foreign_key.constraint_name,
                source_table=foreign_key.table,
                referent_table=foreign_key.referent_table,
                local_cols=foreign_key.local_cols,
                remote_cols=foreign_key.remote_cols,
                ondelete="CASCADE",
                postgresql_not_valid=True,
            )

            # validate the constraint- non-blocking
            op.execute(
                f"ALTER TABLE {foreign_key.table} VALIDATE CONSTRAINT {foreign_key.constraint_name}"
            )

            # drop the old constraint which isn't needed anymore- non-blocking
            if constraint:
                op.drop_constraint(
                    f"{foreign_key.constraint_name}_old",
                    foreign_key.table,
                    type_="foreignkey",
                )
        else:
            redefine(foreign_key, on_delete="CASCADE")


def downgrade():
    for foreign_key in foreign_keys:
        bind = op.get_bind()
        insp = Inspector.from_engine(bind)
        db_dialect = bind.engine.url.drivername

        if db_dialect == "postgresql":
            if constraint := generic_find_fk_constraint_name(
                table=foreign_key.table,
                columns=set(foreign_key.remote_cols),
                referenced=foreign_key.referent_table,
                insp=insp,
            ):
                # rename the constraint so that we can drop it later- non-blocking
                # this only works on postgres
                op.execute(
                    f"ALTER TABLE {foreign_key.table} RENAME CONSTRAINT {constraint} TO {foreign_key.constraint_name}_old"
                )

            # create the new constraint- uses a non-blocking ALTER TABLE Not Valid property
            op.create_foreign_key(
                constraint_name=foreign_key.constraint_name,
                source_table=foreign_key.table,
                referent_table=foreign_key.referent_table,
                local_cols=foreign_key.local_cols,
                remote_cols=foreign_key.remote_cols,
                postgresql_not_valid=True,
            )

            # validate the constraint- non-blocking
            op.execute(
                f"ALTER TABLE {foreign_key.table} VALIDATE CONSTRAINT {foreign_key.constraint_name}"
            )

            # drop the old constraint which isn't needed anymore- non-blocking
            if constraint:
                op.drop_constraint(
                    f"{foreign_key.constraint_name}_old",
                    foreign_key.table,
                    type_="foreignkey",
                )
        else:
            redefine(foreign_key)
