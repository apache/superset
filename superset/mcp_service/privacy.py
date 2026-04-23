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

"""Privacy helpers for MCP user-directory and access-list metadata."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

USER_DIRECTORY_FIELDS = frozenset(
    {
        "changed_by",
        "changed_by_fk",
        "changed_by_name",
        "created_by",
        "created_by_fk",
        "created_by_name",
        "last_saved_by",
        "last_saved_by_fk",
        "last_saved_by_name",
        "owner",
        "owners",
        "roles",
    }
)


def filter_user_directory_fields(data: dict[str, Any]) -> dict[str, Any]:
    """Remove fields that expose users, roles, owners, or access metadata."""
    return {
        key: value for key, value in data.items() if key not in USER_DIRECTORY_FIELDS
    }


def filter_user_directory_columns(columns: Iterable[str]) -> list[str]:
    """Remove user-directory columns while preserving order."""
    return [column for column in columns if column not in USER_DIRECTORY_FIELDS]
