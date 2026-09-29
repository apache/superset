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
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.db_engine_specs.risingwave import RisingWaveDbEngineSpec


def test_risingwave_properties() -> None:
    assert RisingWaveDbEngineSpec.engine == "risingwave"
    assert RisingWaveDbEngineSpec.engine_name == "RisingWave"
    assert issubclass(RisingWaveDbEngineSpec, PostgresEngineSpec)
    assert RisingWaveDbEngineSpec._extended_aggregations == {}


def test_risingwave_metadata() -> None:
    metadata = RisingWaveDbEngineSpec.metadata
    assert "RisingWave is a distributed streaming database" in metadata["description"]
    assert metadata["logo"] == "risingwave.svg"
    assert "sqlalchemy-risingwave" in metadata["pypi_packages"]
    assert metadata["default_port"] == 4566
    assert "risingwave://" in metadata["connection_string"]
