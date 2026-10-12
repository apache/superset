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

from typing import Any


def apply_time_grain_to_base_axis(
    query: dict[str, Any],
    time_grain: str,
) -> None:
    """Propagate a time grain override onto the query's ``BASE_AXIS`` column.

    Charts built on Generic Chart Axes carry their temporal x-axis as an adhoc
    column in ``columns`` whose own ``timeGrain`` drives both the SQL
    ``DATE_TRUNC`` grouping (``SqlaTable.adhoc_column_to_sqla`` reads
    ``col["timeGrain"]``) and the time-comparison join
    (``ExploreMixin.get_time_grain`` prefers ``columns[0]["timeGrain"]`` over
    ``extras``). For those queries ``extras["time_grain_sqla"]`` is never
    consulted, so an override written only there is silently ignored and the
    saved grain keeps winning. Match the ``BASE_AXIS`` gate in
    ``adhoc_column_to_sqla`` regardless of the column's position in the list.
    """
    for column in query.get("columns") or []:
        if isinstance(column, dict) and column.get("columnType") == "BASE_AXIS":
            column["timeGrain"] = time_grain
