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

import os
from typing import Protocol


class DevelocityConfiguration(Protocol):
    """The attributes of the agent's configuration object set below."""

    develocity_url: str | None
    project_name: str | None
    project_id: str | None
    tags: set[str]
    custom_values: dict[str, str]


def develocity_configuration(
    configuration: DevelocityConfiguration,
) -> DevelocityConfiguration:
    configuration.develocity_url = "https://develocity.apache.org"
    configuration.project_name = "superset"
    configuration.project_id = "superset"
    if "GITHUB_ACTIONS" in os.environ:
        configuration.tags.add("CI")
        configuration.custom_values["CI_commit_sha"] = os.environ.get("GITHUB_SHA", "")
        configuration.custom_values["CI_run"] = os.environ.get("GITHUB_RUN_ID", "")
    else:
        configuration.tags.add("Local")
    return configuration
