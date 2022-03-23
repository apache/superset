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
from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlalchemy.orm import backref, relationship
from sqlalchemy_utils import UUIDType

from superset.models.dashboard import Dashboard
from superset.models.helpers import AuditMixinNullable


class EmbeddedDashboard(
    Model, AuditMixinNullable
):  # pylint: disable=too-few-public-methods

    """
    A configuration of embedding for a dashboard
    """

    __tablename__ = "embedded_dashboards"

    uuid = Column(UUIDType(binary=True))
    allow_domain_list = Column(Text)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    dashboard = relationship(
        Dashboard,
        backref=backref("embedded", cascade="all,delete,delete-orphan"),
        foreign_keys=[dashboard_id],
    )
