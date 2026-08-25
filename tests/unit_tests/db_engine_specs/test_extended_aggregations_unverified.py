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
"""
`_extended_aggregations` (MEDIAN/STDDEV_SAMP/VAR_SAMP) is verified against
real engine behavior before being enabled -- see `BaseEngineSpec` for the
rationale. `PostgresBaseEngineSpec`/`PostgresEngineSpec`/`MySQLEngineSpec`
subclasses that share SQL dialect helpers with Postgres/MySQL but run a
materially different query engine (a proprietary appliance, a distributed
SQL engine, or an OLAP engine) must not silently inherit that dict: each
verified engine spec opts in explicitly, everything else stays unsupported
until someone verifies it against a live instance.
"""

from typing import Type

import pytest

from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.cockroachdb import CockroachDbEngineSpec
from superset.db_engine_specs.doris import DorisEngineSpec
from superset.db_engine_specs.greenplum import GreenplumEngineSpec
from superset.db_engine_specs.hana import HanaEngineSpec
from superset.db_engine_specs.hologres import HologresEngineSpec
from superset.db_engine_specs.netezza import NetezzaEngineSpec
from superset.db_engine_specs.oceanbase import OceanBaseEngineSpec
from superset.db_engine_specs.risingwave import RisingWaveDbEngineSpec
from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
from superset.db_engine_specs.starrocks import StarRocksEngineSpec
from superset.db_engine_specs.vertica import VerticaEngineSpec
from superset.db_engine_specs.yugabytedb import YugabyteDBEngineSpec


@pytest.mark.parametrize(
    "spec_cls",
    [
        VerticaEngineSpec,
        NetezzaEngineSpec,
        HanaEngineSpec,
        SnowflakeEngineSpec,
        CockroachDbEngineSpec,
        GreenplumEngineSpec,
        RisingWaveDbEngineSpec,
        YugabyteDBEngineSpec,
        HologresEngineSpec,
        DorisEngineSpec,
        StarRocksEngineSpec,
        OceanBaseEngineSpec,
    ],
)
@pytest.mark.parametrize("aggregate", ["MEDIAN", "STDDEV_SAMP", "VAR_SAMP"])
def test_unverified_postgres_and_mysql_family_specs_reject_extended_aggregations(
    spec_cls: Type[BaseEngineSpec], aggregate: str
) -> None:
    assert spec_cls.get_extended_aggregation_func(aggregate) is None
