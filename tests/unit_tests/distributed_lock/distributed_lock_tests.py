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

# pylint: disable=invalid-name

from typing import Any
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from freezegun import freeze_time
from sqlalchemy.orm import Session, sessionmaker

from superset import db
from superset.distributed_lock import DistributedLock
from superset.distributed_lock.utils import get_key
from superset.exceptions import AcquireDistributedLockFailedException
from superset.key_value.types import JsonKeyValueCodec

MAIN_KEY = get_key("ns", a=1, b=2)
OTHER_KEY = get_key("ns2", a=1, b=2)

# Distributed locking is plumbed through the coordination service: acquire/release
# call CoordinationService.set_value/get_value/delete_value when a backend is
# defined, else the KeyValue table.
BACKEND_DEFINED = "superset.coordination.base.CoordinationService.is_backend_defined"
COORD_SET = "superset.coordination.base.CoordinationService.set_value"
COORD_GET = "superset.coordination.base.CoordinationService.get_value"
COORD_DELETE = "superset.coordination.base.CoordinationService.delete_value"
COORD_CAD = "superset.coordination.base.CoordinationService.compare_and_delete"


def _get_lock(key: UUID, session: Session) -> Any:
    from superset.key_value.models import KeyValueEntry

    entry = db.session.query(KeyValueEntry).filter_by(uuid=key).first()
    if entry is None or entry.is_expired():
        return None

    return JsonKeyValueCodec().decode(entry.value)


def _held(value: Any) -> bool:
    """A lock value is an ownership token dict once acquired."""
    return isinstance(value, dict) and isinstance(value.get("token"), str)


def _get_other_session() -> Session:
    # This session is used to simulate what another worker will find in the metastore
    # during the locking process.
    from superset import db

    bind = db.session.get_bind()
    SessionMaker = sessionmaker(bind=bind)  # noqa: N806
    return SessionMaker()


def _fake_coordination_backend() -> dict[str, Any]:
    """Patchable set/get/delete/compare-and-delete closures over one store.

    Faithfully models SET NX + GET + DELETE + atomic compare-and-delete so the
    ownership-checked release exercises end to end under mocking.
    """
    store: dict[str, Any] = {}

    def _set(  # noqa: PLR0913
        key: str,
        value: Any,
        ttl: int | None = None,
        if_absent: bool = False,
        if_present: bool = False,
        backend: Any = None,
    ) -> bool | None:
        if if_absent and key in store:
            return None
        store[key] = value
        return True

    def _get(key: str, backend: Any = None) -> Any:
        return store.get(key)

    def _delete(*keys: str, backend: Any = None) -> int:
        return sum(1 for k in keys if store.pop(k, None) is not None)

    def _compare_and_delete(key: str, expected: str, backend: Any = None) -> int:
        # Atomic: delete only if the stored value still equals ``expected``.
        if store.get(key) == expected:
            store.pop(key, None)
            return 1
        return 0

    return {
        "store": store,
        "set": _set,
        "get": _get,
        "delete": _delete,
        "compare_and_delete": _compare_and_delete,
    }


def test_distributed_lock_kv_happy_path() -> None:
    """
    Test successfully acquiring and returning the distributed lock via KV backend.

    Note, we're using another session for asserting the lock state in the Metastore
    to simulate what another worker will observe. Otherwise, there's the risk that
    the assertions would only be using the non-committed state from the main session.
    """
    session = _get_other_session()

    # Ensure no backend is defined so the KV backend is used
    with patch(BACKEND_DEFINED, return_value=False):
        with freeze_time("2021-01-01"):
            assert _get_lock(MAIN_KEY, session) is None

            with DistributedLock("ns", a=1, b=2) as key:
                assert key == MAIN_KEY
                assert _held(_get_lock(key, session))
                assert _get_lock(OTHER_KEY, session) is None

                with pytest.raises(AcquireDistributedLockFailedException):
                    with DistributedLock("ns", a=1, b=2):
                        pass

            assert _get_lock(MAIN_KEY, session) is None


