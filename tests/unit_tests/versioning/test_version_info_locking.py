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
recreating the lost update the lock + If-Match pair exists to prevent.
(The entity read one layer down has the same staleness class; the fix
proposed in apache/superset#44027 addresses it there.) These are the
dialect-independent statement-shape guards: the conditional-path
transaction-id read must be an exclusive locking read (exempt from the
snapshot; exclusive so this transaction's own later close of the row
cannot deadlock on a shared-to-exclusive upgrade) and
``current_entity_version_info`` must thread the flag -- with the default
(every GET path) never invoking the locking read at all. The real-database
proof lives in
tests/integration_tests/versioning/conditional_token_lock_tests.py.
"""

from unittest.mock import MagicMock
from uuid import uuid4

from pytest_mock import MockerFixture

from superset.versioning.api_helpers import current_entity_version_info
from superset.versioning.queries import current_live_transaction_id_locked


def _mock_queries_db(mocker: MockerFixture) -> MagicMock:
    db = MagicMock()
    mocker.patch("superset.versioning.queries.db", new=db)
    mocker.patch("superset.versioning.queries.version_class", new=MagicMock())
    return db


def test_locked_read_is_an_exclusive_locking_row_read(mocker: MockerFixture) -> None:
    """The conditional-path read chains an exclusive with_for_update().

    Exclusive, not read=True: this transaction later closes the row it
    reads (Continuum sets end_transaction_id at commit), and a shared
    lock first would invite the shared-to-exclusive upgrade deadlock.
    Dropping the locking clause -- or weakening it back to shared --
    fails here on every backend. Ordered-and-limited so a defensive
    multi-open-row state cannot raise MultipleResultsFound.
    """
    db = _mock_queries_db(mocker)

    current_live_transaction_id_locked(MagicMock(), 1, uuid4())

    query = db.session.query.return_value
    filtered = query.filter.return_value.filter.return_value
    limited = filtered.order_by.return_value.limit.return_value
    limited.with_for_update.assert_called_once_with()
    limited.with_for_update.return_value.scalar.assert_called_once_with()


def test_version_info_threads_the_lock_flag(mocker: MockerFixture) -> None:
    """lock_for_stale_check=True swaps in the locked transaction id."""
    dao = MagicMock()
    dao.current_version_info.return_value = (0, 5)
    dao.current_live_transaction_id_locked.return_value = 6
    mocker.patch("superset.versioning.api_helpers.VersionDAO", new=dao)
    mocker.patch("superset.versioning.api_helpers._capture_enabled", return_value=True)
    entity_uuid = uuid4()

    info = current_entity_version_info(
        MagicMock(), 1, entity_uuid, lock_for_stale_check=True
    )

    dao.current_live_transaction_id_locked.assert_called_once()
    assert info.transaction_id == 6
    # The guard actually consumes version_uuid (concurrency_token_from), so
    # pin that the token derives from the LOCKED id -- reordering the swap
    # below the uuid derivation would break the guard with transaction_id
    # still reporting the fresh value.
    dao.derive_version_uuid.assert_called_once_with(entity_uuid, 6)


def test_version_info_defaults_to_plain_reads(mocker: MockerFixture) -> None:
    """Without the flag (every GET path) the locking read never runs."""
    dao = MagicMock()
    dao.current_version_info.return_value = (0, 5)
    mocker.patch("superset.versioning.api_helpers.VersionDAO", new=dao)
    mocker.patch("superset.versioning.api_helpers._capture_enabled", return_value=True)

    info = current_entity_version_info(MagicMock(), 1, uuid4())

    dao.current_live_transaction_id_locked.assert_not_called()
    assert info.transaction_id == 5
