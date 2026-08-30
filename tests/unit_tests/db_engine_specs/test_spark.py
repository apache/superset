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
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.db_engine_specs.spark import SparkEngineSpec


def test_spark_properties() -> None:
    assert SparkEngineSpec.engine == "spark"
    assert SparkEngineSpec.engine_name == "Apache Spark SQL"
    assert issubclass(SparkEngineSpec, HiveEngineSpec)


def test_spark_metadata() -> None:
    metadata = SparkEngineSpec.metadata
    assert "Apache Spark SQL" in metadata["description"]
    assert metadata["logo"] == "apache-spark.png"
    assert "pyhive" in metadata["pypi_packages"]
    assert metadata["default_port"] == 10000


@pytest.mark.parametrize(
    "time_grain,expected",
    [
        (None, "ts"),
        (TimeGrain.SECOND, "date_trunc('second', ts)"),
        (TimeGrain.MINUTE, "date_trunc('minute', ts)"),
        (TimeGrain.HOUR, "date_trunc('hour', ts)"),
        (TimeGrain.DAY, "date_trunc('day', ts)"),
        (TimeGrain.WEEK, "date_trunc('week', ts)"),
        (TimeGrain.MONTH, "date_trunc('month', ts)"),
        (TimeGrain.QUARTER, "date_trunc('quarter', ts)"),
        (TimeGrain.YEAR, "date_trunc('year', ts)"),
        (
            TimeGrain.WEEK_ENDING_SATURDAY,
            "date_trunc('week', ts + interval '1 day') + interval '5 days'",
        ),
        (
            TimeGrain.WEEK_STARTING_SUNDAY,
            "date_trunc('week', ts + interval '1 day') - interval '1 day'",
        ),
    ],
)
def test_time_grain_expressions(time_grain: str | None, expected: str) -> None:
    assert SparkEngineSpec._time_grain_expressions[time_grain].format(col="ts") == expected