def test_distributed_lock_kv_expired() -> None:
    """
    Test expiration of the distributed lock via KV backend.

    Note, we're using another session for asserting the lock state in the Metastore
    to simulate what another worker will observe. Otherwise, there's the risk that
    the assertions would only be using the non-committed state from the main session.
    """
    session = _get_other_session()

    # Ensure no backend is defined so the KV backend is used
    with patch(BACKEND_DEFINED, return_value=False):
        with freeze_time("2021-01-01"):
            assert _get_lock(MAIN_KEY, session) is None
            with DistributedLock("ns", a=1, b=2):
                assert _held(_get_lock(MAIN_KEY, session))
                with freeze_time("2022-01-01"):
                    assert _get_lock(MAIN_KEY, session) is None

            assert _get_lock(MAIN_KEY, session) is None


def test_distributed_lock_kv_release_only_deletes_own_lock() -> None:
    """A stale KV lock re-acquired by another holder is not released by the first.

    Simulates holder A's TTL lapsing and holder B acquiring the same key: A's
    release must not delete B's lock (ownership check on the stored token).
    """
    from superset.commands.distributed_lock.acquire import AcquireDistributedLock
    from superset.commands.distributed_lock.release import ReleaseDistributedLock

    session = _get_other_session()

    with patch(BACKEND_DEFINED, return_value=False):
        # Holder B currently owns the lock.
        AcquireDistributedLock("ns", {"a": 1, "b": 2}).run()
        b_value = _get_lock(MAIN_KEY, session)
        assert _held(b_value)

        # Holder A (a superseded acquisition with a different token) releases.
        ReleaseDistributedLock("ns", {"a": 1, "b": 2}, token="stale-token-a").run()  # noqa: S106

        # B's lock survives.
        assert _get_lock(MAIN_KEY, session) == b_value


def test_distributed_lock_kv_release_row_locks_the_entry() -> None:
    """The KV release reads the entry with ``for_update=True`` so the ownership
    check and the delete are atomic against a concurrent expire+re-acquire (the KV
    equivalent of the Redis compare-and-delete). A token mismatch leaves it alone."""
    from superset.commands.distributed_lock.release import ReleaseDistributedLock

    cmd = ReleaseDistributedLock("ns", {"a": 1, "b": 2}, token="mine")  # noqa: S106
    other_holder = MagicMock()
    other_holder.is_expired.return_value = False
    # A different acquisition now owns the row.
    with (
        patch(BACKEND_DEFINED, return_value=False),
        patch(
            "superset.commands.distributed_lock.release.KeyValueDAO.get_entry",
            return_value=other_holder,
        ) as get_entry,
        patch.object(cmd.codec, "decode", return_value={"token": "theirs"}),
        patch("superset.commands.distributed_lock.release.db") as db_mock,
    ):
        cmd._release_kv()

    # The entry was row-locked for the ownership-checked delete...
    assert get_entry.call_args.kwargs.get("for_update") is True
    # ...and, since the token did not match, another holder's lock was NOT deleted.
    db_mock.session.delete.assert_not_called()


def test_distributed_lock_uses_redis_when_configured() -> None:
    """Test that DistributedLock uses the coordination backend when configured."""
    fake = _fake_coordination_backend()
    with (
        patch(BACKEND_DEFINED, return_value=True),
        patch(COORD_SET, side_effect=fake["set"]) as mock_set,
        patch(COORD_GET, side_effect=fake["get"]),
        patch(COORD_DELETE, side_effect=fake["delete"]),
        patch(COORD_CAD, side_effect=fake["compare_and_delete"]) as mock_cad,
    ):
        with DistributedLock("test_redis", key="value") as lock_key:
            assert lock_key is not None
            # Verify SET NX EX was called
            mock_set.assert_called_once()
            call_args = mock_set.call_args
            assert call_args.kwargs["if_absent"] is True
            assert "ttl" in call_args.kwargs

        # Verify the ownership-checked (atomic compare-and-delete) release ran on
        # exit and the lock is actually gone.
        mock_cad.assert_called_once()
        assert fake["store"] == {}


