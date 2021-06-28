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

from typing import Dict, TYPE_CHECKING

from keys_management import EnvironemtType, KeysManagementImpl

from superset.exceptions import SupersetException

if TYPE_CHECKING:
    from superset.app import SupersetApp


def configure(app: SupersetApp) -> None:
    keys_management_configurations = app.config.get("SECRET_KEYS_MANAGEMENT", {})
    keys_management = KeysManagementImpl(
        environemt_type=determine_environment_type(keys_management_configurations)
    )
    app.keys_management = keys_management


def determine_environment_type(
    keys_management_configurations: Dict[str, str]
) -> EnvironemtType:
    environment_type = keys_management_configurations.get("ENVIRONMENT_TYPE", "single")
    try:
        return EnvironemtType[environment_type.upper()]
    except KeyError as ex:
        raise SupersetException("environment_type config value is invalid", ex)
