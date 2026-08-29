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
import pytest

from superset.commands.chart.create import CreateChartCommand
from superset.commands.chart.exceptions import (
    ChartInvalidError,
    ChartParamsInvalidJSONValidationError,
)


def test_init_with_invalid_json_params_raises_chart_invalid_error():
    """
    A malformed ``params`` JSON string must surface as a ``ChartInvalidError``
    (a 422-mapped validation error) rather than leaking a raw ``JSONDecodeError``.
    """
    with pytest.raises(ChartInvalidError) as ex:
        CreateChartCommand(
            {
                "params": "{not valid json",
                "datasource_id": 1,
                "datasource_type": "table",
            }
        )

    assert any(
        isinstance(exc, ChartParamsInvalidJSONValidationError)
        for exc in ex.value._exceptions
    )


def test_init_with_valid_json_params_populates_viz_type():
    """
    A valid ``params`` JSON string still falls back to its ``viz_type`` when no
    top-level ``viz_type`` is supplied (happy path must not regress).
    """
    command = CreateChartCommand(
        {
            "params": '{"viz_type": "table"}',
            "datasource_id": 1,
            "datasource_type": "table",
        }
    )

    assert command._properties["viz_type"] == "table"
