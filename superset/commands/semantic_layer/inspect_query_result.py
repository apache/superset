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
from __future__ import annotations

from datetime import datetime, timezone

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.semantic_layer.refresh_metadata import inspect_derived_entry
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.semantic_layers.cache_inspection import CacheEntryInfo
from superset.semantic_layers.result_inspection import captured_result_key


class InspectQueryResultCommand(BaseCommand):
    """Inspect a host-prepared query using its existing contextual/RLS authority.

    The caller supplies the normalized QueryContext used for query execution,
    not a raw cache key. This command never creates a context, resolves provider
    fields or executes a query. Annotation-specific entries are unsupported.
    """

    def __init__(self, context: QueryContext, query_index: int) -> None:
        self._context: QueryContext = context
        self._query_index: int = query_index

    def validate(self) -> None:
        security_manager.raise_for_access(query_context=self._context)
        if not 0 <= self._query_index < len(self._context.queries):
            raise ValueError("Invalid query index")

    def run(self) -> CacheEntryInfo:
        self.validate()
        query: QueryObject = self._context.queries[self._query_index]
        key: str | None = captured_result_key(self._context, query)
        if key is None:
            return CacheEntryInfo(
                "query_result", "unsupported", datetime.now(timezone.utc)
            )
        return inspect_derived_entry(key, "query_result")
