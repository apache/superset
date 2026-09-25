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
import uuid
from typing import Any

from flask_appbuilder import Model
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy_utils import UUIDType

from superset.models.helpers import AuditMixinNullable
from superset.utils import json


class SavedWidget(Model, AuditMixinNullable):
    """
    A widget saved on its own, so a host app can embed it by uuid with the
    query fixed server-side. ``dataset_id`` is derived from ``props`` on save
    and lets authorization find the dataset without parsing props.
    """

    __tablename__ = "saved_widgets"

    uuid = Column(UUIDType(binary=True), default=uuid.uuid4, primary_key=True)
    widget_type = Column(String(250), nullable=False)
    title = Column(String(500), nullable=True)
    props = Column(Text, nullable=False, default="{}")
    dataset_id = Column(Integer, nullable=True)

    @property
    def props_dict(self) -> dict[str, Any]:
        try:
            value = json.loads(str(self.props or "{}"))
        except json.JSONDecodeError:
            return {}
        return value if isinstance(value, dict) else {}
