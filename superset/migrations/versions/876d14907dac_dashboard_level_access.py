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
"""Dashboard level access

Revision ID: 876d14907dac
Revises: f80a3b88324b
Create Date: 2020-08-31 17:47:14.932344

"""

# revision identifiers, used by Alembic.
revision = '876d14907dac'
down_revision = 'f80a3b88324b'

from alembic import op
import sqlalchemy as sa
from superset import db
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    Sequence,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from typing import List, Tuple


def upgrade():
    UpgradeCommand().run()

def downgrade():
    DowngradeCommand().run()


class MigrateCommand:
    def __init__(self, as_opposite=False):
        bind = op.get_bind()
        self.session = db.Session(bind=bind)
        self.__as_opposite = as_opposite

    def __del__(self):
        self.session.close()

    def run(self, done=0):
        how_many_steps = len(self.steps)
        try:
            for i in range(done, how_many_steps):
                self.steps[i]()
        except Exception as ex:
            print(ex)
            self.session.close()
            if self.__as_opposite:
                raise ex
            else:
                self.opposite_command(True).run(i)
                raise ex


class UpgradeCommand(MigrateCommand):
    def __init__(self, as_opposite=False):
        super().__init__(as_opposite)
        self.steps = {0: self.__create_all_dashboards_permissions,
                      1: self.__add_all_dashboards_permissions_to_permitted_roles,
                      2: self.__create_permissions_for_current_dashboards
                      }
        self.opposite_command = DowngradeCommand

    def __create_all_dashboards_permissions(self):
        print('start create_all_dashboards_permissions')
        all_dashboards_view = View(name=Consts.AllDashboard.VIEW_NAME)
        self.session.add(all_dashboards_view)
        access_permission = Permission(name=Consts.AllDashboard.ACCESS_PERMISSION_NAME)
        self.session.add(access_permission)
        self.access_all_dashboards_permission_view = PermissionView(permission=access_permission,
                                                                    view_menu=all_dashboards_view)
        self.session.add(self.access_all_dashboards_permission_view)
        self.session.commit()
        print('done create_all_dashboards_permissions')

    def __add_all_dashboards_permissions_to_permitted_roles(self):
        print("start add_all_dashboards_permissions_to_permitted_roles")
        roles = self.session.query(Role) \
            .join(assoc_permissionview_role) \
            .join(PermissionView) \
            .join(View).filter(View.name == Consts.AllDatasources.VIEW_NAME) \
            .all()
        for role in roles:
            role.permissions.append(self.access_all_dashboards_permission_view)
            self.session.merge(role)
        self.session.commit()
        print("done add_all_dashboards_permissions_to_permitted_roles")

    def __create_permissions_for_current_dashboards(self):
        print("start create_permissions_for_current_dashboards")
        if Consts.Dashboard.ACCESS_PERMISSION_NAME == Consts.AllDashboard.ACCESS_PERMISSION_NAME:
            access_dashboard_permission = self.session.query(Permission).filter(
                Permission.name == Consts.Dashboard.ACCESS_PERMISSION_NAME).first()
        else:
            access_dashboard_permission = Permission(name=Consts.Dashboard.ACCESS_PERMISSION_NAME)
            self.session.add(access_dashboard_permission)

        dashboards = self.session.query(Dashboard).all()
        for dashboard in dashboards:
            dashboard_view = View(name=dashboard.view_name)
            self.session.add(dashboard_view)
            dashboard_permission_view = PermissionView(permission=access_dashboard_permission, view_menu=dashboard_view)
            self.session.add(dashboard_permission_view)
        self.session.commit()
        print("done create_permissions_for_current_dashboards")

    def __add_dashboards_permissions_to_permitted_roles(self):
        pass


