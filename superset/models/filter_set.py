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
from sqlalchemy_utils import generic_relationship
import json
import logging
from typing import Any, Dict
from flask_appbuilder import Model
from sqlalchemy import (
    Column,
    Integer,
    MetaData,
    String,
    Text,
    ForeignKey,
)
from sqlalchemy.sql.elements import BinaryExpression
from sqlalchemy.orm import relationship
from superset import app, db
from superset.models.helpers import AuditMixinNullable


# pylint: disable=too-many-public-methods

metadata = Model.metadata  # pylint: disable=no-member
config = app.config
logger = logging.getLogger(__name__)


class FilterSet(  # pylint: disable=too-many-instance-attributes
    Model, AuditMixinNullable
):
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

    def __init__(self) -> None:
        super().__init__()

    def __repr__(self) -> str:
        return f"FilterSet<{self.name or self.id}>"

    @property
    def url(self) -> str:
        return f"/api/filtersets/{self.slug or self.id}/"

    @property
    def sqla_metadata(self) -> None:
        # pylint: disable=no-member
        meta = MetaData(bind=self.get_sqla_engine())
        meta.reflect()

    @property
    def changed_by_name(self) -> str:
        if not self.changed_by:
            return ""
        return str(self.changed_by)

    @property
    def changed_by_url(self) -> str:
        if not self.changed_by:
            return ""
        return f"/superset/profile/{self.changed_by.username}"

    @property
    def data(self) -> Dict[str, Any]:
        json_metadata = self.json_metadata
        if json_metadata:
            json_metadata = json.loads(json_metadata)
        return {
            "id": self.id,
            "metadata": json_metadata,
            "name": self.name,
            "last_modified_time": self.changed_on.replace(microsecond=0).timestamp(),
        }

    @classmethod
    def get(cls, id_or_slug: str) -> FilterSet:
        session = db.session()
        qry = session.query(FilterSet).filter(id_or_slug_filter(id_or_slug))
        return qry.one_or_none()


def id_or_slug_filter(id_or_slug: str) -> BinaryExpression:
    if id_or_slug.isdigit():
        return FilterSet.id == int(id_or_slug)
    return FilterSet.slug == id_or_slug
