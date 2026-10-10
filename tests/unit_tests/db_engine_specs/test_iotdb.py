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
from superset.db_engine_specs.iotdb import IoTDBEngineSpec


def test_iotdb_properties() -> None:
    assert IoTDBEngineSpec.engine == "iotdb"
    assert IoTDBEngineSpec.engine_name == "Apache IoTDB"


def test_iotdb_metadata() -> None:
    metadata = IoTDBEngineSpec.metadata
    assert "Apache IoTDB is a time series database" in metadata["description"]
    assert metadata["logo"] == "apache-iotdb.svg"
    assert "apache-iotdb" in metadata["pypi_packages"]
    assert metadata["default_port"] == 6667
    assert "iotdb://" in metadata["connection_string"]


def test_time_grain_expressions() -> None:
    assert IoTDBEngineSpec._time_grain_expressions[None].format(col="ts") == "ts"
