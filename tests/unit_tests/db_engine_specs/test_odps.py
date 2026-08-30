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
from superset.db_engine_specs.odps import OdpsBaseEngineSpec, OdpsEngineSpec


def test_odps_properties() -> None:
    assert OdpsEngineSpec.engine == "odps"
    assert OdpsEngineSpec.engine_name == "ODPS (MaxCompute)"
    assert OdpsEngineSpec.default_driver == "odps"
    assert issubclass(OdpsEngineSpec, OdpsBaseEngineSpec)


def test_odps_metadata() -> None:
    metadata = OdpsEngineSpec.metadata
    assert "MaxCompute" in metadata["description"]
    assert metadata["logo"] == "maxcompute.png"
    assert "pyodps" in metadata["pypi_packages"]
    assert "odps://" in metadata["connection_string"]
