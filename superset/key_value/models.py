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
from sqlalchemy import Column, DateTime, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import relationship

from superset import security_manager
from superset.models.helpers import AuditMixinNullable, ImportExportMixin


class KeyValueEntry(Model, AuditMixinNullable, ImportExportMixin):
    """Key value store entity"""

    __tablename__ = "key_value"
    id = Column(Integer, primary_key=True)
    resource = Column(String(32), nullable=False)
    value = Column(LargeBinary(length=2**24 - 1), nullable=False)
    created_on = Column(DateTime, nullable=True)
    created_by_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    changed_on = Column(DateTime, nullable=True)
    expires_on = Column(DateTime, nullable=True)
    changed_by_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    created_by = relationship(security_manager.user_model, foreign_keys=[created_by_fk])
    changed_by = relationship(security_manager.user_model, foreign_keys=[changed_by_fk])
