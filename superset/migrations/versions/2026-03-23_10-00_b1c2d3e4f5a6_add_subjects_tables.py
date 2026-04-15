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
"""add subjects and editor/viewer tables

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-03-23 10:00:00.000000

"""

import logging

from alembic import op
from sqlalchemy import (
    Boolean,
    case,
    Column,
    column as sa_column,
    DateTime,
    func,
    Integer,
    literal,
    select,
    String,
    table as sa_table,
    UniqueConstraint,
)
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_index,
    create_table,
    drop_fks_for_table,
    drop_index,
    drop_table,
)

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "a1b2c3d4e5f6"

SUBJECTS_TABLE = "subjects"
DASHBOARD_EDITORS = "dashboard_editors"
DASHBOARD_VIEWERS = "dashboard_viewers"
CHART_EDITORS = "chart_editors"
CHART_VIEWERS = "chart_viewers"
SQLATABLE_EDITORS = "sqlatable_editors"
REPORT_SCHEDULE_EDITORS = "report_schedule_editors"
RLS_FILTER_SUBJECTS = "rls_filter_subjects"

JUNCTION_TABLES = [
    DASHBOARD_EDITORS,
    DASHBOARD_VIEWERS,
    CHART_EDITORS,
    CHART_VIEWERS,
    SQLATABLE_EDITORS,
    REPORT_SCHEDULE_EDITORS,
    RLS_FILTER_SUBJECTS,
]

# Legacy tables to drop on upgrade and recreate on downgrade
LEGACY_OWNER_TABLES = [
    "dashboard_user",
    "slice_user",
    "sqlatable_user",
    "report_schedule_user",
]
LEGACY_ROLE_TABLES = [
    "dashboard_roles",
    "rls_filter_roles",
]


