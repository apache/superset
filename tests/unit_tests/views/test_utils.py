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

from superset.views.utils import (
    get_form_data,
    JS_CONTROL_FORM_DATA_KEYS,
    REJECTED_FORM_DATA_KEYS,
)


def test_rejected_form_data_keys_cover_all_js_control_keys() -> None:
    """
    With ENABLE_JAVASCRIPT_CONTROLS disabled (the default), every form_data key
    that is later executed as JavaScript by the deck.gl charts must be rejected.

    This guards against a new ``sandboxedEval(fd.<key>)`` call site being added
    without also adding its key to the strip list.
    """
    # The test app keeps ENABLE_JAVASCRIPT_CONTROLS at its default (off).
    assert set(JS_CONTROL_FORM_DATA_KEYS) <= set(REJECTED_FORM_DATA_KEYS)


def test_get_form_data_strips_js_control_keys() -> None:
    """get_form_data drops all JS-executed keys when the flag is disabled."""
    initial_form_data = dict.fromkeys(JS_CONTROL_FORM_DATA_KEYS, "data => data")
    initial_form_data["viz_type"] = "deck_geojson"

    form_data, _ = get_form_data(initial_form_data=initial_form_data)

    for key in JS_CONTROL_FORM_DATA_KEYS:
        assert key not in form_data
    # Non-JS keys are preserved.
    assert form_data["viz_type"] == "deck_geojson"
