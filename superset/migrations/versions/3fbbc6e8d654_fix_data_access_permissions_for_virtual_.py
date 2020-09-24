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
"""fix data access permissions for virtual datasets

Revision ID: 3fbbc6e8d654
Revises: e5ef6828ac4e
Create Date: 2020-09-24 12:04:33.827436

"""

# revision identifiers, used by Alembic.
revision = "3fbbc6e8d654"
down_revision = "e5ef6828ac4e"

import re

from alembic import op
from sqlalchemy import orm
from sqlalchemy.exc import SQLAlchemyError


def upgrade():
    """
    Previous sqla_viz behaviour when creating a virtual dataset was faulty
    by creating an associated data access permission with [None] on the database name.

    This migration revision, fixes all faulty permissions that may exist on the db
    Only fixes permissions that still have an associated dataset (fetch by id)
    and replaces them with the current (correct) permission name
    """
    from flask_appbuilder.security.sqla.models import (
        ViewMenu,
        PermissionView,
        Role,
        Permission,
    )
    from superset.connectors.sqla.models import SqlaTable

    bind = op.get_bind()
    session = orm.Session(bind=bind)

    faulty_view_menus = (
        session.query(ViewMenu)
        .join(PermissionView)
        .join(Permission)
        .filter(ViewMenu.name.ilike("[None].[%](id:%)"))
        .filter(Permission.name == "datasource_access")
        .all()
    )
    orphaned_faulty_view_menus = []
    for faulty_view_menu in faulty_view_menus:
        match_ds_id = re.match("\[None\]\.\[.*\]\(id:(.*)\)", faulty_view_menu.name)
        if match_ds_id:
            try:
                dataset_id = int(match_ds_id.group(1))
            except ValueError:
                continue
            dataset = session.query(SqlaTable).get(dataset_id)
            if dataset:
                try:
                    new_view_menu = dataset.get_perm()
                except Exception:
                    # This can fail on differing SECRET_KEYS
                    return
                existing_view_menu = (
                    session.query(ViewMenu)
                    .filter(ViewMenu.name == new_view_menu)
                    .one_or_none()
                )
                # A permission with the right name already exists,
                # so delete the faulty one later
                if existing_view_menu:
                    orphaned_faulty_view_menus.append(existing_view_menu)
                else:
                    faulty_view_menu.name = new_view_menu
    # Commit all possible changes
    try:
        session.commit()
    except SQLAlchemyError:
        session.rollback()
    # Delete all orphaned faulty permissions
    for orphaned_faulty_view_menu in orphaned_faulty_view_menus:
        pvm = (
            session.query(PermissionView)
            .filter(PermissionView.view_menu == orphaned_faulty_view_menu)
            .one_or_none()
        )
        if pvm:
            # Removes orphaned pvm from all roles
            roles = session.query(Role).filter(Role.permissions.contains(pvm)).all()
            for role in roles:
                if pvm in role.permissions:
                    role.permissions.remove(pvm)
            session.delete(pvm)
        session.delete(orphaned_faulty_view_menu)

    try:
        session.commit()
    except SQLAlchemyError:
        session.rollback()


def downgrade():
    pass
