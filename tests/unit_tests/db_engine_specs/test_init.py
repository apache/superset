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
from pytest_mock import MockerFixture

from superset.db_engine_specs import get_available_engine_specs


def test_get_available_engine_specs(mocker: MockerFixture) -> None:
    """
    get_available_engine_specs should return all engine specs
    """
    from superset.db_engine_specs.databricks import (
        DatabricksHiveEngineSpec,
        DatabricksNativeEngineSpec,
        DatabricksODBCEngineSpec,
    )

    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter(
            [
                DatabricksHiveEngineSpec,
                DatabricksNativeEngineSpec,
                DatabricksODBCEngineSpec,
            ]
        ),
    )

    assert list(get_available_engine_specs().keys()) == [
        DatabricksHiveEngineSpec,
        DatabricksNativeEngineSpec,
        DatabricksODBCEngineSpec,
    ]


@pytest.mark.parametrize(
    "app",
    [{"DBS_AVAILABLE_DENYLIST": {"databricks": {"pyhive", "pyodbc"}}}],
    indirect=True,
)
def test_get_available_engine_specs_with_denylist(mocker: MockerFixture) -> None:
    """
    The denylist removes items from the db engine spec list
    """
    from superset.db_engine_specs.databricks import (
        DatabricksHiveEngineSpec,
        DatabricksNativeEngineSpec,
        DatabricksODBCEngineSpec,
    )

    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter(
            [
                DatabricksHiveEngineSpec,
                DatabricksNativeEngineSpec,
                DatabricksODBCEngineSpec,
            ]
        ),
    )
    available = get_available_engine_specs()
    assert list(available.keys()) == [DatabricksNativeEngineSpec]
