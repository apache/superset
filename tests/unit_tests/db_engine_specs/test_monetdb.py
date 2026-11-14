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

from superset.constants import TimeGrain
from superset.db_engine_specs.monetdb import MonetDbEngineSpec


def test_monetdb_properties() -> None:
    assert MonetDbEngineSpec.engine == "monetdb"
    assert MonetDbEngineSpec.engine_name == "MonetDB"
    assert MonetDbEngineSpec.default_driver == "pymonetdb"


def test_monetdb_metadata() -> None:
    metadata = MonetDbEngineSpec.metadata
    assert "MonetDB is an open-source column-oriented" in metadata["description"]
    assert metadata["logo"] == "monet-db.png"
    assert "sqlalchemy-monetdb" in metadata["pypi_packages"]
    assert metadata["default_port"] == 50000


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        (TimeGrain.SECOND, "CAST(FLOOR(EXTRACT(EPOCH FROM ts)) AS TIMESTAMP)"),
        (
            TimeGrain.MINUTE,
            "CAST(ts AS TIMESTAMP) - CAST(EXTRACT(SECOND FROM ts) AS INTERVAL SECOND)",
        ),
        (
            TimeGrain.HOUR,
            "CAST(ts AS TIMESTAMP) - "
            "CAST(EXTRACT(MINUTE FROM ts) AS INTERVAL MINUTE) - "
            "CAST(EXTRACT(SECOND FROM ts) AS INTERVAL SECOND)",
        ),
        (TimeGrain.DAY, "CAST(ts AS DATE)"),
        (
            TimeGrain.MONTH,
            "CAST(EXTRACT(YEAR FROM ts) || '-' || "
            "LPAD(CAST(EXTRACT(MONTH FROM ts) AS VARCHAR), 2, '0') || '-01' AS DATE)",
        ),
        (TimeGrain.YEAR, "CAST(EXTRACT(YEAR FROM ts) || '-01-01' AS DATE)"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    assert (
        MonetDbEngineSpec._time_grain_expressions[time_grain].format(col="ts")
        == expected
    )
