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

import logging
from typing import Any, Dict, TYPE_CHECKING

import simplejson as json

import superset.utils.core as utils
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sqllab.utils import apply_display_max_row_configuration_if_require

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from superset.models.sql_lab import Query
    from superset.sqllab.sql_json_executer import SqlResults
    from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext


class ExecutionContextConvertor:
    _max_row_in_display_configuration: int  # pylint: disable=invalid-name
    _exc_status: SqlJsonExecutionStatus
    payload: Dict[str, Any]

    def set_max_row_in_display(self, value: int) -> None:
        self._max_row_in_display_configuration = value  # pylint: disable=invalid-name

    def set_payload(
        self,
        execution_context: SqlJsonExecutionContext,
        execution_status: SqlJsonExecutionStatus,
    ) -> None:
        self._exc_status = execution_status
        if execution_status == SqlJsonExecutionStatus.HAS_RESULTS:
            self.payload = execution_context.get_execution_result() or {}
        else:
            self.payload = execution_context.query.to_dict()

    def serialize_payload(self) -> str:
        if self._exc_status == SqlJsonExecutionStatus.HAS_RESULTS:
            return json.dumps(
                apply_display_max_row_configuration_if_require(
                    self.payload, self._max_row_in_display_configuration
                ),
                default=utils.pessimistic_json_iso_dttm_ser,
                ignore_nan=True,
                encoding=None,
            )

        return json.dumps(
            {"query": self.payload}, default=utils.json_int_dttm_ser, ignore_nan=True
        )
