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
"""Tests for config-based permission extension hooks.

Follows the same pattern as EXTRA_DYNAMIC_QUERY_FILTERS tests in
tests/unit_tests/databases/api_test.py.
"""

from unittest.mock import Mock


def test_raise_for_access_bypass_skips_checks(app_context: None, monkeypatch):
    """EXTRA_RAISE_FOR_ACCESS_BYPASS returning True skips all permission checks."""
    from flask import current_app

    from superset import security_manager

    bypass_mock = Mock(return_value=True)
    monkeypatch.setitem(
        current_app.config, "EXTRA_RAISE_FOR_ACCESS_BYPASS", bypass_mock
    )

    security_manager.raise_for_access(dashboard=None, chart=None)
    assert bypass_mock.call_count == 1


def test_raise_for_access_no_bypass_without_config(app_context: None, monkeypatch):
    """Without EXTRA_RAISE_FOR_ACCESS_BYPASS, normal checks proceed."""
    from flask import current_app

    from superset import security_manager

    monkeypatch.setitem(current_app.config, "EXTRA_RAISE_FOR_ACCESS_BYPASS", None)
    security_manager.raise_for_access(dashboard=None, chart=None)
