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
from typing import Optional, TYPE_CHECKING
import simplejson as json

from superset.sqllab.commands.execute_sql_json_command import ExecutionContextConvertor
from superset.utils.sql_query_results import apply_display_max_row_limit
import superset.utils.core as utils

if TYPE_CHECKING:
    from superset.sqllab.execution_context import SqlJsonExecutionContext
    from superset.sqllab.sql_json_executer import SqlResults
    from superset.models.sql_lab import Query


class ExecutionContextConvertorImpl(ExecutionContextConvertor):
    _display_max_row: bool

    def set_display_max_row(self, value: bool) -> None:
        self._display_max_row = value

    def to_payload(self, execution_context: SqlJsonExecutionContext) -> str:
        execution_result: Optional[SqlResults] = execution_context.get_execution_result()
        if execution_result is not None:
            return self._to_payload_results_based(execution_result)
        else:
            return self._to_payload_query_based(execution_context.query)

    def _to_payload_results_based(self, execution_result: SqlResults) -> str:
        return json.dumps(
            apply_display_max_row_limit(execution_result, self._display_max_row),
            default=utils.pessimistic_json_iso_dttm_ser,
            ignore_nan=True,
            encoding=None
        )

    def _to_payload_query_based(self, query: Query) -> str:
        return json.dumps(
            {"query": query.to_dict()},
            default=utils.json_int_dttm_ser,
            ignore_nan=True
        )
