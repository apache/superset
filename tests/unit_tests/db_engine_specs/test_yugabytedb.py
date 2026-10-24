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
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec
from superset.db_engine_specs.yugabytedb import YugabyteDBEngineSpec


def test_yugabytedb_properties() -> None:
    assert YugabyteDBEngineSpec.engine == "yugabytedb"
    assert YugabyteDBEngineSpec.engine_name == "YugabyteDB"
    assert YugabyteDBEngineSpec.default_driver == "psycopg2"
    assert issubclass(YugabyteDBEngineSpec, PostgresBaseEngineSpec)
    assert YugabyteDBEngineSpec._extended_aggregations == {}


def test_yugabytedb_metadata() -> None:
    metadata = YugabyteDBEngineSpec.metadata
    assert "YugabyteDB is a distributed SQL database" in metadata["description"]
    assert metadata["logo"] == "yugabyte.png"
    assert "psycopg2" in metadata["pypi_packages"]
    assert metadata["default_port"] == 5433
