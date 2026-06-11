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

# Force module loading before tests run so patches work correctly
import superset.commands.distributed_lock.acquire as acquire_module
import superset.commands.distributed_lock.release as release_module
from superset import db
from superset.distributed_lock import DistributedLock
from superset.distributed_lock.types import LockValue
from superset.distributed_lock.utils import get_key
from superset.exceptions import AcquireDistributedLockFailedException
from superset.key_value.types import JsonKeyValueCodec

LOCK_VALUE: LockValue = {"value": True}
MAIN_KEY = get_key("ns", a=1, b=2)
OTHER_KEY = get_key("ns2", a=1, b=2)


def _get_lock(key: UUID, session: Session) -> Any:
    from superset.key_value.models import KeyValueEntry

    entry = db.session.query(KeyValueEntry).filter_by(uuid=key).first()
    if entry is None or entry.is_expired():
        return None

    return JsonKeyValueCodec().decode(entry.value)


def _get_other_session() -> Session:
    # This session is used to simulate what another worker will find in the metastore
    # during the locking process.
    from superset import db

    bind = db.session.get_bind()
    SessionMaker = sessionmaker(bind=bind)  # noqa: N806
    return SessionMaker()


def test_distributed_lock_kv_happy_path() -> None:
    """
    Test successfully acquiring and returning the distributed lock via KV backend.

    Note, we're using another session for asserting the lock state in the Metastore
    to simulate what another worker will observe. Otherwise, there's the risk that
    the assertions would only be using the non-committed state from the main session.
    """
    session = _get_other_session()

    # Ensure Redis is not configured so KV backend is used
    with (
        patch.object(acquire_module, "get_redis_client", return_value=None),
        patch.object(release_module, "get_redis_client", return_value=None),
    ):
        with freeze_time("2021-01-01"):
            assert _get_lock(MAIN_KEY, session) is None

            with DistributedLock("ns", a=1, b=2) as key:
                assert key == MAIN_KEY
                assert _get_lock(key, session) == LOCK_VALUE
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

    # Ensure Redis is not configured so KV backend is used
    with (
        patch.object(acquire_module, "get_redis_client", return_value=None),
        patch.object(release_module, "get_redis_client", return_value=None),
    ):
        with freeze_time("2021-01-01"):
            assert _get_lock(MAIN_KEY, session) is None
            with DistributedLock("ns", a=1, b=2):
                assert _get_lock(MAIN_KEY, session) == LOCK_VALUE
                with freeze_time("2022-01-01"):
                    assert _get_lock(MAIN_KEY, session) is None

            assert _get_lock(MAIN_KEY, session) is None


def test_distributed_lock_uses_redis_when_configured() -> None:
    """Test that DistributedLock uses Redis backend when configured."""
    mock_redis = MagicMock()
    mock_redis.set.return_value = True  # Lock acquired

    # Use patch.object to patch on already-imported modules
    with (
        patch.object(acquire_module, "get_redis_client", return_value=mock_redis),
        patch.object(release_module, "get_redis_client", return_value=mock_redis),
    ):
        with DistributedLock("test_redis", key="value") as lock_key:
            assert lock_key is not None
            # Verify SET NX EX was called
            mock_redis.set.assert_called_once()
            call_args = mock_redis.set.call_args
            assert call_args.kwargs["nx"] is True
            assert "ex" in call_args.kwargs

        # Verify DELETE was called on exit
        mock_redis.delete.assert_called_once()


def test_distributed_lock_redis_already_taken() -> None:
    """Test Redis lock fails when already held."""
    mock_redis = MagicMock()
    mock_redis.set.return_value = None  # Lock not acquired (already taken)

    with patch.object(acquire_module, "get_redis_client", return_value=mock_redis):
        with pytest.raises(AcquireDistributedLockFailedException):
            with DistributedLock("test_redis", key="value"):
                pass


def test_distributed_lock_redis_connection_error() -> None:
    """Test Redis connection error raises exception (fail fast)."""
    import redis

    mock_redis = MagicMock()
    mock_redis.set.side_effect = redis.RedisError("Connection failed")

    with patch.object(acquire_module, "get_redis_client", return_value=mock_redis):
        with pytest.raises(AcquireDistributedLockFailedException):
            with DistributedLock("test_redis", key="value"):
                pass


def test_distributed_lock_custom_ttl() -> None:
    """Test Redis lock with custom TTL."""
    mock_redis = MagicMock()
    mock_redis.set.return_value = True

    with (
        patch.object(acquire_module, "get_redis_client", return_value=mock_redis),
        patch.object(release_module, "get_redis_client", return_value=mock_redis),
    ):
        with DistributedLock("test", ttl_seconds=60, key="value"):
            call_args = mock_redis.set.call_args
            assert call_args.kwargs["ex"] == 60  # Custom TTL


def test_distributed_lock_default_ttl(app_context: None) -> None:
    """Test Redis lock uses default TTL when not specified."""
    from superset.commands.distributed_lock.base import get_default_lock_ttl

    mock_redis = MagicMock()
    mock_redis.set.return_value = True

    with (
        patch.object(acquire_module, "get_redis_client", return_value=mock_redis),
        patch.object(release_module, "get_redis_client", return_value=mock_redis),
    ):
        with DistributedLock("test", key="value"):
            call_args = mock_redis.set.call_args
            assert call_args.kwargs["ex"] == get_default_lock_ttl()


def test_distributed_lock_fallback_to_kv_when_redis_not_configured() -> None:
    """Test falls back to KV lock when Redis not configured."""
    session = _get_other_session()
    test_key = get_key("test_fallback", key="value")

    with (
        patch.object(acquire_module, "get_redis_client", return_value=None),
        patch.object(release_module, "get_redis_client", return_value=None),
    ):
        with freeze_time("2021-01-01"):
            # When Redis is not configured, should use KV backend
            with DistributedLock("test_fallback", key="value") as lock_key:
                assert lock_key == test_key
                # Verify lock exists in KV store
                assert _get_lock(test_key, session) == LOCK_VALUE

            # Lock should be released
            assert _get_lock(test_key, session) is None
