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

import pytest
from superset_core.mcp import decorators


def test_tool_accepts_mcp_apps_settings_and_waits_for_the_host() -> None:
    with pytest.raises(NotImplementedError):
        decorators.tool(
            meta={"ui": {"resourceUri": "ui://superset/viewer"}},
            app={"visibility": ["model"]},
        )


def test_resource_waits_for_the_host() -> None:
    with pytest.raises(NotImplementedError):
        decorators.resource("viewer", version="v1")


def test_content_version_waits_for_the_host() -> None:
    with pytest.raises(NotImplementedError):
        decorators.content_version("<!doctype html>")
