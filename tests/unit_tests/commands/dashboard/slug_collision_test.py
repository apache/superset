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
"""sc-107581: slug collisions with soft-deleted dashboards get guidance.

On the full-constraint dialects a soft-deleted dashboard still blocks its
slug at flush; these pins cover the translation helper: a deleted holder
turns the IntegrityError into a 422 naming the holder and the restore
endpoint, anything else re-raises untouched, and no probe runs when no
slug is in play.
"""

from sqlite3 import IntegrityError as SQLiteIntegrityError
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.exc import IntegrityError

from superset.commands.dashboard.exceptions import DashboardInvalidError
from superset.commands.soft_delete_collisions import (
    raise_for_soft_deleted_slug_collision,
)

_FINDER: str = "superset.commands.soft_delete_collisions.find_soft_deleted_slot_holder"


def _slug_error() -> IntegrityError:
    """Build a wrapper with a recognized SQLite slug diagnostic."""
    return IntegrityError(
        None, None, SQLiteIntegrityError("UNIQUE constraint failed: dashboards.slug")
    )


def _pg_error(
    name: str | None, code: str = "23505", *, psycopg3: bool = False
) -> IntegrityError:
    """Build a PostgreSQL driver diagnostic without importing the driver."""
    orig: MagicMock = MagicMock(spec=Exception)
    orig.pgcode = None if psycopg3 else code
    orig.sqlstate = code if psycopg3 else None
    orig.diag = MagicMock()
    orig.diag.constraint_name = name
    return IntegrityError(None, None, orig)


def _mysql_error(key: str, errno: int = 1062) -> IntegrityError:
    """Include both MySQL errno and its non-PostgreSQL SQLSTATE."""
    orig: MagicMock = MagicMock(spec=Exception)
    orig.args = (errno, f"Duplicate entry 'x' for key '{key}'")
    orig.sqlstate = "23000"
    return IntegrityError(None, None, orig)


@pytest.fixture(autouse=True)
def no_live_holder(mocker: MockerFixture) -> None:
    """Keep helper unit tests independent of database contents."""
    db_mock: MagicMock = mocker.patch("superset.db")
    db_mock.session.query.return_value.filter.return_value.first.return_value = None


def test_deleted_holder_translates_to_guidance(mocker: MockerFixture) -> None:
    holder: MagicMock = MagicMock()
    holder.uuid = "abcd-1234"
    mocker.patch(_FINDER, return_value=holder)
    cause: IntegrityError = _slug_error()

    with pytest.raises(DashboardInvalidError) as excinfo:
        raise_for_soft_deleted_slug_collision("q1-report", cause)

    messages: str = str(excinfo.value.normalized_messages())
    assert "abcd-1234" in messages
    assert "/api/v1/dashboard/abcd-1234/restore" in messages
    assert excinfo.value.__cause__ is cause


def test_no_deleted_holder_returns_so_caller_reraises(
    mocker: MockerFixture,
) -> None:
    """A conflict NOT caused by a soft-deleted row must not be masked."""
    finder: MagicMock = mocker.patch(_FINDER, return_value=None)

    # Returning (rather than raising) is the contract that lets the caller
    # re-raise the original IntegrityError unmasked.
    raise_for_soft_deleted_slug_collision("q1-report", _slug_error())
    finder.assert_called_once()


def test_no_slug_skips_the_probe(mocker: MockerFixture) -> None:
    """Only ``None`` means "no slug sent" and skips the probe entirely."""
    finder: MagicMock = mocker.patch(_FINDER)

    raise_for_soft_deleted_slug_collision(None, Exception("boom"))

    finder.assert_not_called()


def test_empty_string_slug_is_probed(mocker: MockerFixture) -> None:
    """An empty string is a real, storable slug value and IS probed.

    The PUT schema accepts a zero-length slug and the uniqueness
    prechecks compare every non-None value, so a collision on ""
    deserves the same translation as any other."""
    finder: MagicMock = mocker.patch(_FINDER, return_value=None)

    raise_for_soft_deleted_slug_collision("", _slug_error())

    finder.assert_called_once()


