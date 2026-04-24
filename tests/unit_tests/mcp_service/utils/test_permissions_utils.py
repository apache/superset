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

"""Tests for MCP field-level permission helpers."""

from unittest.mock import Mock

from superset.mcp_service.utils.permissions_utils import (
    apply_field_permissions_to_columns,
    filter_sensitive_data,
    get_allowed_fields,
)


def test_get_allowed_fields_always_denies_user_directory_fields():
    user = Mock()
    user.roles = []

    allowed_fields = get_allowed_fields(
        "dashboard",
        user=user,
        requested_fields=["id", "dashboard_title", "owners", "roles", "created_by"],
    )

    assert allowed_fields == {"id", "dashboard_title"}


def test_filter_sensitive_data_strips_user_directory_fields_even_if_allowed():
    data = {
        "id": 1,
        "dashboard_title": "Executive Dashboard",
        "owners": [{"username": "admin"}],
        "roles": [{"name": "Admin"}],
        "created_by": "admin",
    }

    filtered = filter_sensitive_data(
        data,
        "dashboard",
        allowed_fields=set(data),
    )

    assert filtered == {
        "id": 1,
        "dashboard_title": "Executive Dashboard",
    }


def test_apply_field_permissions_to_columns_omits_user_directory_fields():
    user = Mock()
    user.roles = []

    columns = apply_field_permissions_to_columns(
        ["id", "slice_name", "owners", "changed_by_fk"],
        "chart",
        user=user,
    )

    assert columns == ["id", "slice_name"]
