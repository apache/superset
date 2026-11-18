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
"""Extension storage's writes under the real key-value lock, as a race runs them."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any
from unittest.mock import patch

import pytest

from superset.commands.distributed_lock.acquire import AcquireDistributedLock
from superset.commands.distributed_lock.release import ReleaseDistributedLock
from superset.exceptions import LockAlreadyHeldException
from superset.extensions.context import use_context
from superset.extensions.storage.persistent import SharedPersistentStateAccessor
from superset.extensions.storage.persistent_dao import ExtensionStorageDAO
from tests.unit_tests.extensions.storage.conftest import create_context

EXTENSION_ID = "test-org.test-ext"
# The lock backend Superset falls back to without DISTRIBUTED_COORDINATION_CONFIG.
NO_COORDINATION_BACKEND = patch(
    "superset.coordination.base.CoordinationService.is_backend_defined",
    return_value=False,
)


@pytest.fixture
def tables(app_context: None) -> None:
    from superset import db
    from superset.extensions.storage.persistent_model import ExtensionStorage
    from superset.key_value.models import KeyValueEntry

    ExtensionStorage.metadata.create_all(db.engine)  # pylint: disable=no-member
    KeyValueEntry.metadata.create_all(db.engine)  # pylint: disable=no-member


def other_writer_holds_the_lock() -> Callable[[float], None]:
    """
    Another worker holds the extension's lock, its row committed. The function
    returned plays that worker finishing, the first time the caller backs off:
    it releases its lock, then writes the key.
    """
    holder = AcquireDistributedLock(
        "extension_storage_set", {"extension_id": EXTENSION_ID}, 5
    )
    holder.run()
    finished = False

    def finish(_seconds: float) -> None:
        nonlocal finished
        if finished:
            return
        finished = True
        ReleaseDistributedLock(
            "extension_storage_set", {"extension_id": EXTENSION_ID}, token=holder.token
        ).run()
        ExtensionStorageDAO.set(EXTENSION_ID, "key", b'{"by": "holder"}')

    return finish


def write(operation: Callable[[SharedPersistentStateAccessor], Any]) -> Any:
    with use_context(create_context()):
        return operation(SharedPersistentStateAccessor())


def test_a_compare_and_set_that_loses_the_race_answers_false(tables: None) -> None:
    with NO_COORDINATION_BACKEND:
        holder_finishes = other_writer_holds_the_lock()
        with patch("time.sleep", side_effect=holder_finishes):
            written = write(
                lambda storage: storage.compare_and_set("key", None, {"by": "me"})
            )
        stored = write(lambda storage: storage.get("key"))

    assert written is False
    assert stored == {"by": "holder"}


def test_a_set_waits_its_turn_behind_the_lock(tables: None) -> None:
    with NO_COORDINATION_BACKEND:
        holder_finishes = other_writer_holds_the_lock()
        with patch("time.sleep", side_effect=holder_finishes):
            write(lambda storage: storage.set("key", {"by": "me"}))
        stored = write(lambda storage: storage.get("key"))

    assert stored == {"by": "me"}


def test_a_lock_held_throughout_is_reported_as_held(tables: None) -> None:
    with NO_COORDINATION_BACKEND:
        AcquireDistributedLock(
            "extension_storage_set", {"extension_id": EXTENSION_ID}, 5
        ).run()
        with patch("time.sleep"), pytest.raises(LockAlreadyHeldException):
            write(lambda storage: storage.compare_and_set("key", None, {"v": 1}))


def test_a_compare_and_set_that_outlives_its_lock_writes_nothing_stale(
    tables: None,
) -> None:
    from superset import db
    from superset.extensions.storage import persistent_dao
    from superset.key_value.models import KeyValueEntry

    check_quota = persistent_dao._check_quota
    results: list[tuple[str, bool]] = []
    lapsed: list[bool] = []

    def outlive_the_lock(*args: Any, **kwargs: Any) -> None:
        if not lapsed:
            lapsed.append(True)
            # The first writer's lock ran out here, after its comparison and
            # before its write; another writer then runs a whole write.
            db.session.query(KeyValueEntry).delete()
            db.session.commit()  # pylint: disable=consider-using-transaction
            results.append(
                (
                    "second",
                    write(
                        lambda storage: storage.compare_and_set(
                            "key", {"v": 1}, {"v": "second"}
                        )
                    ),
                )
            )
        check_quota(*args, **kwargs)

    with NO_COORDINATION_BACKEND:
        write(lambda storage: storage.set("key", {"v": 1}))
        with patch.object(persistent_dao, "_check_quota", side_effect=outlive_the_lock):
            results.append(
                (
                    "first",
                    write(
                        lambda storage: storage.compare_and_set(
                            "key", {"v": 1}, {"v": "first"}
                        )
                    ),
                )
            )
        stored = write(lambda storage: storage.get("key"))

    assert results == [("second", True), ("first", False)]
    assert stored == {"v": "second"}
