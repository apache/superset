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
from typing import Optional, Type, TYPE_CHECKING

from flask import Markup
from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String

from superset import app, db, security_manager
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models.helpers import AuditMixinNullable
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.connectors.base.models import (  # pylint: disable=unused-import
        BaseDatasource,
    )

config = app.config


class DatasourceAccessRequest(Model, AuditMixinNullable):
    """ORM model for the access requests for datasources and dbs."""

    __tablename__ = "access_request"
    id = Column(Integer, primary_key=True)  # pylint: disable=invalid-name

    datasource_id = Column(Integer)
    datasource_type = Column(String(200))

    ROLES_BLACKLIST = set(config["ROBOT_PERMISSION_ROLES"])

    @property
    def cls_model(self) -> Type["BaseDatasource"]:
        return ConnectorRegistry.sources[self.datasource_type]

    @property
    def username(self) -> Markup:
        return self.creator()

    @property
    def datasource(self) -> "BaseDatasource":
        return self.get_datasource

    @datasource.getter  # type: ignore
    @utils.memoized
    def get_datasource(self) -> "BaseDatasource":
        ds = db.session.query(self.cls_model).filter_by(id=self.datasource_id).first()
        return ds

    @property
    def datasource_link(self) -> Optional[Markup]:
        return self.datasource.link  # pylint: disable=no-member

    @property
    def roles_with_datasource(self) -> str:
        action_list = ""
        perm = self.datasource.perm  # pylint: disable=no-member
        pv = security_manager.find_permission_view_menu("datasource_access", perm)
        for role in pv.role:
            if role.name in self.ROLES_BLACKLIST:
                continue
            # pylint: disable=no-member
            href = (
                f"/superset/approve?datasource_type={self.datasource_type}&"
                f"datasource_id={self.datasource_id}&"
                f"created_by={self.created_by.username}&role_to_grant={role.name}"
            )
            link = '<a href="{}">Grant {} Role</a>'.format(href, role.name)
            action_list = action_list + "<li>" + link + "</li>"
        return "<ul>" + action_list + "</ul>"

    @property
    def user_roles(self) -> str:
        action_list = ""
        for role in self.created_by.roles:  # pylint: disable=no-member
            # pylint: disable=no-member
            href = (
                f"/superset/approve?datasource_type={self.datasource_type}&"
                f"datasource_id={self.datasource_id}&"
                f"created_by={self.created_by.username}&role_to_extend={role.name}"
            )
            link = '<a href="{}">Extend {} Role</a>'.format(href, role.name)
            if role.name in self.ROLES_BLACKLIST:
                link = "{} Role".format(role.name)
            action_list = action_list + "<li>" + link + "</li>"
        return "<ul>" + action_list + "</ul>"
