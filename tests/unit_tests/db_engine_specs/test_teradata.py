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

from superset.db_engine_specs.teradata import TeradataEngineSpec


def test_teradata_properties() -> None:
    assert TeradataEngineSpec.engine == "teradatasql"
    assert TeradataEngineSpec.engine_name == "Teradata"
    assert TeradataEngineSpec.max_column_name_length == 30


def test_teradata_metadata() -> None:
    metadata = TeradataEngineSpec.metadata
    desc = metadata["description"]
    assert "Teradata is an enterprise data warehouse platform" in desc
    assert metadata["logo"] == "teradata.png"
    assert "teradatasqlalchemy" in metadata["pypi_packages"]
    assert metadata["default_port"] == 1025


def test_teradata_epoch_to_dttm() -> None:
    assert "DATE '1970-01-01'" in TeradataEngineSpec.epoch_to_dttm().format(col="ts")


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        ("PT1M", "TRUNC(CAST(ts as DATE), 'MI')"),
        ("PT1H", "TRUNC(CAST(ts as DATE), 'HH')"),
        ("P1D", "TRUNC(CAST(ts as DATE), 'DDD')"),
        ("P1W", "TRUNC(CAST(ts as DATE), 'WW')"),
        ("P1M", "TRUNC(CAST(ts as DATE), 'MONTH')"),
        ("P3M", "TRUNC(CAST(ts as DATE), 'Q')"),
        ("P1Y", "TRUNC(CAST(ts as DATE), 'YEAR')"),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    actual = TeradataEngineSpec._time_grain_expressions[time_grain].format(col="ts")
    assert actual == expected
