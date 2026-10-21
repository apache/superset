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
from typing import Any, Callable, Optional, TYPE_CHECKING, Union

from flask_appbuilder import Model
from sqlalchemy import and_, exists, false, or_, select, true
from sqlalchemy.sql.elements import BooleanClauseList, ColumnElement

if TYPE_CHECKING:
    from sqlalchemy.orm.query import Query
    from sqlalchemy.orm.util import AliasedClass

    from superset.connectors.sqla.models import SqlaTable


def get_dataset_access_filters(
    base_model: type[Model],
    *extra_access_clauses: "ColumnElement[bool]",
    include_all: bool = False,
) -> "ColumnElement[bool]":
    """OR-clause matching rows the user's data grants cover.

    ``extra_access_clauses`` are additional grant clauses OR-ed into the
    filter (e.g. the semantic-layer grant clause the dashboard and chart
    list filters splice in). ``include_all`` yields an explicit always-true
    clause — and skips the grant lookups — for callers that have already
    established the user holds ``all_datasource_access``.
    """
    if include_all:
        return true()

    # pylint: disable=import-outside-toplevel
    from superset import security_manager
    from superset.connectors.sqla.models import Database

    database_ids = security_manager.get_accessible_databases()
    perms = security_manager.user_view_menu_names("datasource_access")
    schema_perms = security_manager.user_view_menu_names("schema_access")
    catalog_perms = security_manager.user_view_menu_names("catalog_access")

    clauses: list["ColumnElement[bool]"] = [
        Database.id.in_(database_ids),
        base_model.perm.in_(perms),
        base_model.catalog_perm.in_(catalog_perms),
        base_model.schema_perm.in_(schema_perms),
        *extra_access_clauses,
    ]
    return or_(*clauses)


def table_backed_slice_join(
    table_entity: Union[type["SqlaTable"], "AliasedClass"],
) -> BooleanClauseList:
    """ON-clause joining ``Slice`` to a table datasource, guarded by type.

    ``table_entity`` is ``SqlaTable`` or an ``aliased()`` of it. This is the
    single authoritative definition of the type constraint shared by the
    dashboard and chart list filters: a bare id join can bind a chart on
    another datasource type (e.g. a semantic view) to an unrelated table
    sharing its numeric id — the id-collision class behind SC-111233 and
    SC-119500 — so the join must always be qualified by ``datasource_type``.
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.slice import Slice
    from superset.utils.core import DatasourceType

    return and_(
        Slice.datasource_id == table_entity.id,
        Slice.datasource_type == DatasourceType.TABLE,
    )


def semantic_view_slice_join() -> BooleanClauseList:
    """ON-clause joining ``Slice`` to a semantic-view datasource, guarded by type.

    The sibling of ``table_backed_slice_join`` for the other joinable
    datasource type, sharing its rationale: without the ``datasource_type``
    qualifier a bare id join could bind a chart to a same-numbered row of
    the wrong type.
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.slice import Slice
    from superset.semantic_layers.models import SemanticView
    from superset.utils.core import DatasourceType

    return and_(
        Slice.datasource_id == SemanticView.id,
        Slice.datasource_type == DatasourceType.SEMANTIC_VIEW,
    )


def semantic_view_layer_join() -> "ColumnElement[bool]":
    """ON-clause joining ``SemanticView`` to its parent ``SemanticLayer``."""
    # pylint: disable=import-outside-toplevel
    from superset.semantic_layers.models import SemanticLayer, SemanticView

    return SemanticView.semantic_layer_uuid == SemanticLayer.uuid


def semantic_layer_grant_clause() -> "ColumnElement[bool]":
    """Grant clause admitting rows covered by a semantic-LAYER-level grant.

    A ``datasource_access`` grant on a semantic layer covers its views, as
    ``SemanticView.raise_for_access`` enforces on the data path (sc-119501);
    the list filters splice this clause into ``get_dataset_access_filters``.
    The datasource_access perms are fetched here and again inside that
    helper — an accepted cost: deduping would need the helper to accept
    prefetched perm sets.
    """
    # pylint: disable=import-outside-toplevel
    from superset import security_manager
    from superset.semantic_layers.models import SemanticLayer

    return SemanticLayer.perm.in_(
        security_manager.user_view_menu_names("datasource_access")
    )


