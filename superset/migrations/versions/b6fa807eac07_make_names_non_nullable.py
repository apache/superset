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
"""make_names_non_nullable

Revision ID: b6fa807eac07
Revises: 1495eb914ad3
Create Date: 2019-10-02 00:29:16.679272

"""
from alembic import op
import sqlalchemy as sa

from superset.utils.core import generic_find_fk_constraint_name

# revision identifiers, used by Alembic.
revision = "b6fa807eac07"
down_revision = "1495eb914ad3"

conv = {
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
}


def upgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    # First, drop the foreign key constraint prior to altering columns.
    fk_datasources_cluster_name_clusters = (
        generic_find_fk_constraint_name(
            "datasources", {"cluster_name"}, "clusters", insp
        )
        or "fk_datasources_cluster_name_clusters"
    )
    with op.batch_alter_table("datasources", naming_convention=conv) as batch_op:
        batch_op.drop_constraint(
            fk_datasources_cluster_name_clusters, type_="foreignkey"
        )

    # Second, make the columns non-nullable.
    with op.batch_alter_table("datasources") as batch_op:
        batch_op.alter_column(
            "cluster_name", existing_type=sa.String(250), nullable=False
        )
    with op.batch_alter_table("clusters") as batch_op:
        batch_op.alter_column(
            "cluster_name", existing_type=sa.String(250), nullable=False
        )
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.alter_column(
            "database_name", existing_type=sa.String(250), nullable=False
        )
    with op.batch_alter_table("tables") as batch_op:
        batch_op.alter_column(
            "table_name", existing_type=sa.String(250), nullable=False
        )

    # Finally, re-add the foreign key constraint.
    with op.batch_alter_table("datasources") as batch_op:
        batch_op.create_foreign_key(
            fk_datasources_cluster_name_clusters,
            "clusters",
            ["cluster_name"],
            ["cluster_name"],
        )


def downgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    # First, drop the foreign key constraint prior to altering columns.
    fk_datasources_cluster_name_clusters = (
        generic_find_fk_constraint_name(
            "datasources", {"cluster_name"}, "clusters", insp
        )
        or "fk_datasources_cluster_name_clusters"
    )
    with op.batch_alter_table("datasources", naming_convention=conv) as batch_op:
        batch_op.drop_constraint(
            fk_datasources_cluster_name_clusters, type_="foreignkey"
        )

    # Second, make the columns nullable.
    with op.batch_alter_table("datasources") as batch_op:
        batch_op.alter_column(
            "cluster_name", existing_type=sa.String(250), nullable=True
        )

    with op.batch_alter_table("clusters") as batch_op:
        batch_op.alter_column(
            "cluster_name", existing_type=sa.String(250), nullable=True
        )
    with op.batch_alter_table("dbs") as batch_op:
        batch_op.alter_column(
            "database_name", existing_type=sa.String(250), nullable=True
        )
    with op.batch_alter_table("tables") as batch_op:
        batch_op.alter_column("table_name", existing_type=sa.String(250), nullable=True)

    # Finally, re-add the foreign key constraint.
    with op.batch_alter_table("datasources") as batch_op:
        batch_op.create_foreign_key(
            fk_datasources_cluster_name_clusters,
            "clusters",
            ["cluster_name"],
            ["cluster_name"],
        )
