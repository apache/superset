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
from superset_core.widgets import BindingRequest, Widget, WidgetDataRefusedError


def test_a_refusal_carries_its_code_and_message() -> None:
    refused = WidgetDataRefusedError("CONTENT_CHANGED", "Reload to see it")

    assert (refused.code, refused.message) == ("CONTENT_CHANGED", "Reload to see it")
    assert str(refused) == "Reload to see it"


def test_a_refusal_needs_a_code() -> None:
    with pytest.raises(ValueError, match="needs a code"):
        WidgetDataRefusedError("", "Reload")


def test_a_widget_type_leaves_its_bindings_to_the_host_by_default() -> None:
    request = BindingRequest(None, None, {"dataBinding": {"datasetId": 1}})

    assert Widget.build_bindings(request) is None


def test_a_request_names_no_draft_or_version_unless_it_has_them() -> None:
    request = BindingRequest("7", "chart-1", {})

    assert request.widget_id is None
    assert request.canvas_draft_token is None
    assert request.canvas_version is None
