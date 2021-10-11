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
"""Initial migration.

Revision ID: d96513202d2a
Revises: 60dc453f4e2e
Create Date: 2021-10-10 18:31:58.279446

"""
import logging
from typing import Callable, List

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "d96513202d2a"
down_revision = "60dc453f4e2e"

logger = logging.getLogger("alembic.runtime.migration")

OLD_TABLE_NAME = "dashboard_roles"
NEW_TABLE_NAME = "object_roles"
DASHBOARD_ROLES_CONSTRAINT_NAME = "dashboard_roles_ibfk_1"
UNIQUE_CONSTRAINT_NAME = "object_roles_unique_rows"
OBJECT_TYPE_COLUMN_NAME = "object_type"


def upgrade() -> None:
    _run_migrations(create_upgrade_steps(), create_downgrade_steps())


def downgrade() -> None:
    _run_migrations(create_downgrade_steps(), create_upgrade_steps())


def _get_dashboard_constraint_name() -> str:
    from superset import db

    logger.info("_get_dashboard_constraint_name")
    inspector = inspect(db.engine)
    logger.info(str(inspector))

    for constraint in inspector.get_foreign_keys(OLD_TABLE_NAME):
        if constraint["constrained_columns"] == ["dashboard_id"]:
            return constraint["name"]


def _run_migrations(
    migration_steps: List[Callable], rollback_steps: List[Callable]
) -> None:
    run_on_error = []
    try:
        for step in migration_steps:
            step()
            run_on_error.append(rollback_steps.pop())
    except Exception as original_exception:
        _on_error(original_exception, run_on_error)


def _on_error(original_exception, run_on_error):
    logger.error(
        "Failed to run migrations, trying to run rollback steps: %s",
        original_exception,
        exc_info=original_exception,
    )
    try:
        for step in run_on_error:
            step()
    except Exception as inner_exception:
        logger.error("Failed to run rollback steps: %s", inner_exception)
    finally:
        raise original_exception


def create_upgrade_steps() -> List[Callable]:
    def new_column_operation() -> None:
        logger.info("add column")
        op.add_column(
            OLD_TABLE_NAME,
            sa.Column(OBJECT_TYPE_COLUMN_NAME, sa.String(length=256), nullable=True),
        )
        logger.info("set values")
        op.execute(
            "UPDATE {table_name} SET object_type = {object_type}".format(
                table_name=OLD_TABLE_NAME, object_type="'Dashboard'"
            )
        )
        logger.info("set not null")
        op.alter_column(
            OLD_TABLE_NAME, "object_type", nullable=False, type_=sa.String(length=256)
        ),

    return [
        lambda: not bool(logger.info("drop_constraint"))
        and op.drop_constraint(
            constraint_name=_get_dashboard_constraint_name(),
            table_name=OLD_TABLE_NAME,
            type_="foreignkey",
        ),
        lambda: not bool(logger.info("alter_column"))
        and op.alter_column(
            OLD_TABLE_NAME,
            "dashboard_id",
            new_column_name="object_id",
            type_=sa.Integer(),
            nullable=True,
        ),
        new_column_operation,
        lambda: not bool(logger.info("create_unique_constraint"))
        and op.create_unique_constraint(
            constraint_name=UNIQUE_CONSTRAINT_NAME,
            table_name=OLD_TABLE_NAME,
            columns=["object_id", "object_type", "role_id"],
        ),
        lambda: not bool(logger.info("rename_table"))
        and op.rename_table(OLD_TABLE_NAME, NEW_TABLE_NAME),
    ]


def create_downgrade_steps() -> List[Callable]:
    return [
        lambda: op.rename_table(NEW_TABLE_NAME, OLD_TABLE_NAME),
        lambda: op.drop_constraint(
            constraint_name=UNIQUE_CONSTRAINT_NAME,
            table_name=OLD_TABLE_NAME,
            type_="unique",
        ),
        lambda: op.drop_column(table_name=OLD_TABLE_NAME, column_name="object_type"),
        lambda: op.alter_column(
            table_name=OLD_TABLE_NAME,
            column_name="object_id",
            new_column_name="dashboard_id",
            type_=sa.Integer(),
            nullable=False,
        ),
        lambda: op.create_foreign_key(
            constraint_name=DASHBOARD_ROLES_CONSTRAINT_NAME,
            source_table=OLD_TABLE_NAME,
            referent_table="dashboards",
            local_cols=["dashboard_id"],
            remote_cols=["id"],
        ),
    ]
