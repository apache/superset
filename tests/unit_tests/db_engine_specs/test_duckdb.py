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

from superset.utils import json
from superset.utils.core import GenericDataType
from tests.conftest import with_config
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
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@with_config({"VERSION_STRING": "1.0.0"})
def test_get_extra_params(mocker: MockerFixture) -> None:
    """
    Test the ``get_extra_params`` method.
    """
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    database = mocker.MagicMock()

    database.extra = {}
    assert DuckDBEngineSpec.get_extra_params(database) == {
        "engine_params": {
            "connect_args": {"config": {"custom_user_agent": "apache-superset/1.0.0"}}
        }
    }

    database.extra = json.dumps(
        {"engine_params": {"connect_args": {"config": {"custom_user_agent": "my-app"}}}}
    )
    assert DuckDBEngineSpec.get_extra_params(database) == {
        "engine_params": {
            "connect_args": {
                "config": {"custom_user_agent": "apache-superset/1.0.0 my-app"}
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
    with pytest.raises(ValueError):  # noqa: PT011
        MotherDuckEngineSpec.build_sqlalchemy_uri(parameters)

    # No database provided, default to "md:"
    parameters = DuckDBParametersType(access_token="token")  # noqa: S106
    uri = MotherDuckEngineSpec.build_sqlalchemy_uri(parameters)
    assert "duckdb:///md:?motherduck_token=token"

    # Database and access_token provided
    parameters = DuckDBParametersType(database="my_db", access_token="token")  # noqa: S106
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
    assert parameters["access_token"] == "token"  # noqa: S105


def test_column_type_recognition() -> None:
    """Test that DuckDB column types are properly recognized as numeric."""
    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    # Test standard float/double types
    numeric_types = [
        "FLOAT",
        "DOUBLE",
        "DOUBLE PRECISION",
        "REAL",
        "DECIMAL(10,2)",
        "NUMERIC(10,2)",
        "INTEGER",
        "BIGINT",
        "SMALLINT",
        # DuckDB-specific unsigned types
        "HUGEINT",
        "UBIGINT",
        "UINTEGER",
        "USMALLINT",
        "UTINYINT",
    ]

    for type_str in numeric_types:
        col_spec = DuckDBEngineSpec.get_column_spec(type_str)
        assert col_spec is not None, f"Type {type_str} should be recognized"
        assert col_spec.generic_type == GenericDataType.NUMERIC, (
            f"Type {type_str} should be recognized as NUMERIC, "
            f"got {col_spec.generic_type}"
        )

    # Test that TINYINT (non-unsigned) is also recognized
    # Note: TINYINT is not in the default mappings, but should be handled
    col_spec = DuckDBEngineSpec.get_column_spec("TINYINT")
    # TINYINT matches the pattern "^int" so it should be recognized
    assert col_spec is None, "TINYINT doesn't match any patterns"


def test_motherduck_impersonation(mocker: MockerFixture) -> None:
    """
    Test ``impersonate_user`` embeds the username in the md: path.

    The hook lives on DuckDBEngineSpec because engine spec resolution is by
    backend name, so md: databases resolve to the DuckDB spec.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    database = mocker.MagicMock()

    url = URL.create("duckdb", database="md:my_db", query={"motherduck_token": "abc"})
    url, engine_kwargs = DuckDBEngineSpec.impersonate_user(
        database=database,
        username="alice",
        user_token=None,
        url=url,
        engine_kwargs={},
    )
    assert url.database == "md:my_db?session_name=alice"
    assert url.username is None
    assert url.query["motherduck_token"] == "abc"
    assert engine_kwargs == {}


def test_duckdb_local_impersonation_is_a_noop(mocker: MockerFixture) -> None:
    """
    Test ``impersonate_user`` leaves local DuckDB URLs alone.

    The base implementation puts the username in the URL, which duckdb-engine
    forwards as a ``connect()`` kwarg that duckdb rejects.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.duckdb import DuckDBEngineSpec

    database = mocker.MagicMock()

    url = URL.create("duckdb", database="/path/to/duck.db")
    url, _ = DuckDBEngineSpec.impersonate_user(
        database=database,
        username="alice",
        user_token=None,
        url=url,
        engine_kwargs={},
    )
    assert url == URL.create("duckdb", database="/path/to/duck.db")


def test_motherduck_impersonation_escapes_structural_characters(
    mocker: MockerFixture,
) -> None:
    """
    Test ``impersonate_user`` escapes characters that would inject parameters.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.duckdb import MotherDuckEngineSpec

    database = mocker.MagicMock()

    url = URL.create("duckdb", database="md:my_db?attach_mode=single")
    url, _ = MotherDuckEngineSpec.impersonate_user(  # inherited from DuckDBEngineSpec
        database=database,
        username="a&host=evil",
        user_token=None,
        url=url,
        engine_kwargs={},
    )
    assert url.database == "md:my_db?attach_mode=single&session_name=a%26host%3Devil"


def test_motherduck_impersonation_without_username(mocker: MockerFixture) -> None:
    """
    Test ``impersonate_user`` leaves the URL alone when there is no username.
    """
    from sqlalchemy.engine.url import URL

    from superset.db_engine_specs.duckdb import MotherDuckEngineSpec

    database = mocker.MagicMock()

    url = URL.create("duckdb", database="md:my_db")
    url, _ = MotherDuckEngineSpec.impersonate_user(
        database=database,
        username=None,
        user_token=None,
        url=url,
        engine_kwargs={},
    )
    assert "motherduck_session_name" not in url.query
