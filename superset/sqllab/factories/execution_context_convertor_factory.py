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
from typing import Dict, Any, TYPE_CHECKING

from superset.sqllab.execution_context_convertor import ExecutionContextConvertorImpl

if TYPE_CHECKING:
    from superset.sqllab.commands.execute_sql_json_command import ExecutionContextConvertor


class ExecutionContextConvertorFactory:
    _app_configurations: Dict[str, Any]

    def __init__(self, app_configurations: Dict[str, Any]) -> None:
        self._app_configurations = app_configurations

    def create(self) -> ExecutionContextConvertor:
        execution_context_convertor = ExecutionContextConvertorImpl()
        execution_context_convertor.set_display_max_row(self._app_configurations.get("DISPLAY_MAX_ROW"))
        return execution_context_convertor
