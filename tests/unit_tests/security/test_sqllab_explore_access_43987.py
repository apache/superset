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
"""Tests for SQL Lab query access in the Explore view.

Covers the case where a non-Admin holds schema_access or catalog_access on the
schema a SQL Lab query ran against but is not the query author and does not hold
database_access. Verifies that raise_for_access(), can_access_schema(), and
Query.schema_perm all correctly honour those grants.
"""

from __future__ import annotations

import pytest
from pytest_mock import MockerFixture

from superset.exceptions import SupersetSecurityException
from superset.extensions import appbuilder
from superset.security.manager import SupersetSecurityManager


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_query_mock(mocker: MockerFixture, *, catalog: str | None = None) -> object:
    """Return a MagicMock shaped like a SQL Lab Query object."""
    database = mocker.MagicMock()
    database.database_name = "analytics_db"
    database.get_default_catalog.return_value = catalog
    database.get_default_schema_for_query.return_value = "sales"

    query = mocker.MagicMock()
    query.database = database
    query.catalog = catalog
    query.schema = "sales"
    query.sql = "SELECT * FROM orders"
    query.executed_sql = None
    if catalog:
        query.schema_perm = f"[analytics_db].[{catalog}].[sales]"
    else:
        query.schema_perm = "[analytics_db].[sales]"
    query.perm = "[analytics_db].[repro tab](id:4)"
    return query


# ---------------------------------------------------------------------------
# Fix A — raise_for_access(datasource=query) no longer falls through
# ---------------------------------------------------------------------------


def test_raise_for_access_schema_access_non_author_passes(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    A non-author with schema_access on the queried schema must be allowed.
    This is the exact scenario from issue #43987.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=False)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "get_schema_perm", return_value="[analytics_db].[sales]")
    mocker.patch.object(sm, "get_catalog_perm", return_value=None)

    def _can_access(perm_name: str, view_name: str) -> bool:
        return perm_name == "schema_access" and view_name == "[analytics_db].[sales]"

    mocker.patch.object(sm, "can_access", side_effect=_can_access)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    query = _make_query_mock(mocker)

    # Must NOT raise — schema_access holder can open Explore
    result = sm.raise_for_access(  # type: ignore[call-arg]
        database=None,
        datasource=query,
        query=None,
        query_context=None,
        table=None,
    )
    assert result is None


def test_raise_for_access_schema_access_via_query_kwarg_passes(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """Passing Query as query= (explore/utils.py path) must also pass."""
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=False)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(sm, "get_schema_perm", return_value="[analytics_db].[sales]")
    mocker.patch.object(sm, "get_catalog_perm", return_value=None)

    def _can_access(perm_name: str, view_name: str) -> bool:
        return perm_name == "schema_access" and view_name == "[analytics_db].[sales]"

    mocker.patch.object(sm, "can_access", side_effect=_can_access)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    query = _make_query_mock(mocker)

    result = sm.raise_for_access(  # type: ignore[call-arg]
        database=None,
        datasource=None,
        query=query,
        query_context=None,
        table=None,
    )
    assert result is None


def test_raise_for_access_catalog_access_non_author_passes(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """catalog_access holders must also be permitted (same fall-through bug)."""
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=False)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)

    catalog_perm = "[analytics_db].[analytics]"
    mocker.patch.object(sm, "get_catalog_perm", return_value=catalog_perm)
    mocker.patch.object(
        sm, "get_schema_perm", return_value="[analytics_db].[analytics].[sales]"
    )

    def _can_access(perm_name: str, view_name: str) -> bool:
        return perm_name == "catalog_access" and view_name == catalog_perm

    mocker.patch.object(sm, "can_access", side_effect=_can_access)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    query = _make_query_mock(mocker, catalog="analytics")

    result = sm.raise_for_access(  # type: ignore[call-arg]
        database=None,
        datasource=query,
        query=None,
        query_context=None,
        table=None,
    )
    assert result is None


def test_raise_for_access_no_grant_is_denied(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """A user with no relevant grant must still receive a 403."""
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=False)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "get_catalog_perm", return_value=None)
    mocker.patch.object(sm, "get_schema_perm", return_value="[analytics_db].[sales]")
    mocker.patch.object(sm, "can_access", return_value=False)

    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    query = _make_query_mock(mocker)

    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(  # type: ignore[call-arg]
            database=None,
            datasource=query,
            query=None,
            query_context=None,
            table=None,
        )


# ---------------------------------------------------------------------------
# Fix C — can_access_schema() accepts Query objects
# ---------------------------------------------------------------------------


def test_can_access_schema_query_with_schema_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    can_access_schema() must return True for a SQL Lab Query when the user
    holds schema_access. Before Fix C the isinstance guard blocked this.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=False)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "can_access_catalog", return_value=False)

    query = _make_query_mock(mocker)  # schema_perm = "[analytics_db].[sales]"

    def _can_access(perm_name: str, view_name: str) -> bool:
        return perm_name == "schema_access" and view_name == "[analytics_db].[sales]"

    mocker.patch.object(sm, "can_access", side_effect=_can_access)

    assert sm.can_access_schema(query) is True  # type: ignore[arg-type]


def test_can_access_schema_query_no_grant(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """can_access_schema() must return False when the user holds no grant."""
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=False)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "can_access_catalog", return_value=False)
    mocker.patch.object(sm, "can_access", return_value=False)

    query = _make_query_mock(mocker)


    assert sm.can_access_schema(query) is False  # type: ignore[arg-type]


# Fix B — Query.schema_perm canonical format

def test_query_schema_perm_no_catalog(mocker: MockerFixture) -> None:
    """Query.schema_perm without catalog must produce [db].[schema]."""
    from superset.models.sql_lab import Query

    q = mocker.MagicMock(spec=Query)
    q.schema = "sales"
    q.catalog = None
    database = mocker.MagicMock()
    database.database_name = "analytics_db"
    q.database = database

    mock_sm = mocker.patch("superset.models.sql_lab.security_manager")
    mock_sm.get_schema_perm.return_value = "[analytics_db].[sales]"

    result = Query.schema_perm.fget(q)  # type: ignore[union-attr]

    mock_sm.get_schema_perm.assert_called_once_with("analytics_db", None, "sales")
    assert result == "[analytics_db].[sales]"
    assert result != "analytics_db.sales"  # must not be the old broken format


def test_query_schema_perm_with_catalog(mocker: MockerFixture) -> None:
    """Query.schema_perm with catalog must produce [db].[catalog].[schema]."""
    from superset.models.sql_lab import Query

    q = mocker.MagicMock(spec=Query)
    q.schema = "sales"
    q.catalog = "analytics"
    database = mocker.MagicMock()
    database.database_name = "analytics_db"
    q.database = database

    mock_sm = mocker.patch("superset.models.sql_lab.security_manager")
    mock_sm.get_schema_perm.return_value = "[analytics_db].[analytics].[sales]"

    result = Query.schema_perm.fget(q)  # type: ignore[union-attr]

    mock_sm.get_schema_perm.assert_called_once_with("analytics_db", "analytics", "sales")
    assert result == "[analytics_db].[analytics].[sales]"
