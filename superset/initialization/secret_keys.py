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

from typing import Any, TYPE_CHECKING

import superset.extensions as extensions

if TYPE_CHECKING:
    from superset.app import SupersetApp

empty = object()


def configure(app: SupersetApp) -> None:
    keys_management_factory = app.config.get("SECRET_KEYS_MANAGEMENT_FACTORY", empty)
    validate_factory_value(keys_management_factory)
    keys_management = keys_management_factory()
    extensions.secrets_manager = keys_management


def validate_factory_value(keys_management_factory: Any) -> None:
    if keys_management_factory == empty:
        raise Exception("SECRET_KEYS_MANAGEMENT_FACTORY must be set")
    if not callable(keys_management_factory):
        raise Exception("SECRET_KEYS_MANAGEMENT_FACTORY must callable")
