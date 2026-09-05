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
from superset.db_engine_specs.db2 import Db2EngineSpec
from superset.db_engine_specs.ibmi import IBMiEngineSpec


def test_ibmi_properties() -> None:
    assert IBMiEngineSpec.engine == "ibmi"
    assert IBMiEngineSpec.engine_name == "IBM Db2 for i"
    assert IBMiEngineSpec.max_column_name_length == 128
    assert issubclass(IBMiEngineSpec, Db2EngineSpec)


def test_ibmi_metadata() -> None:
    metadata = IBMiEngineSpec.metadata
    assert "IBM Db2 for i" in metadata["description"]
    assert metadata["logo"] == "ibm-db2.svg"
    assert "sqlalchemy-ibmi" in metadata["pypi_packages"]
    assert metadata["default_port"] == 50000


def test_ibmi_epoch_to_dttm() -> None:
    assert (
        IBMiEngineSpec.epoch_to_dttm().format(col="ts")
        == "(DAYS(ts) - DAYS('1970-01-01')) * 86400 + MIDNIGHT_SECONDS(ts)"
    )
