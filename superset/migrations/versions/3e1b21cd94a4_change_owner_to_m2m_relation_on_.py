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
"""change_owner_to_m2m_relation_on_datasources.py

Revision ID: 3e1b21cd94a4
Revises: 4ce8df208545
Create Date: 2018-12-15 12:34:47.228756

"""

# revision identifiers, used by Alembic.
from superset import db
from superset.utils.core import generic_find_fk_constraint_name

revision = "3e1b21cd94a4"
down_revision = "6c7537a6004a"

from alembic import op
import sqlalchemy as sa


sqlatable_user = sa.Table(
    "sqlatable_user",
    sa.MetaData(),
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("user_id", sa.Integer, sa.ForeignKey("ab_user.id")),
    sa.Column("table_id", sa.Integer, sa.ForeignKey("tables.id")),
)

SqlaTable = sa.Table(
    "tables",
    sa.MetaData(),
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("user_id", sa.Integer, sa.ForeignKey("ab_user.id")),
)

druiddatasource_user = sa.Table(
    "druiddatasource_user",
    sa.MetaData(),
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("user_id", sa.Integer, sa.ForeignKey("ab_user.id")),
    sa.Column("datasource_id", sa.Integer, sa.ForeignKey("datasources.id")),
)

DruidDatasource = sa.Table(
    "datasources",
    sa.MetaData(),
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("user_id", sa.Integer, sa.ForeignKey("ab_user.id")),
)


def upgrade():
    op.create_table(
        "sqlatable_user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("table_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["table_id"], ["tables.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "druiddatasource_user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("datasource_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["datasource_id"], ["datasources.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)
    session = db.Session(bind=bind)

    tables = session.query(SqlaTable).all()
    for table in tables:
        if table.user_id is not None:
            session.execute(
                sqlatable_user.insert().values(user_id=table.user_id, table_id=table.id)
            )

    druiddatasources = session.query(DruidDatasource).all()
    for druiddatasource in druiddatasources:
        if druiddatasource.user_id is not None:
            session.execute(
                druiddatasource_user.insert().values(
                    user_id=druiddatasource.user_id, datasource_id=druiddatasource.id
                )
            )

    session.close()
    with op.batch_alter_table("tables") as batch_op:
        batch_op.drop_constraint("user_id", type_="foreignkey")
        batch_op.drop_column("user_id")
    with op.batch_alter_table("datasources") as batch_op:
        batch_op.drop_constraint(
            generic_find_fk_constraint_name("datasources", {"id"}, "ab_user", insp),
            type_="foreignkey",
        )
        batch_op.drop_column("user_id")


def downgrade():
    op.drop_table("sqlatable_user")
    op.drop_table("druiddatasource_user")
    with op.batch_alter_table("tables") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.INTEGER(), nullable=True))
        batch_op.create_foreign_key("user_id", "ab_user", ["user_id"], ["id"])
    with op.batch_alter_table("datasources") as batch_op:
        batch_op.add_column(sa.Column("user_id", sa.INTEGER(), nullable=True))
        batch_op.create_foreign_key(
            "fk_datasources_user_id_ab_user", "ab_user", ["user_id"], ["id"]
        )
