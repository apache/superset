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

from datetime import datetime
from typing import Optional

import pytest
from pytest_mock import MockerFixture

from superset.config import VERSION_STRING
from superset.utils import json
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Text", "'2019-01-02 03:04:05.678900'"),
        ("DateTime", "'2019-01-02 03:04:05.678900'"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_get_extra_params(mocker: MockerFixture) -> None:
    """
    Test the ``get_extra_params`` method.
    """
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    database = mocker.MagicMock()

    database.extra = {}
    assert DuckDBEngineSpec.get_extra_params(database) == {
        "engine_params": {
            "connect_args": {
                "config": {"custom_user_agent": f"apache-superset/{VERSION_STRING}"}
            }
        }
    }

    database.extra = json.dumps(
        {"engine_params": {"connect_args": {"config": {"custom_user_agent": "my-app"}}}}
    )
    assert DuckDBEngineSpec.get_extra_params(database) == {
        "engine_params": {
            "connect_args": {
                "config": {
                    "custom_user_agent": f"apache-superset/{VERSION_STRING} my-app"
                }
            }
        }
    }


def test_build_sqlalchemy_uri() -> None:
    """Test DuckDBEngineSpec.build_sqlalchemy_uri"""
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec, DuckDBParametersType

    # No database provided, default to :memory:
    parameters = DuckDBParametersType()
    uri = DuckDBEngineSpec.build_sqlalchemy_uri(parameters)
    assert "duckdb:///:memory:" == uri

    # Database provided
    parameters = DuckDBParametersType(database="/path/to/duck.db")
    uri = DuckDBEngineSpec.build_sqlalchemy_uri(parameters)
    assert "duckdb:////path/to/duck.db" == uri


def test_md_build_sqlalchemy_uri() -> None:
    """Test MotherDuckEngineSpec.build_sqlalchemy_uri"""
    from superset.db_engine_specs.duckdb import (
        DuckDBParametersType,
        MotherDuckEngineSpec,
    )

    # No access token provided, throw ValueError
    parameters = DuckDBParametersType(database="my_db")
    with pytest.raises(ValueError):
        MotherDuckEngineSpec.build_sqlalchemy_uri(parameters)

    # No database provided, default to "md:"
    parameters = DuckDBParametersType(access_token="token")
    uri = MotherDuckEngineSpec.build_sqlalchemy_uri(parameters)
    assert "duckdb:///md:?motherduck_token=token"

    # Database and access_token provided
    parameters = DuckDBParametersType(database="my_db", access_token="token")
    uri = MotherDuckEngineSpec.build_sqlalchemy_uri(parameters)
    assert "duckdb:///md:my_db?motherduck_token=token" == uri


def test_get_parameters_from_uri() -> None:
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    uri = "duckdb:////path/to/duck.db"
    parameters = DuckDBEngineSpec.get_parameters_from_uri(uri)

    assert parameters["database"] == "/path/to/duck.db"

    uri = "duckdb:///md:my_db?motherduck_token=token"
    parameters = DuckDBEngineSpec.get_parameters_from_uri(uri)

    assert parameters["database"] == "md:my_db"
    assert parameters["access_token"] == "token"
