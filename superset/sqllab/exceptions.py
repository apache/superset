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
import os
from typing import Optional, TYPE_CHECKING

from superset.errors import SupersetErrorType
from superset.exceptions import SupersetException

if TYPE_CHECKING:
    from superset.sqllab.execution_context import SqlJsonExecutionContext


class SqlLabException(SupersetException):
    sql_json_execution_context: SqlJsonExecutionContext
    failed_reason_msg: str
    suggestion_help_msg: str

    def __init__(self,
                 sql_json_execution_context: SqlJsonExecutionContext,
                 error_type: SupersetErrorType,
                 reason_message: str = None,
                 exception: Optional[Exception] = None,
                 suggestion_help_msg: str = None) -> None:
        self.sql_json_execution_context = sql_json_execution_context
        self.failed_reason_msg = self._get_reason(reason_message, exception)
        self.suggestion_help_msg = suggestion_help_msg
        super().__init__(self._generate_message(), exception, error_type)

    def _generate_message(self) -> str:
        msg = "Failed to execute {}".format(self.sql_json_execution_context.get_query_details())
        if self.failed_reason_msg:
            msg = msg + self.failed_reason_msg
        if self.suggestion_help_msg:
            msg = "{} {} {}".format(msg, os.linesep, self.suggestion_help_msg)
        return msg

    @classmethod
    def _get_reason(cls, reason_message: str = None, exception: Optional[Exception] = None) -> str:
        if reason_message is not None:
            return ": {}".format(reason_message)
        if exception is not None:
            if hasattr(exception, "get_message"):
                return ": {}".format(exception.get_message())
            if hasattr(exception, "message"):
                return ": {}".format(exception.message)
            return ": {}".format(str(exception))
        return ""
