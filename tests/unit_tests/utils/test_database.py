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
"""Tests for superset.utils.database module."""

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import Sequence
from sqlalchemy.dialects import mysql, postgresql
from sqlalchemy.exc import PendingRollbackError
from sqlalchemy.schema import CreateSequence
from sqlalchemy.sql.compiler import DDLCompiler

from superset.exceptions import SupersetErrorException
from superset.utils.database import apply_mariadb_ddl_fix, find_user_for_impersonation


@pytest.fixture(scope="module", autouse=True)
def setup_mariadb_ddl_fix():
    """Apply MariaDB DDL fix once per module before tests run."""
    apply_mariadb_ddl_fix()


def test_mariadb_nocycle_fix_applied():
    """Test that 'NO CYCLE' is replaced with 'NOCYCLE' for MariaDB dialect."""
    dialect = mysql.dialect()
    dialect.name = "mariadb"
    ddl_compiler = DDLCompiler(dialect, None)
    seq = Sequence("test_seq", cycle=False)

    result = ddl_compiler.visit_create_sequence(CreateSequence(seq))
    assert "NOCYCLE" in result
    assert "NO CYCLE" not in result


def test_nocycle_fix_not_applied_for_postgresql():
    """Test that 'NO CYCLE' is NOT replaced for PostgreSQL dialect."""
    dialect = postgresql.dialect()
    compiler = DDLCompiler(dialect, None)
    seq = Sequence("test_seq", cycle=False)

    result = compiler.visit_create_sequence(CreateSequence(seq))
    assert "NO CYCLE" in result


def test_find_user_for_impersonation(mocker: MockerFixture) -> None:
    """Test that a healthy session resolves the user without rolling back."""
    user = mocker.MagicMock()
    find_user = mocker.patch(
        "superset.extensions.security_manager.find_user",
        return_value=user,
    )
    session = mocker.patch("superset.db.session")

    assert find_user_for_impersonation("alice") is user
    find_user.assert_called_once_with(username="alice")
    session.rollback.assert_not_called()


def test_find_user_for_impersonation_retries_after_rollback(
    mocker: MockerFixture,
) -> None:
    """
    Test that a poisoned session is rolled back and the lookup retried.

    An earlier failure in the same request leaves ``db.session`` in a failed
    transaction, so this lookup reports ``PendingRollbackError`` for a fault
    that has nothing to do with it. Rolling back makes the session usable
    again, and the retry returns the user the caller asked for.
    """
    user = mocker.MagicMock()
    find_user = mocker.patch(
        "superset.extensions.security_manager.find_user",
        side_effect=[PendingRollbackError("poisoned"), user],
    )
    session = mocker.patch("superset.db.session")

    assert find_user_for_impersonation("alice") is user
    session.rollback.assert_called_once()
    assert find_user.call_count == 2


def test_find_user_for_impersonation_raises_when_retry_fails(
    mocker: MockerFixture,
) -> None:
    """
    Test that a lookup failing past the retry raises rather than falling back.

    The resolved name becomes the identity the analytic database connects as,
    so degrading to the un-resolved login would silently run the query as a
    different principal. Failing loudly is the safe outcome.
    """
    mocker.patch(
        "superset.extensions.security_manager.find_user",
        side_effect=PendingRollbackError("still poisoned"),
    )
    session = mocker.patch("superset.db.session")

    with pytest.raises(SupersetErrorException):
        find_user_for_impersonation("alice")

    session.rollback.assert_called_once()


def test_find_user_for_impersonation_unknown_login(mocker: MockerFixture) -> None:
    """Test that an unknown login is reported as absent, not as a failure."""
    find_user = mocker.patch(
        "superset.extensions.security_manager.find_user",
        return_value=None,
    )
    mocker.patch("superset.db.session")

    assert find_user_for_impersonation("nobody") is None
    find_user.assert_called_once_with(username="nobody")
