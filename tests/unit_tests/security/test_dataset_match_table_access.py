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

"""Table and datasource access derive from grants, not dataset editorship.

Access comes from a ``datasource_access`` (or catalog/schema/database) grant;
editorship governs a dataset's definition only.

Each test fixes the permission state (no grant anywhere) and varies whether the
caller edits the matching dataset.
"""

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import SupersetSecurityException
from superset.extensions import appbuilder
from superset.security.manager import SupersetSecurityManager

TABLE = "secret"
SCHEMA = "closed"
DATABASE = "analytics"


def _locked_out_manager(
    mocker: MockerFixture, *, is_editor: bool
) -> SupersetSecurityManager:
    """A real manager whose grant lookups answer for a locked-out caller.

    The caller holds no catalog, schema or datasource grant and no
    database-level access, so the table loop / datasource branch is reached and
    runs for real; only the permission store is stubbed.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch.object(sm, "can_access_schema", return_value=False)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=False)
    mocker.patch.object(sm, "can_access_all_databases", return_value=False)
    mocker.patch.object(sm, "get_catalog_perm", return_value=None)
    mocker.patch.object(sm, "get_schema_perm", return_value=None)
    mocker.patch.object(sm, "_semantic_layer_grant_allows", return_value=False)
    mocker.patch.object(sm, "raise_for_unsupported_guest_rls", return_value=None)
    mocker.patch.object(sm, "is_admin", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=is_editor)
    return sm


def _database() -> MagicMock:
    database = MagicMock()
    database.database_name = DATABASE
    database.perm = f"[{DATABASE}].(id:1)"
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = None
    database.db_engine_spec.engine = "postgresql"
    return database


def _physical_dataset() -> MagicMock:
    dataset = MagicMock()
    dataset.perm = f"[{SCHEMA}].[{TABLE}](id:2)"
    dataset.sql = None
    return dataset


@pytest.mark.parametrize("is_editor", [False, True])
def test_table_branch_refuses_without_grant(
    app_context: None, mocker: MockerFixture, is_editor: bool
) -> None:
    """SQL referencing a table claimed by a dataset is refused without a grant,
    whether or not the caller edits that dataset (SQL Lab path)."""
    mocker.patch.object(
        SqlaTable, "query_datasources_by_name", return_value=[_physical_dataset()]
    )
    with pytest.raises(SupersetSecurityException):
        _locked_out_manager(mocker, is_editor=is_editor).raise_for_access(
            database=_database(),
            sql=f"SELECT * FROM {SCHEMA}.{TABLE}",  # noqa: S608
        )


def test_table_branch_refuses_when_no_dataset_claims_the_table(
    app_context: None, mocker: MockerFixture
) -> None:
    """Control: nothing claims the natural key, so the check refuses."""
    mocker.patch.object(SqlaTable, "query_datasources_by_name", return_value=[])
    with pytest.raises(SupersetSecurityException):
        _locked_out_manager(mocker, is_editor=False).raise_for_access(
            database=_database(),
            sql=f"SELECT * FROM {SCHEMA}.{TABLE}",  # noqa: S608
        )


@pytest.mark.parametrize("is_editor", [False, True])
def test_datasource_branch_refuses_without_grant(
    app_context: None, mocker: MockerFixture, is_editor: bool
) -> None:
    """Chart-data against a physical dataset is refused without a grant,
    whether or not the caller edits that dataset."""
    with pytest.raises(SupersetSecurityException):
        _locked_out_manager(mocker, is_editor=is_editor).raise_for_access(
            datasource=_physical_dataset()
        )
