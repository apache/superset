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
The ``supports_grouping_sets`` engine capability gates the single-query
GROUPING SETS collapse of the pivot table's per-rollup-level queries (SIP.md,
phase 3). It defaults to False and is opted into by engines with native support.
"""

from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.bigquery import BigQueryEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.db_engine_specs.presto import PrestoBaseEngineSpec
from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
from superset.db_engine_specs.sqlite import SqliteEngineSpec


def test_base_default_is_false() -> None:
    assert BaseEngineSpec.supports_grouping_sets is False
    # SQLite has no GROUPING SETS support and must keep the conservative default.
    assert SqliteEngineSpec.supports_grouping_sets is False


def test_supporting_engines_opt_in() -> None:
    assert PostgresEngineSpec.supports_grouping_sets is True
    assert BigQueryEngineSpec.supports_grouping_sets is True
    assert SnowflakeEngineSpec.supports_grouping_sets is True
    # Trino inherits from PrestoBaseEngineSpec.
    assert PrestoBaseEngineSpec.supports_grouping_sets is True
