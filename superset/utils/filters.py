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
from typing import Any, Optional

from flask_appbuilder import Model
from sqlalchemy import and_, false, or_
from sqlalchemy.sql.elements import BooleanClauseList, ColumnElement


def get_dataset_access_filters(
    base_model: type[Model],
    *args: Any,
) -> BooleanClauseList:
    # pylint: disable=import-outside-toplevel
    from superset import security_manager
    from superset.connectors.sqla.models import Database

    database_ids = security_manager.get_accessible_databases()
    perms = security_manager.user_view_menu_names("datasource_access")
    schema_perms = security_manager.user_view_menu_names("schema_access")
    catalog_perms = security_manager.user_view_menu_names("catalog_access")

    return or_(
        Database.id.in_(database_ids),
        base_model.perm.in_(perms),
        base_model.catalog_perm.in_(catalog_perms),
        base_model.schema_perm.in_(schema_perms),
        *args,
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
    # uuid-typed column would raise a bind/type error.
    uuid_ids = [id_ for id_ in ids if is_uuid(id_)]
    int_ids = [id_ for id_ in ids if not is_uuid(id_)]
    conditions: list[Any] = []
    if uuid_ids:
        conditions.append(Dashboard.embedded.any(EmbeddedDashboard.uuid.in_(uuid_ids)))
    if int_ids:
        # Int ids must resolve to an embedded dashboard too (mirrors the uuid
        # branch and has_guest_access); a guest is only ever scoped to embedded
        # dashboards, never a plain internal id.
        conditions.append(and_(Dashboard.id.in_(int_ids), Dashboard.embedded.any()))
    return or_(*conditions) if conditions else false()
