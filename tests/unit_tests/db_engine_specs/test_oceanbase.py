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
from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.db_engine_specs.oceanbase import OceanBaseEngineSpec


def test_oceanbase_properties() -> None:
    assert OceanBaseEngineSpec.engine == "oceanbase"
    assert OceanBaseEngineSpec.engine_name == "OceanBase"
    assert OceanBaseEngineSpec.default_driver == "oceanbase"
    assert OceanBaseEngineSpec.max_column_name_length == 128
    assert issubclass(OceanBaseEngineSpec, MySQLEngineSpec)
    assert OceanBaseEngineSpec._extended_aggregations == {}


def test_oceanbase_metadata() -> None:
    metadata = OceanBaseEngineSpec.metadata
    assert "OceanBase is a distributed relational database" in metadata["description"]
    assert metadata["logo"] == "oceanbase.svg"
    assert metadata["homepage_url"] == "https://www.oceanbase.com/"