def guest_embedded_dashboard_filter() -> Optional[ColumnElement[bool]]:
    """SQLAlchemy condition scoping charts to the dashboards embedded via the
    current guest token, or None when the user is not an embedded guest.

    For an embedded guest the result is never None: a token with no dashboard
    resources returns a deny-all clause so the chart filter fails closed instead
    of falling back to the ordinary role-based access path.

    Mirrors how DashboardAccessFilter scopes dashboards.
    """
    # pylint: disable=import-outside-toplevel
    from superset import is_feature_enabled, security_manager
    from superset.models.dashboard import Dashboard, is_uuid
    from superset.models.embedded_dashboard import EmbeddedDashboard
    from superset.security.guest_token import GuestTokenResourceType

    if not is_feature_enabled("EMBEDDED_SUPERSET"):
        return None
    guest = security_manager.get_current_guest_user_if_guest()
    if guest is None:
        return None
    # The user is an embedded guest from here: scope to the token's dashboards
    # and never widen back to role-based access. No dashboards means deny all.
    ids: list[Any] = [
        r["id"]
        for r in guest.resources
        if r["type"] == GuestTokenResourceType.DASHBOARD.value
    ]
    if not ids:
        return false()
    # TODO (embedded): only use the uuid filter once uuids are rolled out
    # A guest token may mix uuid and int dashboard ids during the uuid rollout.
    # Route each id kind to its own column and OR them — a plain int sent to the
    # uuid-typed column would raise a bind/type error. Match only the id kinds
    # has_guest_access authorizes (uuid, decimal id); a slug is fail-closed on
    # the data path, so matching it here would be moot.
    uuid_ids = [id_ for id_ in ids if is_uuid(id_)]
    int_ids = [id_ for id_ in ids if not is_uuid(id_) and str(id_).isdigit()]
    conditions: list[Any] = []
    if uuid_ids:
        conditions.append(Dashboard.embedded.any(EmbeddedDashboard.uuid.in_(uuid_ids)))
    if int_ids:
        # Int ids must resolve to an embedded dashboard too (mirrors the uuid
        # branch and has_guest_access); a guest is only ever scoped to embedded
        # dashboards, never a plain internal id.
        conditions.append(and_(Dashboard.id.in_(int_ids), Dashboard.embedded.any()))
    return or_(*conditions) if conditions else false()


def apply_extra_access_exclusions(
    query: "Query",
    asset_kind: str,
    id_column: "ColumnElement[Any]",
) -> "Query":
    """Withhold the asset IDs an ``EXTRA_ACCESS_QUERY_EXCLUSIONS`` hook names.

    ``EXTRA_ACCESS_QUERY_FILTERS`` can only widen a result set -- its conditions
    are OR'd with the role paths -- so a deployment with its own notion of a
    withheld asset cannot express that through it. This is the matching AND NOT.

    Returns ``query`` unchanged when no hook is configured or there is no
    authenticated user, so the default build is unaffected.
    """

    clause = extra_access_exclusion_clause(asset_kind, id_column)
    return query if clause is None else query.filter(clause)


def extra_access_exclusion_clause(
    asset_kind: str,
    id_column: "ColumnElement[Any]",
) -> Optional["ColumnElement[bool]"]:
    """The ``NOT EXISTS`` clause for an exclusion hook, or None when inactive.

    Deliberately ``NOT EXISTS`` rather than ``NOT IN``: a hook subquery that
    yields a single NULL id makes ``NOT IN`` evaluate to NULL for every row,
    which would silently empty the entire list -- for admins too. ``NOT EXISTS``
    simply does not match a NULL, so a malformed hook withholds nothing instead
    of everything.
    """
    hook = _extra_access_exclusion_hook(asset_kind)
    if not hook:
        return None

    from superset.utils.core import get_user_id

    # ``None`` for an anonymous request, and the hook is still consulted: a
    # deployment serving published dashboards through the Public role has
    # anonymous callers, and skipping a *withholding* rule for them would
    # reveal rather than hide. A rule about who may see what has to answer for
    # the principal who is nobody.
    return ~exists().where(_exclusion_id_column(hook(get_user_id())) == id_column)


def _extra_access_exclusion_hook(
    asset_kind: str,
) -> Optional[Callable[[Optional[int]], Any]]:
    """The configured exclusion callable for this kind, or None.

    Returns None for an embedded guest, so exclusions never apply to one. A
    guest token already scopes its holder to the dashboards it names and fails
    closed; withholding on top of that would make an embedded dashboard depend
    on deployment state the token knows nothing about. ``ChartFilter`` and
    ``DashboardAccessFilter`` return before reaching an exclusion for the same
    reason -- the check lives here as well so a caller resolving a single id,
    which has no such branch ahead of it, cannot miss it.
    """
    from flask import current_app

    from superset import security_manager

    if security_manager.is_guest_user():
        return None

    exclusions = current_app.config.get("EXTRA_ACCESS_QUERY_EXCLUSIONS") or {}
    return exclusions.get(asset_kind)


def _exclusion_id_column(excluded: Any) -> "ColumnElement[Any]":
    """The single id column of whatever shape a hook returned.

    A hook may return an ORM ``Query``, a Core ``select()`` or an explicit
    ``.subquery()`` -- all three are natural things to write, and the sibling
    ``EXTRA_ACCESS_QUERY_FILTERS`` hooks are handed straight to ``.in_()``,
    which accepts any of them. ``Query`` and ``Select`` both offer
    ``.subquery()`` while a ``Subquery`` does not, so that is what we key on.
    Reaching for ``.c`` on a ``Select`` would work but is deprecated, and on a
    ``Query`` it does not exist at all.
    """
    if hasattr(excluded, "subquery"):
        excluded = excluded.subquery()
    return list(excluded.c)[0]


def is_excluded_by_extra_access(asset_kind: str, id_value: int) -> bool:
    """Whether a single asset id is withheld by an exclusion hook.

    List filters are not an authorisation boundary -- a command that resolves an
    id directly has to ask the same question, or the asset is merely hidden from
    the picker rather than withheld.
    """
    from superset import db
    from superset.utils.core import get_user_id

    hook = _extra_access_exclusion_hook(asset_kind)
    if not hook:
        return False

    # Anonymous callers are asked about too; see extra_access_exclusion_clause.
    excluded_id = _exclusion_id_column(hook(get_user_id()))
    return bool(
        db.session.execute(select(exists().where(excluded_id == id_value))).scalar()
    )
