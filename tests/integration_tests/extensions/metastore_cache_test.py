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
from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING
from uuid import UUID

import pytest
from flask.ctx import AppContext
from freezegun import freeze_time

if TYPE_CHECKING:
    from superset.extensions.metastore_cache import SupersetMetastoreCache

FIRST_KEY = "foo"
FIRST_KEY_INITIAL_VALUE = {"foo": "bar"}
FIRST_KEY_UPDATED_VALUE = "foo"

SECOND_KEY = "baz"
SECOND_VALUE = "qwerty"


@pytest.fixture
def cache() -> SupersetMetastoreCache:
    from superset.extensions.metastore_cache import SupersetMetastoreCache

    return SupersetMetastoreCache(
        namespace=UUID("ee173d1b-ccf3-40aa-941c-985c15224496"), default_timeout=600,
    )


def test_caching_flow(app_context: AppContext, cache: SupersetMetastoreCache) -> None:
    assert cache.has(FIRST_KEY) is False
    assert cache.add(FIRST_KEY, FIRST_KEY_INITIAL_VALUE) is True
    assert cache.has(FIRST_KEY) is True
    cache.set(SECOND_KEY, SECOND_VALUE)
    assert cache.get(FIRST_KEY) == FIRST_KEY_INITIAL_VALUE
    assert cache.get(SECOND_KEY) == SECOND_VALUE
    assert cache.add(FIRST_KEY, FIRST_KEY_UPDATED_VALUE) is False
    assert cache.get(FIRST_KEY) == FIRST_KEY_INITIAL_VALUE
    assert cache.set(FIRST_KEY, FIRST_KEY_UPDATED_VALUE) == True
    assert cache.get(FIRST_KEY) == FIRST_KEY_UPDATED_VALUE
    cache.delete(FIRST_KEY)
    assert cache.has(FIRST_KEY) is False
    assert cache.get(FIRST_KEY) is None
    assert cache.has(SECOND_KEY)
    assert cache.get(SECOND_KEY) == SECOND_VALUE


def test_expiry(app_context: AppContext, cache: SupersetMetastoreCache) -> None:
    delta = timedelta(days=90)
    dttm = datetime(2022, 3, 18, 0, 0, 0)
    with freeze_time(dttm):
        cache.set(FIRST_KEY, FIRST_KEY_INITIAL_VALUE, int(delta.total_seconds()))
        assert cache.get(FIRST_KEY) == FIRST_KEY_INITIAL_VALUE
    with freeze_time(dttm + delta - timedelta(seconds=1)):
        assert cache.has(FIRST_KEY)
        assert cache.get(FIRST_KEY) == FIRST_KEY_INITIAL_VALUE
    with freeze_time(dttm + delta + timedelta(seconds=1)):
        assert cache.has(FIRST_KEY) is False
        assert cache.get(FIRST_KEY) is None
