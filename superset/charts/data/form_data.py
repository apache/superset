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

from typing import Any, TYPE_CHECKING

from flask import g

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext


def set_form_data(form_data: dict[str, Any]) -> None:
    """Expose chart data request fields to Jinja template macros."""
    g.form_data = form_data


def set_query_context_form_data(
    query_context: QueryContext,
    datasource_id: int,
    datasource_type: str,
) -> None:
    """Expose a programmatically-created query like a chart data API request."""
    set_form_data(
        {
            "datasource": {"id": datasource_id, "type": datasource_type},
            "queries": [
                query.to_dict() for query in getattr(query_context, "queries", [])
            ],
            "form_data": getattr(query_context, "form_data", None) or {},
        }
    )
