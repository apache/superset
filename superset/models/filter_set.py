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
from __future__ import annotations

import json
import logging
from typing import Any, Dict

from flask import current_app
from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, MetaData, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy_utils import generic_relationship

from superset import app, db
from superset.models.helpers import AuditMixinNullable

metadata = Model.metadata  # pylint: disable=no-member
config = app.config
logger = logging.getLogger(__name__)


class FilterSet(Model, AuditMixinNullable):
    __tablename__ = "filter_sets"
    id = Column(Integer, primary_key=True)
    name = Column(String(500), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    json_metadata = Column(Text, nullable=False)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"))
    dashboard = relationship("Dashboard", back_populates="_filter_sets")
    owner_id = Column(Integer, nullable=False)
    owner_type = Column(String(255), nullable=False)
    owner_object = generic_relationship(owner_type, owner_id)

    def __repr__(self) -> str:
        return f"FilterSet<{self.name or self.id}>"

    @property
    def url(self) -> str:
        return f"/api/filtersets/{self.id}/"

    @property
    def sqla_metadata(self) -> None:
        # pylint: disable=no-member
        with self.get_sqla_engine_with_context() as engine:
            meta = MetaData(bind=engine)
            meta.reflect()

    @property
    def changed_by_name(self) -> str:
        if not self.changed_by:
            return ""
        return str(self.changed_by)

    @property
    def changed_by_url(self) -> str:
        if (
            not self.changed_by
            or not current_app.config["ENABLE_BROAD_ACTIVITY_ACCESS"]
        ):
            return ""
        return f"/superset/profile/{self.changed_by.username}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "params": self.params,
            "dashboard_id": self.dashboard_id,
            "owner_type": self.owner_type,
            "owner_id": self.owner_id,
        }

    @classmethod
    def get(cls, _id: int) -> FilterSet:
        session = db.session()
        qry = session.query(FilterSet).filter(_id)
        return qry.one_or_none()

    @classmethod
    def get_by_name(cls, name: str) -> FilterSet:
        session = db.session()
        qry = session.query(FilterSet).filter(FilterSet.name == name)
        return qry.one_or_none()

    @classmethod
    def get_by_dashboard_id(cls, dashboard_id: int) -> FilterSet:
        session = db.session()
        qry = session.query(FilterSet).filter(FilterSet.dashboard_id == dashboard_id)
        return qry.all()

    @property
    def params(self) -> Dict[str, Any]:
        if self.json_metadata:
            return json.loads(self.json_metadata)
        return {}