def _create_subjects_table() -> None:
    create_table(
        SUBJECTS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("uuid", UUIDType(binary=True), nullable=True),
        Column("label", String(255), nullable=False),
        Column("secondary_label", String(255), nullable=True),
        Column("active", Boolean, nullable=True),
        Column("extra_search", String(255), nullable=True),
        Column("type", Integer, nullable=False),
        Column("user_id", Integer, nullable=True),
        Column("role_id", Integer, nullable=True),
        Column("group_id", Integer, nullable=True),
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
    )
    create_index(SUBJECTS_TABLE, "ix_subjects_label", ["label"])
    create_index(SUBJECTS_TABLE, "ix_subjects_extra_search", ["extra_search"])
    create_index(SUBJECTS_TABLE, "ix_subjects_user_id", ["user_id"], unique=True)
    create_index(SUBJECTS_TABLE, "ix_subjects_role_id", ["role_id"], unique=True)
    create_index(SUBJECTS_TABLE, "ix_subjects_group_id", ["group_id"], unique=True)

    create_fks_for_table(
        foreign_key_name="fk_subjects_user_id_ab_user",
        table_name=SUBJECTS_TABLE,
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_subjects_role_id_ab_role",
        table_name=SUBJECTS_TABLE,
        referenced_table="ab_role",
        local_cols=["role_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_subjects_group_id_ab_group",
        table_name=SUBJECTS_TABLE,
        referenced_table="ab_group",
        local_cols=["group_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_subjects_created_by_fk_ab_user",
        table_name=SUBJECTS_TABLE,
        referenced_table="ab_user",
        local_cols=["created_by_fk"],
        remote_cols=["id"],
    )
    create_fks_for_table(
        foreign_key_name="fk_subjects_changed_by_fk_ab_user",
        table_name=SUBJECTS_TABLE,
        referenced_table="ab_user",
        local_cols=["changed_by_fk"],
        remote_cols=["id"],
    )


def _create_junction_table(
    table_name: str, resource_col: str, resource_table: str
) -> None:
    create_table(
        table_name,
        Column("id", Integer, primary_key=True),
        Column("subject_id", Integer, nullable=False),
        Column(resource_col, Integer, nullable=False),
        UniqueConstraint("subject_id", resource_col),
    )
    create_fks_for_table(
        foreign_key_name=f"fk_{table_name}_subject_id_subjects",
        table_name=table_name,
        referenced_table=SUBJECTS_TABLE,
        local_cols=["subject_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name=f"fk_{table_name}_{resource_col}_{resource_table}",
        table_name=table_name,
        referenced_table=resource_table,
        local_cols=[resource_col],
        remote_cols=["id"],
        ondelete="CASCADE",
    )


def _seed_subjects() -> None:
    """Seed Subject rows from existing users, roles, and groups."""
    conn = op.get_bind()

    # Table references for SQLAlchemy constructs
    subjects = sa_table(
        "subjects",
        sa_column("id", Integer),
        sa_column("label", String),
        sa_column("secondary_label", String),
        sa_column("active", Boolean),
        sa_column("extra_search", String),
        sa_column("type", Integer),
        sa_column("user_id", Integer),
        sa_column("role_id", Integer),
        sa_column("group_id", Integer),
    )
    ab_user = sa_table(
        "ab_user",
        sa_column("id", Integer),
        sa_column("first_name", String),
        sa_column("last_name", String),
        sa_column("username", String),
        sa_column("email", String),
        sa_column("active", Boolean),
    )
    ab_role = sa_table(
        "ab_role",
        sa_column("id", Integer),
        sa_column("name", String),
    )

    # Junction tables (source)
    dashboard_user = sa_table(
        "dashboard_user",
        sa_column("user_id", Integer),
        sa_column("dashboard_id", Integer),
    )
    slice_user = sa_table(
        "slice_user",
        sa_column("user_id", Integer),
        sa_column("slice_id", Integer),
    )
    sqlatable_user = sa_table(
        "sqlatable_user",
        sa_column("user_id", Integer),
        sa_column("table_id", Integer),
    )
    report_schedule_user = sa_table(
        "report_schedule_user",
        sa_column("user_id", Integer),
        sa_column("report_schedule_id", Integer),
    )
    dashboard_roles = sa_table(
        "dashboard_roles",
        sa_column("role_id", Integer),
        sa_column("dashboard_id", Integer),
    )
    rls_filter_roles = sa_table(
        "rls_filter_roles",
        sa_column("role_id", Integer),
        sa_column("rls_filter_id", Integer),
    )

    # Junction tables (target)
    dashboard_editors = sa_table(
        "dashboard_editors",
        sa_column("subject_id", Integer),
        sa_column("dashboard_id", Integer),
    )
    chart_editors = sa_table(
        "chart_editors",
        sa_column("subject_id", Integer),
        sa_column("chart_id", Integer),
    )
    sqlatable_editors = sa_table(
        "sqlatable_editors",
        sa_column("subject_id", Integer),
        sa_column("table_id", Integer),
    )
    report_schedule_editors = sa_table(
        "report_schedule_editors",
        sa_column("subject_id", Integer),
        sa_column("report_schedule_id", Integer),
    )
    dashboard_viewers = sa_table(
        "dashboard_viewers",
        sa_column("subject_id", Integer),
        sa_column("dashboard_id", Integer),
    )
    rls_filter_subjects = sa_table(
        "rls_filter_subjects",
        sa_column("subject_id", Integer),
        sa_column("rls_filter_id", Integer),
    )

    # Seed from ab_user (type=1 USER)
    user_label = func.trim(
        func.coalesce(
            func.nullif(func.trim(ab_user.c.first_name), "")
            + " "
            + func.nullif(func.trim(ab_user.c.last_name), ""),
            ab_user.c.username,
        )
    )
    user_select = select(
        user_label,
        ab_user.c.email,
        ab_user.c.active,
        ab_user.c.email,
        literal(1),
        ab_user.c.id,
    ).where(
        ~ab_user.c.id.in_(
            select(subjects.c.user_id).where(subjects.c.user_id.isnot(None))
        )
    )
    conn.execute(
        subjects.insert().from_select(
            ["label", "secondary_label", "active", "extra_search", "type", "user_id"],
            user_select,
        )
    )

    # Seed from ab_role (type=2 ROLE)
    role_select = select(
        ab_role.c.name,
        literal(True),
        literal(2),
        ab_role.c.id,
    ).where(
        ~ab_role.c.id.in_(
            select(subjects.c.role_id).where(subjects.c.role_id.isnot(None))
        )
    )
    conn.execute(
        subjects.insert().from_select(
            ["label", "active", "type", "role_id"],
            role_select,
        )
    )

    # Seed from ab_group (type=3 GROUP) - table may not exist on all deployments
    try:
        ab_group = sa_table(
            "ab_group",
            sa_column("id", Integer),
            sa_column("name", String),
            sa_column("label", String),
            sa_column("description", String),
        )
        has_distinct_label = ab_group.c.label.isnot(None) & (
            ab_group.c.label != ab_group.c.name
        )
        # label: use group.label if distinct from name, else name
        group_label = case(
            (has_distinct_label, ab_group.c.label),
            else_=ab_group.c.name,
        )
        # secondary_label: if distinct label + description → description;
        #                   if distinct label only → name;
        #                   if no distinct label + description → description;
        #                   else → NULL
        group_secondary = case(
            (
                has_distinct_label & ab_group.c.description.isnot(None),
                ab_group.c.description,
            ),
            (has_distinct_label, ab_group.c.name),
            (ab_group.c.description.isnot(None), ab_group.c.description),
            else_=literal(None),
        )
        # extra_search: name when label is distinct (for searchability)
        group_extra = case(
            (has_distinct_label, ab_group.c.name),
            else_=literal(None),
        )
        group_select = select(
            group_label,
            group_secondary,
            group_extra,
            literal(True),
            literal(3),
            ab_group.c.id,
        ).where(
            ~ab_group.c.id.in_(
                select(subjects.c.group_id).where(subjects.c.group_id.isnot(None))
            )
        )
        conn.execute(
            subjects.insert().from_select(
                [
                    "label",
                    "secondary_label",
                    "extra_search",
                    "active",
                    "type",
                    "group_id",
                ],
                group_select,
            )
        )
    except Exception:  # noqa: S110
        logging.info("ab_group table not found, skipping group subject seeding")

    # Populate dashboard_editors from dashboard_user
    conn.execute(
        dashboard_editors.insert().from_select(
            ["subject_id", "dashboard_id"],
            select(subjects.c.id, dashboard_user.c.dashboard_id).join(
                subjects, subjects.c.user_id == dashboard_user.c.user_id
            ),
        )
    )

    # Populate chart_editors from slice_user
    conn.execute(
        chart_editors.insert().from_select(
            ["subject_id", "chart_id"],
            select(subjects.c.id, slice_user.c.slice_id).join(
                subjects, subjects.c.user_id == slice_user.c.user_id
            ),
        )
    )

    # Populate sqlatable_editors from sqlatable_user
    conn.execute(
        sqlatable_editors.insert().from_select(
            ["subject_id", "table_id"],
            select(subjects.c.id, sqlatable_user.c.table_id).join(
                subjects, subjects.c.user_id == sqlatable_user.c.user_id
            ),
        )
    )

    # Populate report_schedule_editors from report_schedule_user
    conn.execute(
        report_schedule_editors.insert().from_select(
            ["subject_id", "report_schedule_id"],
            select(subjects.c.id, report_schedule_user.c.report_schedule_id).join(
                subjects, subjects.c.user_id == report_schedule_user.c.user_id
            ),
        )
    )

    # Populate dashboard_viewers from dashboard_roles
    conn.execute(
        dashboard_viewers.insert().from_select(
            ["subject_id", "dashboard_id"],
            select(subjects.c.id, dashboard_roles.c.dashboard_id).join(
                subjects, subjects.c.role_id == dashboard_roles.c.role_id
            ),
        )
    )

    # Populate rls_filter_subjects from rls_filter_roles
    conn.execute(
        rls_filter_subjects.insert().from_select(
            ["subject_id", "rls_filter_id"],
            select(subjects.c.id, rls_filter_roles.c.rls_filter_id).join(
                subjects, subjects.c.role_id == rls_filter_roles.c.role_id
            ),
        )
    )


def _drop_legacy_tables() -> None:
    """Drop legacy owner and role junction tables after data has been migrated."""
    # dashboard_user
    drop_fks_for_table(
        "dashboard_user",
        ["dashboard_user_ibfk_1", "dashboard_user_ibfk_2"],
    )
    drop_table("dashboard_user")

    # slice_user
    drop_fks_for_table(
        "slice_user",
        ["slice_user_ibfk_1", "slice_user_ibfk_2"],
    )
    drop_table("slice_user")

    # sqlatable_user
    drop_fks_for_table(
        "sqlatable_user",
        ["sqlatable_user_ibfk_1", "sqlatable_user_ibfk_2"],
    )
    drop_table("sqlatable_user")

    # report_schedule_user
    drop_fks_for_table(
        "report_schedule_user",
        ["report_schedule_user_ibfk_1", "report_schedule_user_ibfk_2"],
    )
    drop_table("report_schedule_user")

    # dashboard_roles
    drop_fks_for_table(
        "dashboard_roles",
        ["dashboard_roles_ibfk_1", "dashboard_roles_ibfk_2"],
    )
    drop_table("dashboard_roles")

    # rls_filter_roles
    drop_fks_for_table(
        "rls_filter_roles",
        ["rls_filter_roles_ibfk_1", "rls_filter_roles_ibfk_2"],
    )
    drop_table("rls_filter_roles")


def _recreate_legacy_tables() -> None:
    """Recreate legacy owner/role junction tables and repopulate."""
    conn = op.get_bind()

    # Table references for repopulation queries
    subjects = sa_table(
        "subjects",
        sa_column("id", Integer),
        sa_column("type", Integer),
        sa_column("user_id", Integer),
        sa_column("role_id", Integer),
    )
    dashboard_editors = sa_table(
        "dashboard_editors",
        sa_column("subject_id", Integer),
        sa_column("dashboard_id", Integer),
    )
    chart_editors = sa_table(
        "chart_editors",
        sa_column("subject_id", Integer),
        sa_column("chart_id", Integer),
    )
    sqlatable_editors = sa_table(
        "sqlatable_editors",
        sa_column("subject_id", Integer),
        sa_column("table_id", Integer),
    )
    report_schedule_editors = sa_table(
        "report_schedule_editors",
        sa_column("subject_id", Integer),
        sa_column("report_schedule_id", Integer),
    )
    dashboard_viewers = sa_table(
        "dashboard_viewers",
        sa_column("subject_id", Integer),
        sa_column("dashboard_id", Integer),
    )
    rls_filter_subjects = sa_table(
        "rls_filter_subjects",
        sa_column("subject_id", Integer),
        sa_column("rls_filter_id", Integer),
    )

    # --- Recreate owner tables ---
    # dashboard_user
    create_table(
        "dashboard_user",
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, nullable=True),
        Column("dashboard_id", Integer, nullable=True),
    )
    create_fks_for_table(
        foreign_key_name="dashboard_user_ibfk_1",
        table_name="dashboard_user",
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="dashboard_user_ibfk_2",
        table_name="dashboard_user",
        referenced_table="dashboards",
        local_cols=["dashboard_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    # slice_user
    create_table(
        "slice_user",
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, nullable=True),
        Column("slice_id", Integer, nullable=True),
    )
    create_fks_for_table(
        foreign_key_name="slice_user_ibfk_1",
        table_name="slice_user",
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="slice_user_ibfk_2",
        table_name="slice_user",
        referenced_table="slices",
        local_cols=["slice_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    # sqlatable_user
    create_table(
        "sqlatable_user",
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, nullable=True),
        Column("table_id", Integer, nullable=True),
    )
    create_fks_for_table(
        foreign_key_name="sqlatable_user_ibfk_1",
        table_name="sqlatable_user",
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="sqlatable_user_ibfk_2",
        table_name="sqlatable_user",
        referenced_table="tables",
        local_cols=["table_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    # report_schedule_user
    create_table(
        "report_schedule_user",
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, nullable=False),
        Column("report_schedule_id", Integer, nullable=False),
        UniqueConstraint("user_id", "report_schedule_id"),
    )
    create_fks_for_table(
        foreign_key_name="report_schedule_user_ibfk_1",
        table_name="report_schedule_user",
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="report_schedule_user_ibfk_2",
        table_name="report_schedule_user",
        referenced_table="report_schedule",
        local_cols=["report_schedule_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    # --- Recreate role tables ---
    # dashboard_roles
    create_table(
        "dashboard_roles",
        Column("id", Integer, primary_key=True),
        Column("dashboard_id", Integer, nullable=False),
        Column("role_id", Integer, nullable=False),
    )
    create_fks_for_table(
        foreign_key_name="dashboard_roles_ibfk_1",
        table_name="dashboard_roles",
        referenced_table="dashboards",
        local_cols=["dashboard_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="dashboard_roles_ibfk_2",
        table_name="dashboard_roles",
        referenced_table="ab_role",
        local_cols=["role_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    # rls_filter_roles
    create_table(
        "rls_filter_roles",
        Column("id", Integer, primary_key=True),
        Column("role_id", Integer, nullable=False),
        Column("rls_filter_id", Integer, nullable=True),
    )
    create_fks_for_table(
        foreign_key_name="rls_filter_roles_ibfk_1",
        table_name="rls_filter_roles",
        referenced_table="ab_role",
        local_cols=["role_id"],
        remote_cols=["id"],
    )
    create_fks_for_table(
        foreign_key_name="rls_filter_roles_ibfk_2",
        table_name="rls_filter_roles",
        referenced_table="row_level_security_filters",
        local_cols=["rls_filter_id"],
        remote_cols=["id"],
    )

    # --- Repopulate owner tables from user-type editors (type=1) ---
    dashboard_user = sa_table(
        "dashboard_user",
        sa_column("user_id", Integer),
        sa_column("dashboard_id", Integer),
    )
    conn.execute(
        dashboard_user.insert().from_select(
            ["user_id", "dashboard_id"],
            select(subjects.c.user_id, dashboard_editors.c.dashboard_id)
            .join(subjects, subjects.c.id == dashboard_editors.c.subject_id)
            .where(subjects.c.type == 1),
        )
    )

    slice_user = sa_table(
        "slice_user",
        sa_column("user_id", Integer),
        sa_column("slice_id", Integer),
    )
    conn.execute(
        slice_user.insert().from_select(
            ["user_id", "slice_id"],
            select(subjects.c.user_id, chart_editors.c.chart_id)
            .join(subjects, subjects.c.id == chart_editors.c.subject_id)
            .where(subjects.c.type == 1),
        )
    )

    sqlatable_user = sa_table(
        "sqlatable_user",
        sa_column("user_id", Integer),
        sa_column("table_id", Integer),
    )
    conn.execute(
        sqlatable_user.insert().from_select(
            ["user_id", "table_id"],
            select(subjects.c.user_id, sqlatable_editors.c.table_id)
            .join(subjects, subjects.c.id == sqlatable_editors.c.subject_id)
            .where(subjects.c.type == 1),
        )
    )

    report_schedule_user = sa_table(
        "report_schedule_user",
        sa_column("user_id", Integer),
        sa_column("report_schedule_id", Integer),
    )
    conn.execute(
        report_schedule_user.insert().from_select(
            ["user_id", "report_schedule_id"],
            select(
                subjects.c.user_id,
                report_schedule_editors.c.report_schedule_id,
            )
            .join(subjects, subjects.c.id == report_schedule_editors.c.subject_id)
            .where(subjects.c.type == 1),
        )
    )

    # --- Repopulate role tables from role-type viewers/subjects (type=2) ---
    dashboard_roles_t = sa_table(
        "dashboard_roles",
        sa_column("dashboard_id", Integer),
        sa_column("role_id", Integer),
    )
    conn.execute(
        dashboard_roles_t.insert().from_select(
            ["dashboard_id", "role_id"],
            select(dashboard_viewers.c.dashboard_id, subjects.c.role_id)
            .join(subjects, subjects.c.id == dashboard_viewers.c.subject_id)
            .where(subjects.c.type == 2),
        )
    )

    rls_filter_roles_t = sa_table(
        "rls_filter_roles",
        sa_column("role_id", Integer),
        sa_column("rls_filter_id", Integer),
    )
    conn.execute(
        rls_filter_roles_t.insert().from_select(
            ["role_id", "rls_filter_id"],
            select(subjects.c.role_id, rls_filter_subjects.c.rls_filter_id)
            .join(subjects, subjects.c.id == rls_filter_subjects.c.subject_id)
            .where(subjects.c.type == 2),
        )
    )


def upgrade() -> None:
    # 1. Create subjects table
    _create_subjects_table()

    # 2. Create junction tables
    _create_junction_table(DASHBOARD_EDITORS, "dashboard_id", "dashboards")
    _create_junction_table(DASHBOARD_VIEWERS, "dashboard_id", "dashboards")
    _create_junction_table(CHART_EDITORS, "chart_id", "slices")
    _create_junction_table(CHART_VIEWERS, "chart_id", "slices")
    _create_junction_table(SQLATABLE_EDITORS, "table_id", "tables")
    _create_junction_table(
        REPORT_SCHEDULE_EDITORS, "report_schedule_id", "report_schedule"
    )
    _create_junction_table(
        RLS_FILTER_SUBJECTS, "rls_filter_id", "row_level_security_filters"
    )

    # 3. Seed data from existing tables
    _seed_subjects()

    # 4. Drop legacy owner/role junction tables
    _drop_legacy_tables()


def downgrade() -> None:
    # 1. Recreate legacy owner/role tables and repopulate from editors/viewers
    _recreate_legacy_tables()

    # 2. Drop junction tables (they reference subjects)
    for table_name in reversed(JUNCTION_TABLES):
        fk_names = [f"fk_{table_name}_subject_id_subjects"]
        if "dashboard" in table_name:
            fk_names.append(f"fk_{table_name}_dashboard_id_dashboards")
        elif "chart" in table_name:
            fk_names.append(f"fk_{table_name}_chart_id_slices")
        elif "sqlatable" in table_name:
            fk_names.append(f"fk_{table_name}_table_id_tables")
        elif "report_schedule" in table_name:
            fk_names.append(f"fk_{table_name}_report_schedule_id_report_schedule")
        elif "rls_filter" in table_name:
            fk_names.append(f"fk_{table_name}_rls_filter_id_row_level_security_filters")
        drop_fks_for_table(table_name, fk_names)
        drop_table(table_name)

    # 3. Drop subjects table
    drop_fks_for_table(
        SUBJECTS_TABLE,
        [
            "fk_subjects_user_id_ab_user",
            "fk_subjects_role_id_ab_role",
            "fk_subjects_group_id_ab_group",
            "fk_subjects_created_by_fk_ab_user",
            "fk_subjects_changed_by_fk_ab_user",
        ],
    )
    drop_index(SUBJECTS_TABLE, "ix_subjects_label")
    drop_index(SUBJECTS_TABLE, "ix_subjects_extra_search")
    drop_index(SUBJECTS_TABLE, "ix_subjects_user_id")
    drop_index(SUBJECTS_TABLE, "ix_subjects_role_id")
    drop_index(SUBJECTS_TABLE, "ix_subjects_group_id")
    drop_table(SUBJECTS_TABLE)
