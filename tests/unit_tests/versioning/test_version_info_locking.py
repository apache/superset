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
"""sc-120050: the If-Match validator reads committed state under lock.

On MySQL/InnoDB REPEATABLE READ a plain consistent read is served from the
snapshot pinned by the request's first read, so the version-info lookup
behind ``raise_for_stale_write`` could miss a concurrently committed
version row -- a stale client token then matched and the 412 was skipped,
recreating the lost update the lock + If-Match pair exists to prevent
(the validator-layer sibling of the entity fix in apache/superset#44027).
These are the dialect-independent statement-shape guards: the
conditional-path transaction-id read must carry ``with_for_update(read=True)``
(a locking read is exempt from the snapshot) and
``current_entity_version_info`` must thread the flag -- with the default
(every GET path) never invoking the locking read at all. The real-database
proof lives in
tests/integration_tests/versioning/conditional_token_lock_tests.py.
"""

from unittest.mock import MagicMock
from uuid import uuid4

from pytest_mock import MockerFixture

from superset.versioning.api_helpers import current_entity_version_info
from superset.versioning.queries import current_live_transaction_id_for_share


def _mock_queries_db(mocker: MockerFixture) -> MagicMock:
    db = MagicMock()
    mocker.patch("superset.versioning.queries.db", new=db)
    mocker.patch("superset.versioning.queries.version_class", new=MagicMock())
    return db


def test_for_share_read_is_a_locking_row_read(mocker: MockerFixture) -> None:
    """The conditional-path read chains with_for_update(read=True).

    Dropping the flag (or the whole locking clause) fails here on every
    backend -- the analogue of the shape pins on the entity lock.
    """
    db = _mock_queries_db(mocker)

    current_live_transaction_id_for_share(MagicMock(), 1, uuid4())

    query = db.session.query.return_value
    filtered = query.filter.return_value.filter.return_value
    filtered.with_for_update.assert_called_once_with(read=True)
    filtered.with_for_update.return_value.scalar.assert_called_once_with()


def test_version_info_threads_the_lock_flag(mocker: MockerFixture) -> None:
    """lock_for_stale_check=True swaps in the FOR SHARE transaction id."""
    dao = MagicMock()
    dao.current_version_info.return_value = (0, 5)
    dao.current_live_transaction_id_for_share.return_value = 6
    mocker.patch("superset.versioning.api_helpers.VersionDAO", new=dao)
    mocker.patch("superset.versioning.api_helpers._capture_enabled", return_value=True)
    entity_uuid = uuid4()

    info = current_entity_version_info(
        MagicMock(), 1, entity_uuid, lock_for_stale_check=True
    )

    dao.current_live_transaction_id_for_share.assert_called_once()
    # The guard's input is the locked value, not the snapshot aggregate's.
    assert info.transaction_id == 6


def test_version_info_defaults_to_plain_reads(mocker: MockerFixture) -> None:
    """Without the flag (every GET path) the locking read never runs."""
    dao = MagicMock()
    dao.current_version_info.return_value = (0, 5)
    mocker.patch("superset.versioning.api_helpers.VersionDAO", new=dao)
    mocker.patch("superset.versioning.api_helpers._capture_enabled", return_value=True)

    info = current_entity_version_info(MagicMock(), 1, uuid4())

    dao.current_live_transaction_id_for_share.assert_not_called()
    assert info.transaction_id == 5
