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
from superset.db_engine_specs.d1 import CloudflareD1EngineSpec
from superset.db_engine_specs.sqlite import SqliteEngineSpec


def test_d1_properties() -> None:
    assert CloudflareD1EngineSpec.engine == "d1"
    assert CloudflareD1EngineSpec.engine_name == "Cloudflare D1"
    assert CloudflareD1EngineSpec.default_driver == "d1"
    assert issubclass(CloudflareD1EngineSpec, SqliteEngineSpec)


def test_d1_metadata() -> None:
    metadata = CloudflareD1EngineSpec.metadata
    assert metadata["description"] == "Cloudflare D1 is a serverless SQLite database."
    assert metadata["logo"] == "cloudflare.png"
    assert "superset-engine-d1" in metadata["pypi_packages"]
    assert "d1://" in metadata["connection_string"]
