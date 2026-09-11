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
"""Pin the harness guarantee behind ``_preload_clock_reading_drivers``.

``clickhouse_connect`` reads the local timezone at import time and fails
under a ``freeze_time`` clock, so the unit-test session imports it before any
test runs. A test can therefore resolve the ClickHouse engine spec under a
frozen clock on any worker, regardless of what ran before it. This test
asserts that guarantee directly; if the preload fixture is removed, it fails
on any worker where nothing else happened to import the driver first.
"""

import importlib.util
import sys

import pytest
from freezegun import freeze_time


@pytest.mark.skipif(
    importlib.util.find_spec("clickhouse_connect") is None,
    reason="clickhouse_connect is not installed",
)
def test_clock_reading_driver_is_preloaded_before_tests() -> None:
    assert "clickhouse_connect" in sys.modules


@pytest.mark.skipif(
    importlib.util.find_spec("clickhouse_connect") is None,
    reason="clickhouse_connect is not installed",
)
@freeze_time("2021-04-01T00:00:00Z")
def test_clickhouse_engine_spec_resolves_under_frozen_clock() -> None:
    from superset.db_engine_specs import get_engine_spec

    assert get_engine_spec("clickhousedb", "connect") is not None
