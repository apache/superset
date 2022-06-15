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
"""Collapse alerting models into a single one

Revision ID: af30ca79208f
Revises: b56500de1855
Create Date: 2020-10-05 18:10:52.272047

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.sqlite.base import SQLiteDialect
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.orm import backref, relationship, RelationshipProperty

from superset import db
from superset.utils.core import generic_find_fk_constraint_name

revision = "af30ca79208f"
down_revision = "b56500de1855"


Base = declarative_base()


class Alert(Base):
    __tablename__ = "alerts"
    id = sa.Column(sa.Integer, primary_key=True)
    sql = sa.Column(sa.Text, nullable=False)
    validator_type = sa.Column(sa.String(100), nullable=False)
    validator_config = sa.Column(sa.Text)
    database_id = sa.Column(sa.Integer)


class SQLObserver(Base):
    __tablename__ = "sql_observers"

    id = sa.Column(sa.Integer, primary_key=True)
    sql = sa.Column(sa.Text, nullable=False)
    database_id = sa.Column(sa.Integer)

    @declared_attr
    def alert_id(self) -> int:
        return sa.Column(sa.Integer, sa.ForeignKey("alerts.id"), nullable=False)

    @declared_attr
    def alert(self) -> RelationshipProperty:
        return relationship(
            "Alert",
            foreign_keys=[self.alert_id],
            backref=backref("sql_observer", cascade="all, delete-orphan"),
        )


class Validator(Base):
    __tablename__ = "alert_validators"

    id = sa.Column(sa.Integer, primary_key=True)
    validator_type = sa.Column(sa.String(100), nullable=False)
    config = sa.Column(sa.Text)

    @declared_attr
    def alert_id(self) -> int:
        return sa.Column(sa.Integer, sa.ForeignKey("alerts.id"), nullable=False)

    @declared_attr
    def alert(self) -> RelationshipProperty:
        return relationship(
            "Alert",
            foreign_keys=[self.alert_id],
            backref=backref("validators", cascade="all, delete-orphan"),
        )


def upgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    if isinstance(bind.dialect, SQLiteDialect):
        op.add_column(
            "alerts",
            sa.Column("validator_config", sa.Text(), server_default="", nullable=True),
        )
        op.add_column(
            "alerts",
            sa.Column("database_id", sa.Integer(), server_default="0", nullable=False),
        )
        op.add_column(
            "alerts", sa.Column("sql", sa.Text(), server_default="", nullable=False)
        )
        op.add_column(
            "alerts",
            sa.Column(
                "validator_type",
                sa.String(length=100),
                server_default="",
                nullable=False,
            ),
        )
    else:  # mysql does not support server_default for text fields
        op.add_column(
            "alerts",
            sa.Column("validator_config", sa.Text(), default="", nullable=True),
        )
        op.add_column(
            "alerts",
            sa.Column("database_id", sa.Integer(), default=0, nullable=False),
        )
        op.add_column("alerts", sa.Column("sql", sa.Text(), default="", nullable=False))
        op.add_column(
            "alerts",
            sa.Column(
                "validator_type", sa.String(length=100), default="", nullable=False
            ),
        )
    # Migrate data
    session = db.Session(bind=bind)
    alerts = session.query(Alert).all()
    for a in alerts:
        if a.sql_observer:
            a.sql = a.sql_observer[0].sql
            a.database_id = a.sql_observer[0].database_id
        if a.validators:
            a.validator_type = a.validators[0].validator_type
            a.validator_config = a.validators[0].config
    session.commit()

    if not isinstance(bind.dialect, SQLiteDialect):
        constraint = generic_find_fk_constraint_name(
            "sql_observations", {"id"}, "sql_observers", insp
        )
        op.drop_constraint(constraint, "sql_observations", type_="foreignkey")
        op.drop_column("sql_observations", "observer_id")

    op.drop_table("alert_validators")
    op.drop_table("sql_observers")

    # sqlite does not support column and fk deletion
    if isinstance(bind.dialect, SQLiteDialect):
        op.drop_table("sql_observations")
        op.create_table(
            "sql_observations",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("dttm", sa.DateTime(), nullable=True),
            sa.Column("alert_id", sa.Integer(), nullable=True),
            sa.Column("value", sa.Float(), nullable=True),
            sa.Column("error_msg", sa.String(length=500), nullable=True),
            sa.ForeignKeyConstraint(
                ["alert_id"],
                ["alerts.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        op.create_foreign_key(None, "alerts", "dbs", ["database_id"], ["id"])


def downgrade():
    bind = op.get_bind()
    insp = sa.engine.reflection.Inspector.from_engine(bind)

    op.create_table(
        "sql_observers",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sql", sa.Text(), nullable=False),
        sa.Column("created_by_fk", sa.Integer(), autoincrement=False, nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), autoincrement=False, nullable=True),
        sa.Column("alert_id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("database_id", sa.Integer(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"]),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["database_id"], ["dbs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "alert_validators",
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "validator_type",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column("config", sa.Text(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), autoincrement=False, nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), autoincrement=False, nullable=True),
        sa.Column("alert_id", sa.Integer(), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(
            ["alert_id"], ["alerts.id"], name="alert_validators_ibfk_1"
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_fk"], ["ab_user.id"], name="alert_validators_ibfk_2"
        ),
        sa.ForeignKeyConstraint(
            ["created_by_fk"], ["ab_user.id"], name="alert_validators_ibfk_3"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Migrate data
    session = db.Session(bind=bind)
    alerts = session.query(Alert).all()
    for a in alerts:
        if a.sql:
            ob = SQLObserver(sql=a.sql, database_id=a.database_id)
            a.sql_observer.append(ob)
            session.add(ob)
        if a.validator_type:
            val = Validator(
                validator_type=a.validator_type,
                config=a.validator_config,
                alert_id=a.id,
            )
            a.validators.append(val)
            session.add(val)
    session.commit()

    # sqlite does not support dropping columns
    if isinstance(bind.dialect, SQLiteDialect):
        op.add_column(
            "sql_observations",
            sa.Column(
                "observer_id",
                sa.Integer(),
                autoincrement=False,
                nullable=False,
                server_default="0",
            ),
        )
        op.drop_table("alerts")
        op.create_table(
            "alerts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("label", sa.String(length=150), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=True),
            sa.Column("crontab", sa.String(length=50), nullable=False),
            sa.Column("alert_type", sa.String(length=50), nullable=True),
            sa.Column("log_retention", sa.Integer(), nullable=False, default=90),
            sa.Column(
                "grace_period", sa.Integer(), nullable=False, default=60 * 60 * 24
            ),
            sa.Column("recipients", sa.Text(), nullable=True),
            sa.Column("slice_id", sa.Integer(), nullable=True),
            sa.Column("dashboard_id", sa.Integer(), nullable=True),
            sa.Column("last_eval_dttm", sa.DateTime(), nullable=True),
            sa.Column("last_state", sa.String(length=10), nullable=True),
            sa.Column("changed_by_fk", sa.Integer(), nullable=True),
            sa.Column("changed_on", sa.DateTime(), nullable=True),
            sa.Column("created_by_fk", sa.Integer(), nullable=True),
            sa.Column("created_on", sa.DateTime(), nullable=True),
            sa.Column("slack_channel", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(
                ["dashboard_id"],
                ["dashboards.id"],
            ),
            sa.ForeignKeyConstraint(
                ["slice_id"],
                ["slices.id"],
            ),
            sa.ForeignKeyConstraint(
                ["created_by_fk"],
                ["ab_user.id"],
            ),
            sa.ForeignKeyConstraint(
                ["changed_by_fk"],
                ["ab_user.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    else:
        op.add_column(
            "sql_observations",
            sa.Column(
                "observer_id",
                sa.Integer(),
                autoincrement=False,
                nullable=False,
                default=0,
            ),
        )
        constraint = generic_find_fk_constraint_name("alerts", {"id"}, "dbs", insp)
        op.drop_constraint(constraint, "alerts", type_="foreignkey")
        op.drop_column("alerts", "validator_type")
        op.drop_column("alerts", "sql")
        op.drop_column("alerts", "database_id")
        op.drop_column("alerts", "validator_config")

        op.create_foreign_key(
            "sql_observations_ibfk_2",
            "sql_observations",
            "sql_observers",
            ["observer_id"],
            ["id"],
        )
