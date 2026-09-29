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
Session hygiene for ``SupersetMetastoreCache``.

Cache reads and writes are best-effort: every caller swallows the failure and
carries on, treating it as a miss. When the backend is the metadata database
that leaves ``db.session`` in "pending rollback" state, so the work the caller
carries on to do fails on this cache call rather than on its own merits. These
methods therefore repair the session before letting the error propagate.
"""

from uuid import UUID

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.exc import SQLAlchemyError

from superset.extensions.metastore_cache import SupersetMetastoreCache
from superset.key_value.types import JsonKeyValueCodec

NAMESPACE = UUID("ee173d1b-ccf3-40aa-a3b1-e2e73e56d3c1")


@pytest.fixture
def cache() -> SupersetMetastoreCache:
    return SupersetMetastoreCache(namespace=NAMESPACE, codec=JsonKeyValueCodec())


def test_get_rolls_back_and_reraises_on_db_error(
    cache: SupersetMetastoreCache,
    mocker: MockerFixture,
) -> None:
    error = SQLAlchemyError("connection lost")
    mocker.patch(
        "superset.daos.key_value.KeyValueDAO.get_value",
        side_effect=error,
    )
    session = mocker.patch("superset.extensions.metastore_cache.db").session

    with pytest.raises(SQLAlchemyError) as exc_info:
        cache.get("some-key")

    # The original error, not a wrapped or swallowed one: callers decide what a
    # failed read means, and this method only repairs the session on the way out.
    assert exc_info.value is error
    session.rollback.assert_called_once()


def test_set_rolls_back_and_reraises_on_db_error(
    cache: SupersetMetastoreCache,
    mocker: MockerFixture,
) -> None:
    error = SQLAlchemyError("connection lost")
    mocker.patch(
        "superset.daos.key_value.KeyValueDAO.upsert_entry",
        side_effect=error,
    )
    session = mocker.patch("superset.extensions.metastore_cache.db").session

    with pytest.raises(SQLAlchemyError) as exc_info:
        cache.set("some-key", {"a": 1})

    assert exc_info.value is error
    session.rollback.assert_called_once()


def test_get_does_not_roll_back_when_healthy(
    cache: SupersetMetastoreCache,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.daos.key_value.KeyValueDAO.get_value",
        return_value={"a": 1},
    )
    session = mocker.patch("superset.extensions.metastore_cache.db").session

    assert cache.get("some-key") == {"a": 1}
    session.rollback.assert_not_called()
