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
from unittest import mock

import pytest
from sqlalchemy import column

from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST(TIME_PARSE('2019-01-02') AS DATE)"),
        ("DateTime", "TIME_PARSE('2019-01-02T03:04:05')"),
        ("TimeStamp", "TIME_PARSE('2019-01-02T03:04:05')"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str, expected_result: Optional[str], dttm: datetime
) -> None:
    from superset.db_engine_specs.pinot import PinotEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "time_grain,expected_result",
    [
        ("PT1S", "CAST(DATE_TRUNC('second', CAST(col AS TIMESTAMP)) AS TIMESTAMP), 'PT1S')"),
        ("PT5M", "CAST(ROUND(DATE_TRUNC('minute', CAST({col} AS TIMESTAMP)), 30000) AS TIMESTAMP), 'PT5M')"),
        (
            "P1W/1970-01-03T00:00:00Z",
            "CAST(DATE_TRUNC('week', CAST(col AS TIMESTAMP)) AS TIMESTAMP)), 'P1D', 5)",
        ),
        (
            "1969-12-28T00:00:00Z/P1W",
            "CAST(DATE_TRUNC('week', CAST(col AS TIMESTAMP)) AS TIMESTAMP), 'P1D', 5)",
        ),
    ],
)
def test_timegrain_expressions(time_grain: str, expected_result: str) -> None:
    """
    DB Eng Specs (pinot): Test time grain expressions
    """
    from superset.db_engine_specs.pinot import PinotEngineSpec as spec

    assert str(
        spec.get_timestamp_expr(
            col=column("col"), pdf=None, time_grain=time_grain
        )
    )


def test_extras_without_ssl() -> None:
    from superset.db_engine_specs.pinot import PinotEngineSpec as spec
    from tests.integration_tests.fixtures.database import default_db_extra

    db = mock.Mock()
    db.extra = default_db_extra
    db.server_cert = None
    extras = spec.get_extra_params(db)
    assert "connect_args" not in extras["engine_params"]


def test_extras_with_ssl() -> None:
    from superset.db_engine_specs.pinot import PinotEngineSpec as spec
    from tests.integration_tests.fixtures.certificates import ssl_certificate
    from tests.integration_tests.fixtures.database import default_db_extra

    db = mock.Mock()
    db.extra = default_db_extra
    db.server_cert = ssl_certificate
    extras = spec.get_extra_params(db)
    connect_args = extras["engine_params"]["connect_args"]
    assert connect_args["scheme"] == "https"
    assert "ssl_verify_cert" in connect_args
