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

"""SQLAlchemy models for extension settings persistence."""

from flask_appbuilder import Model
from sqlalchemy import Boolean, Column, Integer, String

# Shared column length for extension/chatbot identifiers; reused by request
# validation so oversized keys are rejected with a 400 before hitting the DB.
EXTENSION_ID_MAX_LENGTH = 250


class ExtensionSettings(Model):  # pylint: disable=too-few-public-methods
    """Global admin settings for extensions (singleton row, id=1)."""

    __tablename__ = "extension_settings"
    id = Column(Integer, primary_key=True)
    active_chatbot_id = Column(String(EXTENSION_ID_MAX_LENGTH), nullable=True)


class ExtensionEnabled(Model):  # pylint: disable=too-few-public-methods
    """Per-extension enable/disable flag."""

    __tablename__ = "extension_enabled"
    extension_id = Column(String(EXTENSION_ID_MAX_LENGTH), primary_key=True)
    enabled = Column(Boolean, nullable=False, default=True)
