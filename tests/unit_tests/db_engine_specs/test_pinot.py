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
from importlib.metadata import requires
from unittest import mock

import pytest
from packaging.requirements import Requirement
from pytest_mock import MockerFixture
from sqlalchemy import __version__ as sqlalchemy_version, column, create_engine, text


@pytest.mark.parametrize("scheme", ["pinot", "pinot+http", "pinot+https"])
def test_dialect_supports_installed_sqlalchemy(
    scheme: str, mocker: MockerFixture
) -> None:
    """Validate the optional SQLAlchemy dependency contract and sync dialect aliases."""
    pytest.importorskip("pinotdb.sqlalchemy")
    requirements = [
        Requirement(requirement) for requirement in requires("pinotdb") or []
    ]
    sqlalchemy_requirements = [
        requirement
        for requirement in requirements
        if requirement.name == "sqlalchemy"
        and (
            requirement.marker is None
            or requirement.marker.evaluate({"extra": "sqlalchemy"})
        )
    ]
    assert sqlalchemy_requirements
    assert all(
        sqlalchemy_version in requirement.specifier
        for requirement in sqlalchemy_requirements
    )
    socket = mocker.patch("socket.socket", side_effect=AssertionError("Network I/O"))
    engine = create_engine(f"{scheme}://localhost:8099/query/sql")
    try:
        _, connect_args = engine.dialect.create_connect_args(engine.url)
        assert connect_args["scheme"] == (
            "https" if scheme == "pinot+https" else "http"
        )
        assert str(text("SELECT :value").compile(engine)) == "SELECT %(value)s"
    finally:
        engine.dispose()
    socket.assert_not_called()


@pytest.mark.parametrize(
    "time_grain,expected_result",
    [
        ("PT1S", "CAST(DATE_TRUNC('second', CAST(col AS TIMESTAMP)) AS TIMESTAMP)"),
        (
            "PT5M",
            "CAST(ROUND(DATE_TRUNC('minute', CAST(col AS TIMESTAMP)), 300000) AS TIMESTAMP)",  # noqa: E501
        ),
        ("P1W", "CAST(DATE_TRUNC('week', CAST(col AS TIMESTAMP)) AS TIMESTAMP)"),
        ("P1M", "CAST(DATE_TRUNC('month', CAST(col AS TIMESTAMP)) AS TIMESTAMP)"),
        ("P3M", "CAST(DATE_TRUNC('quarter', CAST(col AS TIMESTAMP)) AS TIMESTAMP)"),
        ("P1Y", "CAST(DATE_TRUNC('year', CAST(col AS TIMESTAMP)) AS TIMESTAMP)"),
    ],
)
def test_timegrain_expressions(time_grain: str, expected_result: str) -> None:
    """
    DB Eng Specs (pinot): Test time grain expressions
    """
    from superset.db_engine_specs.pinot import PinotEngineSpec as spec  # noqa: N813

    actual = str(
        spec.get_timestamp_expr(col=column("col"), pdf=None, time_grain=time_grain)
    )
    assert actual == expected_result


def test_extras_without_ssl() -> None:
    from superset.db_engine_specs.pinot import PinotEngineSpec as spec  # noqa: N813
    from tests.integration_tests.fixtures.database import default_db_extra

    database = mock.Mock()
    database.extra = default_db_extra
    database.server_cert = None
    extras = spec.get_extra_params(database)
    assert "connect_args" not in extras["engine_params"]
