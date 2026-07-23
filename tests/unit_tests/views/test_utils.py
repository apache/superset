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
"""Tests for superset.views.utils module"""

from flask import current_app

from superset.views.utils import get_form_data


def test_get_form_data_handles_non_json_body_with_json_content_type() -> None:
    """get_form_data returns gracefully when Content-Type claims JSON but the
    body isn't parseable JSON, instead of letting Werkzeug's BadRequest escape.

    This is the shape of the request context an MCP tool call runs in when a
    chart/dataset SQL template calls the ``filter_values()`` Jinja macro: the
    Content-Type header says ``application/json`` but the body is not a JSON
    chart-data payload.
    """
    with current_app.test_request_context(
        data="not-json-at-all", content_type="application/json"
    ):
        form_data, slc = get_form_data()

    assert form_data == {}
    assert slc is None


def test_get_form_data_handles_non_dict_json_body() -> None:
    """get_form_data coerces a well-formed but non-object JSON body to {}.

    ``request.get_json()`` happily returns a scalar or list for valid JSON
    that isn't a JSON object (e.g. ``null`` or ``42``). Downstream code treats
    the parsed body as a mapping, so a non-dict result must not leak through.
    """
    with current_app.test_request_context(data="42", content_type="application/json"):
        form_data, slc = get_form_data()

    assert form_data == {}
    assert slc is None
