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
from superset.db_engine_specs.vertica import VerticaEngineSpec


def test_vertica_properties() -> None:
    assert VerticaEngineSpec.engine == "vertica"
    assert VerticaEngineSpec.engine_name == "Vertica"
    assert issubclass(VerticaEngineSpec, PostgresBaseEngineSpec)
    assert VerticaEngineSpec._extended_aggregations == {}


def test_vertica_metadata() -> None:
    metadata = VerticaEngineSpec.metadata
    assert "Vertica is a column-oriented analytics database" in metadata["description"]
    assert metadata["logo"] == "vertica.png"
    assert "sqlalchemy-vertica-python" in metadata["pypi_packages"]
    assert metadata["default_port"] == 5433
