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

import re  # noqa: E402

from alembic import op  # noqa: E402
from sqlalchemy import (  # noqa: E402
    Column,
    ForeignKey,
    Integer,
    orm,
    Sequence,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402
from sqlalchemy.orm import backref, relationship  # noqa: E402

Base = declarative_base()

# Partial freeze of the current metadata db schema


class Permission(Base):
    __tablename__ = "ab_permission"
    id = Column(Integer, Sequence("ab_permission_id_seq"), primary_key=True)
    name = Column(String(100), unique=True, nullable=False)


class ViewMenu(Base):
    __tablename__ = "ab_view_menu"
    id = Column(Integer, Sequence("ab_view_menu_id_seq"), primary_key=True)
    name = Column(String(250), unique=True, nullable=False)

    def __eq__(self, other):
        return (isinstance(other, self.__class__)) and (self.name == other.name)

    def __neq__(self, other):
        return self.name != other.name


assoc_permissionview_role = Table(
    "ab_permission_view_role",
    Base.metadata,
    Column("id", Integer, Sequence("ab_permission_view_role_id_seq"), primary_key=True),
    Column("permission_view_id", Integer, ForeignKey("ab_permission_view.id")),
    Column("role_id", Integer, ForeignKey("ab_role.id")),
    UniqueConstraint("permission_view_id", "role_id"),
)


class Role(Base):
    __tablename__ = "ab_role"

    id = Column(Integer, Sequence("ab_role_id_seq"), primary_key=True)
    name = Column(String(64), unique=True, nullable=False)
    permissions = relationship(
        "PermissionView", secondary=assoc_permissionview_role, backref="role"
    )


class PermissionView(Base):
    __tablename__ = "ab_permission_view"
    __table_args__ = (UniqueConstraint("permission_id", "view_menu_id"),)
    id = Column(Integer, Sequence("ab_permission_view_id_seq"), primary_key=True)
    permission_id = Column(Integer, ForeignKey("ab_permission.id"))
    permission = relationship("Permission")
    view_menu_id = Column(Integer, ForeignKey("ab_view_menu.id"))
    view_menu = relationship("ViewMenu")


sqlatable_user = Table(
    "sqlatable_user",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id")),
    Column("table_id", Integer, ForeignKey("tables.id")),
)


class Database(Base):  # pylint: disable=too-many-public-methods
    """An ORM object that stores Database related information"""

    __tablename__ = "dbs"
    __table_args__ = (UniqueConstraint("database_name"),)

    id = Column(Integer, primary_key=True)
    verbose_name = Column(String(250), unique=True)
    # short unique name, used in permissions
    database_name = Column(String(250), unique=True, nullable=False)

    def __repr__(self) -> str:
        return self.name

    @property
    def name(self) -> str:
        return self.verbose_name if self.verbose_name else self.database_name


class SqlaTable(Base):
    __tablename__ = "tables"
    __table_args__ = (UniqueConstraint("database_id", "table_name"),)

    # Base columns from Basedatasource
    id = Column(Integer, primary_key=True)
    table_name = Column(String(250), nullable=False)
    database_id = Column(Integer, ForeignKey("dbs.id"), nullable=False)
    database = relationship(
        "Database",
        backref=backref("tables", cascade="all, delete-orphan"),
        foreign_keys=[database_id],
    )

    def get_perm(self) -> str:
        return f"[{self.database}].[{self.table_name}](id:{self.id})"


def upgrade():
    """
    Previous sqla_viz behaviour when creating a virtual dataset was faulty
    by creating an associated data access permission with [None] on the database name.

    This migration revision, fixes all faulty permissions that may exist on the db
    Only fixes permissions that still have an associated dataset (fetch by id)
    and replaces them with the current (correct) permission name
    """

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
        # Get the dataset id from the view_menu name
        match_ds_id = re.match(r"\[None\]\.\[.*\]\(id:(\d+)\)", faulty_view_menu.name)
        if match_ds_id:
            dataset_id = int(match_ds_id.group(1))
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
                # A view_menu permission with the right name already exists,
                # so delete the faulty one later
                if existing_view_menu:
                    orphaned_faulty_view_menus.append(faulty_view_menu)
                # No view_menu permission with this name exists
                # so safely change this one
                else:
                    faulty_view_menu.name = new_view_menu
    # Commit all view_menu updates
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
            # Now it's safe to remove the pvm pair
            session.delete(pvm)
        # finally remove the orphaned view_menu permission
        session.delete(orphaned_faulty_view_menu)

    try:
        session.commit()
    except SQLAlchemyError:
        session.rollback()


def downgrade():
    pass