def test_distributed_lock_redis_release_only_deletes_own_lock() -> None:
    """Redis release must not delete a lock a different acquisition now owns."""
    from superset.commands.distributed_lock.release import ReleaseDistributedLock

    fake = _fake_coordination_backend()
    with (
        patch(BACKEND_DEFINED, return_value=True),
        patch(COORD_SET, side_effect=fake["set"]),
        patch(COORD_GET, side_effect=fake["get"]),
        patch(COORD_DELETE, side_effect=fake["delete"]),
        patch(COORD_CAD, side_effect=fake["compare_and_delete"]),
    ):
        # Holder B owns the key.
        with DistributedLock("test_redis", key="value"):
            b_token = next(iter(fake["store"].values()))

            # A superseded holder A releases with its own (different) token.
            ReleaseDistributedLock(
                "test_redis",
                {"key": "value"},
                token="stale-token-a",  # noqa: S106
            ).run()

            # A's compare-and-delete matched nothing; B still holds the key.
            assert next(iter(fake["store"].values())) == b_token


def test_distributed_lock_redis_already_taken() -> None:
    """Test Redis lock fails when already held."""
    with (
        patch(BACKEND_DEFINED, return_value=True),
        patch(COORD_SET, return_value=None),  # Lock not acquired (already taken)
    ):
        with pytest.raises(AcquireDistributedLockFailedException):
            with DistributedLock("test_redis", key="value"):
                pass


def test_distributed_lock_redis_connection_error() -> None:
    """Test Redis connection error raises exception (fail fast)."""
    import redis

    with (
        patch(BACKEND_DEFINED, return_value=True),
        patch(COORD_SET, side_effect=redis.RedisError("Connection failed")),
    ):
        with pytest.raises(AcquireDistributedLockFailedException):
            with DistributedLock("test_redis", key="value"):
                pass


def test_distributed_lock_custom_ttl() -> None:
    """Test Redis lock with custom TTL."""
    fake = _fake_coordination_backend()
    with (
        patch(BACKEND_DEFINED, return_value=True),
        patch(COORD_SET, side_effect=fake["set"]) as mock_set,
        patch(COORD_GET, side_effect=fake["get"]),
        patch(COORD_DELETE, side_effect=fake["delete"]),
        patch(COORD_CAD, side_effect=fake["compare_and_delete"]),
    ):
        with DistributedLock("test", ttl_seconds=60, key="value"):
            call_args = mock_set.call_args
            assert call_args.kwargs["ttl"] == 60  # Custom TTL


def test_distributed_lock_default_ttl(app_context: None) -> None:
    """Test Redis lock uses default TTL when not specified."""
    from superset.commands.distributed_lock.base import get_default_lock_ttl

    fake = _fake_coordination_backend()
    with (
        patch(BACKEND_DEFINED, return_value=True),
        patch(COORD_SET, side_effect=fake["set"]) as mock_set,
        patch(COORD_GET, side_effect=fake["get"]),
        patch(COORD_DELETE, side_effect=fake["delete"]),
        patch(COORD_CAD, side_effect=fake["compare_and_delete"]),
    ):
        with DistributedLock("test", key="value"):
            call_args = mock_set.call_args
            assert call_args.kwargs["ttl"] == get_default_lock_ttl()


def test_distributed_lock_fallback_to_kv_when_redis_not_configured() -> None:
    """Test falls back to KV lock when no backend is configured."""
    session = _get_other_session()
    test_key = get_key("test_fallback", key="value")

    with patch(BACKEND_DEFINED, return_value=False):
        with freeze_time("2021-01-01"):
            # When no backend is defined, should use KV backend
            with DistributedLock("test_fallback", key="value") as lock_key:
                assert lock_key == test_key
                # Verify lock exists in KV store
                assert _held(_get_lock(test_key, session))

            # Lock should be released
            assert _get_lock(test_key, session) is None
