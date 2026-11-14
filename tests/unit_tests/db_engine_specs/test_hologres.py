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
from superset.db_engine_specs.hologres import HologresEngineSpec
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec


def test_hologres_properties() -> None:
    assert HologresEngineSpec.engine == "hologres"
    assert HologresEngineSpec.engine_name == "Hologres"
    assert HologresEngineSpec.default_driver == "psycopg2"
    assert issubclass(HologresEngineSpec, PostgresBaseEngineSpec)
    assert HologresEngineSpec._extended_aggregations == {}


def test_hologres_metadata() -> None:
    metadata = HologresEngineSpec.metadata
    assert "Hologres" in metadata["description"]
    assert metadata["logo"] == "hologres.png"
    assert "psycopg2" in metadata["pypi_packages"]
    assert metadata["default_port"] == 80
