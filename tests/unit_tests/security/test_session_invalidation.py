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

from datetime import datetime, timedelta, timezone

from superset.security.session_invalidation import (
    _as_utc_timestamp,
    is_session_invalidated,
)


def test_no_epoch_is_never_invalidated() -> None:
    """A user that was never disabled (NULL epoch) is never invalidated."""
    assert is_session_invalidated(login_at=None, invalidated_at=None) is False
    assert is_session_invalidated(login_at=1_000.0, invalidated_at=None) is False


def test_epoch_with_no_login_time_fails_closed() -> None:
    """A pre-feature session (no _login_at) on a disabled user is invalidated."""
    epoch = datetime.now(timezone.utc)
    assert is_session_invalidated(login_at=None, invalidated_at=epoch) is True


def test_session_before_epoch_is_invalidated() -> None:
    epoch = datetime.now(timezone.utc)
    before = (epoch - timedelta(minutes=5)).timestamp()
    assert is_session_invalidated(login_at=before, invalidated_at=epoch) is True


def test_session_after_epoch_is_valid() -> None:
    """A fresh login after a disable+re-enable must not be invalidated."""
    epoch = datetime.now(timezone.utc)
    after = (epoch + timedelta(minutes=5)).timestamp()
    assert is_session_invalidated(login_at=after, invalidated_at=epoch) is False


def test_login_exactly_at_epoch_is_valid() -> None:
    epoch = datetime.now(timezone.utc)
    assert (
        is_session_invalidated(login_at=epoch.timestamp(), invalidated_at=epoch)
        is False
    )


def test_naive_epoch_is_treated_as_utc() -> None:
    """
    The DB column is a naive UTC ``DateTime``; the comparison must treat it as
    UTC, not local time (otherwise it skews by the local offset).
    """
    aware = datetime(2026, 6, 2, 12, 0, 0, tzinfo=timezone.utc)
    naive = aware.replace(tzinfo=None)
    assert _as_utc_timestamp(naive) == aware.timestamp()

    just_before = aware.timestamp() - 1
    just_after = aware.timestamp() + 1
    assert is_session_invalidated(login_at=just_before, invalidated_at=naive) is True
    assert is_session_invalidated(login_at=just_after, invalidated_at=naive) is False
