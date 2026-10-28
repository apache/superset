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
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, null as sa_null
from sqlalchemy.sql.elements import ColumnElement, False_

from superset.extensions import security_manager
from superset.utils.filters import (
    apply_extra_access_exclusions,
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


def test_get_dataset_access_filters_extra_clauses(mocker: MockerFixture) -> None:
    """Named ``extra_access_clauses`` are OR-ed into the filter (the seam the
    dashboard and chart list filters use for the semantic-layer grant
    clause, SC-119500)."""
    # pylint: disable=import-outside-toplevel
    from sqlalchemy import column

    from superset.connectors.sqla.models import SqlaTable
    from superset.extensions import security_manager

    mocker.patch.object(security_manager, "get_accessible_databases", return_value=[1])
    mocker.patch.object(
        security_manager,
        "user_view_menu_names",
        side_effect=[{"[db].[t](id:1)"}, set(), set()],
    )

    clause: "ColumnElement[bool]" = get_dataset_access_filters(
        SqlaTable, column("x") == 1
    )
    assert " OR x = :x_1" in str(clause)


def test_get_dataset_access_filters_include_all(mocker: MockerFixture) -> None:
    """``include_all`` yields an explicit always-true clause (and skips the
    grant lookups) for callers that already established
    ``all_datasource_access``."""
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable
    from superset.extensions import security_manager

    mocker.patch.object(security_manager, "get_accessible_databases", return_value=[1])
    mocker.patch.object(
        security_manager,
        "user_view_menu_names",
        side_effect=[{"[db].[t](id:1)"}, set(), set()],
    )

    assert str(get_dataset_access_filters(SqlaTable, include_all=True)) == "true"


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
            create_engine("sqlite://"),
            compile_kwargs={"literal_binds": True},
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


def test_guest_embedded_dashboard_filter_slug_only_denies(
    mocker: MockerFixture,
) -> None:
    """A slug-only token yields deny-all: has_guest_access authorizes the data
    path only by dashboard id/uuid, never slug, so the list filter must not widen
    past it (else a slug dashboard would list but its data would be denied)."""
    mocker.patch("superset.is_feature_enabled", return_value=True)
    mocker.patch.object(
        security_manager,
        "get_current_guest_user_if_guest",
        return_value=_guest_with_dashboards("sales-overview"),
    )

    clause = guest_embedded_dashboard_filter()
    assert isinstance(clause, False_)


def test_guest_embedded_dashboard_filter_ignores_slug_in_mixed_token(
    mocker: MockerFixture,
) -> None:
    """A token mixing uuid, int, and slug ids matches only the uuid and int ids;
    the slug is dropped (fail-closed on the data path, so never surfaced)."""
    mocker.patch("superset.is_feature_enabled", return_value=True)
    uuid = "51e44e1c-ffd1-425d-8993-919177955270"
    mocker.patch.object(
        security_manager,
        "get_current_guest_user_if_guest",
        return_value=_guest_with_dashboards(uuid, 7, "sales-overview"),
    )

    clause = guest_embedded_dashboard_filter()
    assert clause is not None
    compiled = str(clause.compile(create_engine("sqlite://")))
    assert "embedded_dashboards" in compiled
    assert "dashboards.id IN" in compiled
    assert "dashboards.slug" not in compiled


def test_apply_extra_access_exclusions_noop_without_hook(app_context: None) -> None:
    """The default build configures no hook, so the query is untouched."""
    from superset import db
    from superset.models.slice import Slice

    query = db.session.query(Slice)
    assert apply_extra_access_exclusions(query, "charts", Slice.id) is query


def test_apply_extra_access_exclusions_consults_the_hook_anonymously(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """An anonymous caller is asked about too, not waved through.

    A deployment serving published dashboards through the Public role has
    anonymous callers. Skipping a withholding rule for them would reveal rather
    than hide, so the hook is consulted with ``None``.
    """
    from flask import current_app

    from superset import db
    from superset.models.slice import Slice

    withheld = Slice(
        slice_name="hidden from anon", datasource_id=1, datasource_type="table"
    )
    kept = Slice(slice_name="public chart", datasource_id=1, datasource_type="table")
    db.session.add_all([withheld, kept])
    db.session.flush()

    seen: list[Any] = []

    def hook(user_id: Any) -> Any:
        seen.append(user_id)
        return db.session.query(Slice.id).filter(Slice.id == withheld.id)

    mocker.patch("superset.utils.core.get_user_id", return_value=None)
    mocker.patch.dict(
        current_app.config,
        {"EXTRA_ACCESS_QUERY_EXCLUSIONS": {"charts": hook}},
    )

    query = apply_extra_access_exclusions(db.session.query(Slice), "charts", Slice.id)
    returned = {slc.id for slc in query.all()}

    assert seen == [None], "the hook must be told there is no user, not skipped"
    assert withheld.id not in returned
    assert kept.id in returned


def test_apply_extra_access_exclusions_withholds_ids(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A configured hook withholds the IDs it names.

    Executed rather than string-matched: the point is that a hook returning a
    ``.subquery()`` -- the shape ``EXTRA_ACCESS_QUERY_FILTERS`` already
    requires -- composes into ``NOT IN`` and produces valid SQL.
    """
    from flask import current_app

    from superset import db
    from superset.models.slice import Slice

    excluded = Slice(slice_name="excluded", datasource_id=1, datasource_type="table")
    kept = Slice(slice_name="kept", datasource_id=1, datasource_type="table")
    db.session.add_all([excluded, kept])
    db.session.flush()

    def hook(_user_id: int) -> Any:
        return db.session.query(Slice.id).filter(Slice.id == excluded.id).subquery()

    mocker.patch("superset.utils.core.get_user_id", return_value=1)
    mocker.patch.dict(
        current_app.config,
        {"EXTRA_ACCESS_QUERY_EXCLUSIONS": {"charts": hook}},
    )

    query = apply_extra_access_exclusions(db.session.query(Slice), "charts", Slice.id)
    returned = {slc.id for slc in query.all()}

    assert excluded.id not in returned
    assert kept.id in returned


def test_exclusions_tolerate_a_null_id(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A NULL in the hook's subquery must withhold nothing, not everything.

    ``NOT IN (..., NULL)`` is NULL for every row, which would empty the whole
    list -- for admins too. ``NOT EXISTS`` simply does not match it.
    """
    from flask import current_app

    from superset import db
    from superset.models.slice import Slice

    kept = Slice(slice_name="kept past null", datasource_id=1, datasource_type="table")
    db.session.add(kept)
    db.session.flush()

    def hook(_user_id: int) -> Any:
        return db.session.query(sa_null().label("id")).subquery()

    mocker.patch("superset.utils.core.get_user_id", return_value=1)
    mocker.patch.dict(
        current_app.config,
        {"EXTRA_ACCESS_QUERY_EXCLUSIONS": {"charts": hook}},
    )

    query = apply_extra_access_exclusions(db.session.query(Slice), "charts", Slice.id)
    assert kept.id in {slc.id for slc in query.all()}


def test_is_excluded_by_extra_access_matches_the_filter(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """The single-id check is what a command uses as its boundary.

    A list filter is not an authorisation boundary: a command resolving an id
    directly has to ask the same question, or the asset is only hidden from a
    picker rather than withheld.
    """
    from flask import current_app

    from superset import db
    from superset.models.slice import Slice
    from superset.utils.filters import is_excluded_by_extra_access

    excluded = Slice(slice_name="withheld", datasource_id=1, datasource_type="table")
    allowed = Slice(slice_name="fine", datasource_id=1, datasource_type="table")
    db.session.add_all([excluded, allowed])
    db.session.flush()

    mocker.patch("superset.utils.core.get_user_id", return_value=1)
    mocker.patch.dict(
        current_app.config,
        {
            "EXTRA_ACCESS_QUERY_EXCLUSIONS": {
                "charts": lambda _uid: db.session.query(Slice.id)
                .filter(Slice.id == excluded.id)
                .subquery()
            }
        },
    )

    assert is_excluded_by_extra_access("charts", excluded.id) is True
    assert is_excluded_by_extra_access("charts", allowed.id) is False
    # No hook for this kind: nothing is withheld.
    assert is_excluded_by_extra_access("dashboards", excluded.id) is False


@pytest.mark.parametrize("shape", ["query", "select", "subquery"])
def test_exclusions_accept_every_natural_return_shape(
    shape: str,
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A hook may return a Query, a select() or an explicit .subquery().

    All three are natural to write, and the sibling
    ``EXTRA_ACCESS_QUERY_FILTERS`` hooks are handed straight to ``.in_()``,
    which accepts any of them. Reading ``.c`` without normalising raised
    ``AttributeError`` on a ``Query`` -- breaking every chart and dashboard
    list, for every user.
    """
    from flask import current_app
    from sqlalchemy import select as sa_select

    from superset import db
    from superset.models.slice import Slice

    withheld = Slice(
        slice_name=f"shape {shape}", datasource_id=1, datasource_type="table"
    )
    kept = Slice(slice_name=f"kept {shape}", datasource_id=1, datasource_type="table")
    db.session.add_all([withheld, kept])
    db.session.flush()

    def hook(_user_id: int) -> Any:
        if shape == "query":
            return db.session.query(Slice.id).filter(Slice.id == withheld.id)
        if shape == "select":
            return sa_select(Slice.id).where(Slice.id == withheld.id)
        return sa_select(Slice.id).where(Slice.id == withheld.id).subquery()

    mocker.patch("superset.utils.core.get_user_id", return_value=1)
    mocker.patch.dict(
        current_app.config,
        {"EXTRA_ACCESS_QUERY_EXCLUSIONS": {"charts": hook}},
    )

    query = apply_extra_access_exclusions(db.session.query(Slice), "charts", Slice.id)
    returned = {slc.id for slc in query.all()}
    assert withheld.id not in returned
    assert kept.id in returned


def test_exclusions_never_apply_to_an_embedded_guest(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    """A guest token scopes its holder; exclusions must not narrow it further.

    The list filters return before reaching an exclusion, but a caller
    resolving a single id has no such branch ahead of it -- an embedded
    dashboard is fetched by uuid, so missing this 404s every embed.
    """
    from flask import current_app

    from superset import db, security_manager
    from superset.models.slice import Slice
    from superset.utils.filters import is_excluded_by_extra_access

    withheld = Slice(
        slice_name="withheld from users", datasource_id=1, datasource_type="table"
    )
    db.session.add(withheld)
    db.session.flush()

    def hook(_user_id: Any) -> Any:
        return db.session.query(Slice.id).filter(Slice.id == withheld.id).subquery()

    mocker.patch("superset.utils.core.get_user_id", return_value=1)
    mocker.patch.dict(
        current_app.config,
        {"EXTRA_ACCESS_QUERY_EXCLUSIONS": {"charts": hook}},
    )

    # An ordinary caller: withheld.
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    assert is_excluded_by_extra_access("charts", withheld.id) is True
    assert (
        apply_extra_access_exclusions(
            db.session.query(Slice), "charts", Slice.id
        ).count()
        == 0
    )

    # A guest: exempt on both paths.
    mocker.patch.object(security_manager, "is_guest_user", return_value=True)
    assert is_excluded_by_extra_access("charts", withheld.id) is False
    assert (
        apply_extra_access_exclusions(
            db.session.query(Slice), "charts", Slice.id
        ).count()
        >= 1
    )