class DowngradeCommand(MigrateCommand):
    def __init__(self, as_opposite=False):
        super().__init__(as_opposite)
        self.steps = {0: self.__delete_dashboard_permissions,
                      1: self.__remove_all_dashboards_permissions_from_roles,
                      2: self.__delete_all_dashboards_permissions
                      }
        self.opposite_command = UpgradeCommand

    def __remove_dashboards_permissions_from_roles(self):
        pass

    def __delete_dashboard_permissions(self):
        print("start delete_dashboard_permissions")
        dash_pvms = self.session.query(PermissionView) \
            .join(Permission)\
            .join(View)\
            .filter(Permission.name == Consts.Dashboard.ACCESS_PERMISSION_NAME, View.name != Consts.AllDashboard.VIEW_NAME)\
            .all()
        dash_views = list(map(lambda pv: pv.view_menu, dash_pvms))
        for pv in dash_pvms:
            self.session.delete(pv)
        for view in dash_views:
            self.session.delete(view)
        if Consts.Dashboard.ACCESS_PERMISSION_NAME != Consts.AllDashboard.ACCESS_PERMISSION_NAME:
            dashboard_access_permission = self.session.query(Permission).filter(
                Permission.name == Consts.Dashboard.ACCESS_PERMISSION_NAME)
            self.session.delete(dashboard_access_permission)
        self.session.commit()
        print("done delete_dashboard_permissions")

    def __remove_all_dashboards_permissions_from_roles(self):
        print("start remove_all_dashboards_permissions_from_roles")
        self.access_all_dashboards_permission_view = self.session.query(PermissionView).join(View).filter(
            View.name == Consts.AllDashboard.VIEW_NAME).one()
        roles = self.session.query(Role) \
            .join(assoc_permissionview_role) \
            .join(PermissionView) \
            .join(View) \
            .filter(View.name == Consts.AllDashboard.VIEW_NAME) \
            .all()
        for role in roles:
            role.permissions.remove(self.access_all_dashboards_permission_view)
            self.session.merge(role)
        self.session.commit()
        print("done remove_all_dashboards_permissions_from_roles")

    def __delete_all_dashboards_permissions(self):
        print("start delete_all_dashboards_permissions")
        self.session.delete(self.access_all_dashboards_permission_view)
        view = self.session.query(View).filter(View.name == Consts.AllDashboard.VIEW_NAME).one()
        self.session.delete(view)
        permission = self.session.query(Permission).filter(Permission.name == Consts.AllDashboard.ACCESS_PERMISSION_NAME).one()
        self.session.delete(permission)
        self.session.commit()
        print("done delete_all_dashboards_permissions")


Base = declarative_base()


class Dashboard(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "dashboards"
    id = Column(Integer, primary_key=True)
    published = Column(Boolean, default=False)
    dashboard_title = Column(String(500))

    @property
    def view_name(self) -> str:
        return Consts.Dashboard.VIEW_NAME_FORMAT.format(obj=self)

    @property
    def permission_view_pairs(self) -> List[Tuple[str, str]]:
        return [(Consts.Dashboard.ACCESS_PERMISSION_NAME, self.view_name)]

    def __repr__(self) -> str:
        return self.dashboard_title or str(self.id)


class Permission(Base):
    __tablename__ = "ab_permission"
    id = Column(Integer, Sequence("ab_permission_id_seq"), primary_key=True)
    name = Column(String(100), unique=True, nullable=False)

    def __repr__(self):
        return self.name


class View(Base):
    __tablename__ = "ab_view_menu"
    id = Column(Integer, Sequence("ab_view_menu_id_seq"), primary_key=True)
    name = Column(String(250), unique=True, nullable=False)

    def __eq__(self, other):
        return (isinstance(other, self.__class__)) and (self.name == other.name)

    def __neq__(self, other):
        return self.name != other.name

    def __repr__(self):
        return self.name


class PermissionView(Base):
    __tablename__ = "ab_permission_view"
    __table_args__ = (UniqueConstraint("permission_id", "view_menu_id"),)
    id = Column(Integer, Sequence("ab_permission_view_id_seq"), primary_key=True)
    permission_id = Column(Integer, ForeignKey("ab_permission.id"))
    permission = relationship("Permission")
    view_menu_id = Column(Integer, ForeignKey("ab_view_menu.id"))
    view_menu = relationship("View")

    def __repr__(self):
        return str(self.permission).replace("_", " ") + " on " + str(self.view_menu)


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

    def __repr__(self):
        return self.name


class Consts:
    DASHBOARD_LEVEL_ACCESS_FEATURE = "DASHBOARD_LEVEL_ACCESS"

    class AllDashboard:
        VIEW_NAME = "all_dashboards"
        ACCESS_PERMISSION_NAME = "can_access_dashboard"
        EDIT_PERMISSION_NAME = "can_edit"

    class Dashboard:
        VIEW_NAME_FORMAT = "dashboard.[{obj.dashboard_title}](id:{obj.id})"
        ACCESS_PERMISSION_NAME = "can_access_dashboard"

    class AllDatasources:
        VIEW_NAME = "all_datasource_access"