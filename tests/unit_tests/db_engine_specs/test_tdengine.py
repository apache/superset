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


from sqlalchemy.engine.url import make_url, URL  # noqa: F401


# test get schema
def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.tdengine import TDengineEngineSpec

    assert (
        TDengineEngineSpec.get_schema_from_engine_params(
            make_url("taosws://root:taosdata@127.0.0.1:6041/dbname"), {}
        )
        == "dbname"
    )


def test_tdengine_properties() -> None:
    from superset.db_engine_specs.tdengine import TDengineEngineSpec

    assert TDengineEngineSpec.engine == "taosws"
    assert TDengineEngineSpec.engine_name == "TDengine"
    assert TDengineEngineSpec.default_driver == "taosws"
    assert TDengineEngineSpec.max_column_name_length == 64


def test_tdengine_metadata() -> None:
    from superset.db_engine_specs.tdengine import TDengineEngineSpec

    metadata = TDengineEngineSpec.metadata
    assert "TDengine is a high-performance time-series database" in metadata["description"]
    assert metadata["logo"] == "tdengine.png"
    assert "taospy" in metadata["pypi_packages"]
    assert metadata["default_port"] == 6041


def test_time_grain_expressions() -> None:
    from superset.db_engine_specs.tdengine import TDengineEngineSpec

    assert (
        TDengineEngineSpec._time_grain_expressions["PT1S"].format(col="ts")
        == "TIMETRUNCATE(ts, 1s, 0)"
    )
    assert (
        TDengineEngineSpec._time_grain_expressions["P1D"].format(col="ts")
        == "TIMETRUNCATE(ts, 1d, 0)"
    )

