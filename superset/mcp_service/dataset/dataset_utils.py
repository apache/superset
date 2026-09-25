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

"""Shared helpers for dataset MCP tools."""

from typing import Any

from superset.mcp_service.utils import _is_uuid


def resolve_dataset(
    identifier: int | str, eager_options: list[Any] | None = None
) -> Any | None:
    """Resolve a dataset by int ID or UUID string.

    Replicates the identifier resolution logic from ModelGetInfoCore._find_object().
    """
    from superset.daos.dataset import DatasetDAO

    opts = eager_options or None

    if isinstance(identifier, int):
        return DatasetDAO.find_by_id(identifier, query_options=opts)

    # Try parsing as int
    try:
        id_val = int(identifier)
        return DatasetDAO.find_by_id(id_val, query_options=opts)
    except (ValueError, TypeError):
        pass

    # Try UUID
    if _is_uuid(str(identifier)):
        return DatasetDAO.find_by_id(identifier, id_column="uuid", query_options=opts)

    return None
