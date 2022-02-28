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

import json
from typing import TYPE_CHECKING, Union

if TYPE_CHECKING:
    from superset.charts.commands.create import CreateChartCommand
    from superset.charts.commands.update import UpdateChartCommand


def sanitize_metadata(command: Union[CreateChartCommand, UpdateChartCommand]) -> None:
    # url params are temporary and should not be persisted in chart metadata
    params = command._properties.get("params")
    if params:
        json_params = json.loads(params)
        url_params = json_params.pop("url_params", None)
        if url_params:
            command._properties["params"] = json.dumps(json_params)
