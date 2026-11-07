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
from superset.db_engine_specs.greenplum import GreenplumEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec


def test_greenplum_properties() -> None:
    assert GreenplumEngineSpec.engine == "greenplum"
    assert GreenplumEngineSpec.engine_name == "Greenplum"
    assert GreenplumEngineSpec.default_driver == "psycopg2"
    assert issubclass(GreenplumEngineSpec, PostgresEngineSpec)
    assert GreenplumEngineSpec._extended_aggregations == {}


def test_greenplum_metadata() -> None:
    metadata = GreenplumEngineSpec.metadata
    assert "VMware Greenplum" in metadata["description"]
    assert metadata["logo"] == "greenplum.png"
    assert "sqlalchemy-greenplum" in metadata["pypi_packages"]
    assert metadata["default_port"] == 5432
