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

from superset.migrations.shared.common import create_dashboard_roles_table

# revision identifiers, used by Alembic.
revision = "d96513202d2a"
down_revision = "60dc453f4e2e"

logger = logging.getLogger("alembic.runtime.migration")

OLD_TABLE_NAME = "dashboard_roles"
NEW_TABLE_NAME = "object_roles"
DASHBOARD_ROLES_CONSTRAINT_NAME = "dashboard_roles_ibfk_1"
OBJECT_ROLES_FK_NAME = "object_roles_ibfk_1"
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
    return [
        _create_object_roles_table,
        _migrate_data_to_new_table,
        lambda: op.drop_table(OLD_TABLE_NAME),
    ]


def _create_object_roles_table():
    op.create_table(
        NEW_TABLE_NAME,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("object_id", sa.Integer, nullable=False),
        sa.Column("object_type", sa.String(255), nullable=False),
        sa.Column("role_id", sa.Integer, nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["ab_role.id"], name=OBJECT_ROLES_FK_NAME),
        sa.UniqueConstraint(
            *["object_id", "role_id", "object_type"], name=UNIQUE_CONSTRAINT_NAME
        ),
    )


def _migrate_data_to_new_table():
    op.execute(
        (
            "INSERT INTO {new_table} "
            "SELECT id, dashboard_id as object_id, 'Dashboard' as object_type , role_id "
            "FROM {old_table}".format(
                old_table=OLD_TABLE_NAME, new_table=NEW_TABLE_NAME
            )
        )
    )


def _migrate_data_to_old_table():
    op.execute(
        (
            "INSERT INTO {old_table} "
            "SELECT id, object_id as dashboard_id, role_id "
            "FROM {new_table} t"
            " WHERE t.object_type = 'Dashboard'".format(
                old_table=OLD_TABLE_NAME, new_table=NEW_TABLE_NAME
            )
        )
    )


def create_downgrade_steps() -> List[Callable]:
    return [
        create_dashboard_roles_table,
        _migrate_data_to_old_table,
        lambda: op.drop_table(NEW_TABLE_NAME),
    ]
