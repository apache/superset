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

"""
Query model API for superset-core.

Provides query-related model classes that will be replaced by host implementations
during initialization for extension developers to use.

Usage:
    from superset_core.queries.models import Query, SavedQuery
"""

from __future__ import annotations

from uuid import UUID

from superset_core.common.models import CoreModel


class Query(CoreModel):
    """
    Abstract Query model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    client_id: str | None
    database_id: int | None
    sql: str | None
    status: str | None
    user_id: int | None
    progress: int
    error_message: str | None


class SavedQuery(CoreModel):
    """
    Abstract SavedQuery model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    uuid: UUID | None
    label: str | None
    sql: str | None
    database_id: int | None
    description: str | None
    user_id: int | None


__all__ = [
    "Query",
    "SavedQuery",
]
