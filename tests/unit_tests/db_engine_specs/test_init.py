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


import logging

import pytest
from pytest_mock import MockerFixture

from superset.db_engine_specs import get_available_engine_specs


def test_malformed_dialect_entry_point_does_not_break_bootstrap(
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A broken third-party entry point must only disable that connector."""
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    # loads successfully but violates the dialect contract: no `name`
    malformed = mocker.Mock()
    malformed.name = "malformed"
    malformed.load.return_value = mocker.Mock(spec=[])

    healthy = mocker.Mock()
    healthy.name = "sqlite"
    healthy.load.return_value = mocker.Mock(spec=["name", "driver"])
    healthy.load.return_value.name = "sqlite"
    healthy.load.return_value.driver = "pysqlite"

    mocker.patch(
        "superset.db_engine_specs.entry_points",
        return_value=[malformed, healthy],
    )
    mocker.patch(
        "superset.db_engine_specs.load_engine_specs",
        return_value=iter([SqliteEngineSpec]),
    )

    with caplog.at_level(logging.WARNING, logger="superset.db_engine_specs"):
        available = get_available_engine_specs()

    assert available == {SqliteEngineSpec: {"pysqlite"}}
    assert "Unable to load SQLAlchemy dialect malformed" in caplog.text


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
