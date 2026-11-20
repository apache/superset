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
"""The canvas and widget APIs exist with CANVAS off, but answer 404."""

from typing import Any

import pytest


@pytest.mark.parametrize("app", [{"FEATURE_FLAGS": {"CANVAS": False}}], indirect=True)
@pytest.mark.parametrize(
    "url",
    ["/api/v1/canvas/", "/api/v1/canvas/schema", "/api/v1/widgets/types"],
)
def test_apis_answer_404_while_canvas_is_off(
    client: Any, full_api_access: None, url: str
) -> None:
    assert client.get(url).status_code == 404


def test_api_permissions_exist_with_canvas_off(app: Any) -> None:
    from superset.extensions import appbuilder

    names = {view.__class__.__name__ for view in appbuilder.baseviews}
    assert {"CanvasRestApi", "WidgetControlsRestApi"} <= names
