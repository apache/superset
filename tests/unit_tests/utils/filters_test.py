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

from types import SimpleNamespace

from pytest_mock import MockerFixture
from sqlalchemy import create_engine

from superset.extensions import security_manager
from superset.utils.filters import (
    get_dataset_access_filters,
    guest_embedded_dashboard_filter,
)


def test_get_dataset_access_filters(mocker: MockerFixture) -> None:
    """
    Test the `get_dataset_access_filters` function.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.extensions import security_manager

    mocker.patch.object(
        security_manager,
        "get_accessible_databases",
        return_value=[1, 3],
    )
    mocker.patch.object(
        security_manager,
        "user_view_menu_names",
        side_effect=[
            {"[db].[catalog1].[schema1].[table1](id:1)"},
            {"[db].[catalog1].[schema2]"},
            {"[db].[catalog2]"},
        ],
    )

    clause = get_dataset_access_filters(SqlaTable)
    engine = create_engine("sqlite://")
    compiled_query = clause.compile(engine, compile_kwargs={"literal_binds": True})
    assert str(compiled_query) == (
        "dbs.id IN (1, 3) "
        "OR tables.perm IN ('[db].[catalog1].[schema1].[table1](id:1)') "
        "OR tables.catalog_perm IN ('[db].[catalog2]') OR "
        "tables.schema_perm IN ('[db].[catalog1].[schema2]')"
    )


def _guest_with_dashboards(*ids: object) -> SimpleNamespace:
    """A guest user whose token grants the given dashboard resources."""
    return SimpleNamespace(resources=[{"type": "dashboard", "id": i} for i in ids])


def test_guest_embedded_dashboard_filter_disabled_returns_none(
    mocker: MockerFixture,
) -> None:
    """No filter when the EMBEDDED_SUPERSET feature flag is off."""
    mocker.patch("superset.is_feature_enabled", return_value=False)
    assert guest_embedded_dashboard_filter() is None


def test_guest_embedded_dashboard_filter_non_guest_returns_none(
    mocker: MockerFixture,
) -> None:
    """No filter when the current user is not an embedded guest."""
    mocker.patch("superset.is_feature_enabled", return_value=True)
    mocker.patch.object(
        security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    assert guest_embedded_dashboard_filter() is None


def test_guest_embedded_dashboard_filter_no_dashboard_resources(
    mocker: MockerFixture,
) -> None:
    """A guest with no dashboard resources is denied all charts (fail closed),
    not left to fall back to the role-based access path (which None would do)."""
    from sqlalchemy.sql.elements import False_

    mocker.patch("superset.is_feature_enabled", return_value=True)
    guest = SimpleNamespace(resources=[{"type": "dataset", "id": 1}])
    mocker.patch.object(
        security_manager, "get_current_guest_user_if_guest", return_value=guest
    )
    clause = guest_embedded_dashboard_filter()
    assert clause is not None
    assert isinstance(clause, False_)


def test_guest_embedded_dashboard_filter_uuid_resources(
    mocker: MockerFixture,
) -> None:
    """UUID resources scope via the embedded-dashboard relationship."""
    mocker.patch("superset.is_feature_enabled", return_value=True)
    uuid = "51e44e1c-ffd1-425d-8993-919177955270"
    mocker.patch.object(
        security_manager,
        "get_current_guest_user_if_guest",
        return_value=_guest_with_dashboards(uuid),
    )

    # Compiled without literal_binds: the uuid column is BINARY(16), so assert on
    # structure (an EXISTS against embedded_dashboards.uuid) rather than the value.
    clause = guest_embedded_dashboard_filter()
    assert clause is not None
    compiled = str(clause.compile(create_engine("sqlite://")))
    assert "EXISTS" in compiled
    assert "embedded_dashboards" in compiled
    assert "uuid" in compiled


def test_guest_embedded_dashboard_filter_int_resources(
    mocker: MockerFixture,
) -> None:
    """Integer resources scope by dashboard id AND require the dashboard to be
    embedded (a guest is never scoped to a plain non-embedded internal id)."""
    mocker.patch("superset.is_feature_enabled", return_value=True)
    mocker.patch.object(
        security_manager,
        "get_current_guest_user_if_guest",
        return_value=_guest_with_dashboards(5, 7),
    )

    clause = guest_embedded_dashboard_filter()
    assert clause is not None
    compiled = str(
        clause.compile(
            create_engine("sqlite://"), compile_kwargs={"literal_binds": True}
        )
    )
    assert "dashboards.id IN (5, 7)" in compiled
    # The int-id branch also requires an embedded config (mirrors the uuid branch
    # and has_guest_access), so a non-embedded dashboard id cannot match.
    assert "embedded_dashboards" in compiled


def test_guest_embedded_dashboard_filter_mixed_uuid_and_int_ids(
    mocker: MockerFixture,
) -> None:
    """A token mixing uuid and int ids ORs a uuid-column and an id-column filter
    (routing a plain int through the uuid-typed column would raise a bind error)."""
    mocker.patch("superset.is_feature_enabled", return_value=True)
    uuid = "51e44e1c-ffd1-425d-8993-919177955270"
    mocker.patch.object(
        security_manager,
        "get_current_guest_user_if_guest",
        return_value=_guest_with_dashboards(uuid, 7),
    )

    clause = guest_embedded_dashboard_filter()
    assert clause is not None
    # uuid column is BINARY(16), so compile without literal_binds and assert
    # structure: an EXISTS on embedded_dashboards OR a dashboards.id filter.
    compiled = str(clause.compile(create_engine("sqlite://")))
    assert "embedded_dashboards" in compiled
    assert "dashboards.id IN" in compiled
    assert " OR " in compiled