def test_live_holder_wins_over_archived_namesake(mocker: MockerFixture) -> None:
    """A LIVE holder means the original error stands — no restore advice.

    The race: archived A holds slug s; this request passes the live
    uniqueness precheck; another request commits a live dashboard with s;
    this request's flush then fails against the LIVE row. Advising a
    restore of archived A could never resolve that conflict, so the
    helper must return (original IntegrityError re-raised by the caller)
    and never even consult the deleted-holder probe.
    """
    db_mock: MagicMock = mocker.patch("superset.db")
    db_mock.session.query.return_value.filter.return_value.first.return_value = (
        MagicMock()  # a live dashboard row holds the slug
    )
    finder: MagicMock = mocker.patch(_FINDER)

    raise_for_soft_deleted_slug_collision("q1-report", _slug_error())

    finder.assert_not_called()


@pytest.mark.parametrize(
    "cause",
    [
        _mysql_error("uq_dashboards_uuid"),
        _mysql_error("idx_unique_slug", errno=1048),
        _pg_error("uq_dashboards_uuid"),
        _pg_error(None),
        _pg_error("idx_unique_slug", "23503"),
        Exception("no driver diagnostic"),
        IntegrityError(None, None, Exception("unidentifiable")),
        IntegrityError(None, None, Exception(1062)),
        IntegrityError(
            None, None, Exception(1062, "Duplicate entry 'x' for key idx_unique_slug")
        ),
        IntegrityError(
            None,
            None,
            SQLiteIntegrityError(
                "UNIQUE constraint failed: dashboards.slug, dashboards.uuid"
            ),
        ),
        IntegrityError(
            None,
            None,
            SQLiteIntegrityError("UNIQUE constraint failed: dashboards.uuid"),
        ),
        IntegrityError(
            None,
            None,
            Exception(1062, "Duplicate entry 'x' for key 'uq_dashboards_uuid'"),
        ),
        IntegrityError(
            None, None, Exception(1048, "Column 'idx_unique_slug' cannot be null")
        ),
        IntegrityError(
            None,
            None,
            Exception(
                1062, "Duplicate entry 'idx_unique_slug' for key 'uq_dashboards_uuid'"
            ),
        ),
        IntegrityError(
            "INSERT INTO dashboards (slug) VALUES ('idx_unique_slug')",
            None,
            SQLiteIntegrityError("UNIQUE constraint failed: dashboards.uuid"),
        ),
    ],
)
def test_unrelated_or_ambiguous_error_skips_archived_holder(
    mocker: MockerFixture, cause: Exception
) -> None:
    """Leave UUID and unidentified errors untouched despite an archived namesake."""
    holder: MagicMock = MagicMock()
    holder.uuid = "archived-holder"
    finder: MagicMock = mocker.patch(_FINDER, return_value=holder)
    raise_for_soft_deleted_slug_collision("q1-report", cause)
    finder.assert_not_called()


@pytest.mark.parametrize(
    "cause",
    [
        _mysql_error("idx_unique_slug"),
        _mysql_error("dashboards.idx_unique_slug"),
        _mysql_error("ix_dashboards_active_slug"),
        _pg_error("idx_unique_slug"),
        _pg_error("ix_dashboards_active_slug"),
        _pg_error("idx_unique_slug", psycopg3=True),
        _pg_error("ix_dashboards_active_slug", psycopg3=True),
        _slug_error(),
        IntegrityError(
            None,
            None,
            SQLiteIntegrityError("unique constraint failed: dashboards.slug"),
        ),
        IntegrityError(
            None, None, Exception(1062, "Duplicate entry 'x' for key 'idx_unique_slug'")
        ),
        IntegrityError(
            None,
            None,
            Exception(1062, "Duplicate entry 'x' for key 'ix_dashboards_active_slug'"),
        ),
        IntegrityError(
            None,
            None,
            Exception(1062, "Duplicate entry 'x' for key 'dashboards.idx_unique_slug'"),
        ),
    ],
)
def test_identified_slug_error_translates_to_guidance(
    mocker: MockerFixture, cause: Exception
) -> None:
    """Translate only a recognized slug uniqueness diagnostic across drivers."""
    holder: MagicMock = MagicMock()
    holder.uuid = "archived-holder"
    mocker.patch(_FINDER, return_value=holder)
    with pytest.raises(DashboardInvalidError) as excinfo:
        raise_for_soft_deleted_slug_collision("q1-report", cause)
    messages: str = str(excinfo.value.normalized_messages())
    assert "/api/v1/dashboard/archived-holder/restore" in messages
    assert excinfo.value.__cause__ is cause
