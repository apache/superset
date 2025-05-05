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
import json
from base64 import b64decode

from flask_appbuilder import Model
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from superset import security_manager
from superset.extensions.types import Manifest
from superset.models.helpers import AuditMixinNullable, ImportExportMixin


def _decode_assets(value: str | None) -> dict[str, bytes] | None:
    if not value:
        return None

    return {file: b64decode(contents) for file, contents in json.loads(value).items()}


class Extension(AuditMixinNullable, ImportExportMixin, Model):
    """Model for Superset Extensions"""

    __tablename__ = "extensions"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    manifest = Column(Text(), nullable=False)
    frontend = Column(Text(), nullable=False)
    backend = Column(Text(), nullable=False)
    enabled = Column(Boolean(), nullable=False)
    created_on = Column(DateTime, nullable=True)
    created_by_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    changed_on = Column(DateTime, nullable=True)
    changed_by_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    created_by = relationship(security_manager.user_model, foreign_keys=[created_by_fk])
    changed_by = relationship(security_manager.user_model, foreign_keys=[changed_by_fk])

    @property
    def frontend_dict(self) -> dict[str, bytes] | None:
        return _decode_assets(self.frontend)

    @property
    def backend_dict(self) -> dict[str, bytes] | None:
        return _decode_assets(self.backend)

    @property
    def manifest_dict(self) -> Manifest:
        return json.loads(self.manifest)
