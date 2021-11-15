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
from datetime import datetime

from flask_appbuilder import Model
from sqlalchemy import Boolean, Column, DateTime, String, ForeignKey, Integer, Text

# TODO: Inherit from helpers.py/AuditMixinNullable
class KeyValue(Model):

    """Key value store entity"""

    __tablename__ = "key_value"
    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=False)
    created_by_fk = Column(Integer, ForeignKey("ab_user.id"))
    created_on = Column(DateTime, default=datetime.utcnow)
    duration_ms = Column(Integer, nullable=True)
    reset_duration_on_retrieval = Column(Boolean, nullable=False, default=True)
    retrieved_on = Column(DateTime, default=datetime.utcnow)
