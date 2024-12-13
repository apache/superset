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
from uuid import UUID

import pytest
from freezegun import freeze_time
from sqlalchemy.orm import Session, sessionmaker

from superset import db
from superset.distributed_lock import KeyValueDistributedLock
from superset.distributed_lock.types import LockValue
from superset.distributed_lock.utils import get_key
from superset.exceptions import CreateKeyValueDistributedLockFailedException
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


def test_key_value_distributed_lock_happy_path() -> None:
    """
    Test successfully acquiring and returning the distributed lock.

    Note, we're using another session for asserting the lock state in the Metastore
    to simulate what another worker will observe. Otherwise, there's the risk that
    the assertions would only be using the non-committed state from the main session.
    """
    session = _get_other_session()

    with freeze_time("2021-01-01"):
        assert _get_lock(MAIN_KEY, session) is None

        with KeyValueDistributedLock("ns", a=1, b=2) as key:
            assert key == MAIN_KEY
            assert _get_lock(key, session) == LOCK_VALUE
            assert _get_lock(OTHER_KEY, session) is None

            with pytest.raises(CreateKeyValueDistributedLockFailedException):
                with KeyValueDistributedLock("ns", a=1, b=2):
                    pass

        assert _get_lock(MAIN_KEY, session) is None


def test_key_value_distributed_lock_expired() -> None:
    """
    Test expiration of the distributed lock

    Note, we're using another session for asserting the lock state in the Metastore
    to simulate what another worker will observe. Otherwise, there's the risk that
    the assertions would only be using the non-committed state from the main session.
    """
    session = _get_other_session()

    with freeze_time("2021-01-01"):
        assert _get_lock(MAIN_KEY, session) is None
        with KeyValueDistributedLock("ns", a=1, b=2):
            assert _get_lock(MAIN_KEY, session) == LOCK_VALUE
            with freeze_time("2022-01-01"):
                assert _get_lock(MAIN_KEY, session) is None

        assert _get_lock(MAIN_KEY, session) is None
