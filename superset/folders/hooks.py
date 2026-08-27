"""Extension hook implementations for folder-based access control."""

from __future__ import annotations

from typing import Any

from superset import db
from superset.utils.core import get_user_id


def _user_folder_ids(user_id: int) -> Any:
    """Subquery of folder IDs the user has access to."""
    from superset.folders.utils import user_accessible_folder_ids

    return user_accessible_folder_ids(user_id)


def folder_access_charts(user_id: int) -> Any:
    """Return subquery of chart IDs accessible via folder membership."""
    from superset.folders.models import FolderObject

    return (
        db.session.query(FolderObject.chart_id)
        .filter(
            FolderObject.chart_id.isnot(None),
            FolderObject.folder_id.in_(_user_folder_ids(user_id)),
        )
        .subquery()
    )


def folder_access_dashboards(user_id: int) -> Any:
    """Return subquery of dashboard IDs accessible via folder membership."""
    from superset.folders.models import FolderObject

    return (
        db.session.query(FolderObject.dashboard_id)
        .filter(
            FolderObject.dashboard_id.isnot(None),
            FolderObject.folder_id.in_(_user_folder_ids(user_id)),
        )
        .subquery()
    )


def _safe_int(value: Any) -> int | None:
    """Cast to int, returning None on failure."""
    try:
        return int(value) if value else None
    except (TypeError, ValueError):
        return None


def folder_raise_for_access_bypass(**kwargs: Any) -> bool:
    """Bypass raise_for_access if user has folder access to the asset.

    Collects chart and dashboard IDs from all available sources (kwargs,
    query_context form_data, request URL) and checks whether any of them
    are in a folder the user has access to.

    Global datasource bypass is intentionally NOT granted — folder
    membership should not leak into dataset-level access.
    """
    from superset.daos.folder_permissions import FolderPermissionDAO

    user_id = get_user_id()
    if not user_id:
        return False

    # Collect IDs from all sources
    dashboard = kwargs.get("dashboard")
    chart = kwargs.get("chart")
    query_context = kwargs.get("query_context")
    form_data = (
        query_context.form_data
        if query_context
        and hasattr(query_context, "form_data")
        and query_context.form_data
        else {}
    )

    from flask import request as flask_request

    chart_ids = {
        _safe_int(v)
        for v in [
            chart.id if chart else None,
            form_data.get("slice_id"),
            flask_request.args.get("slice_id"),
        ]
    } - {None}

    dashboard_ids = {
        _safe_int(v)
        for v in [
            dashboard.id if dashboard else None,
            form_data.get("dashboardId"),
            flask_request.args.get("dashboard_id"),
        ]
    } - {None}

    # Check folder access for any collected ID
    for chart_id in chart_ids:
        if FolderPermissionDAO.user_has_folder_access_for_asset(
            user_id=user_id,
            chart_id=chart_id,
        ):
            return True

    for dashboard_id in dashboard_ids:
        if FolderPermissionDAO.user_has_folder_access_for_asset(
            user_id=user_id,
            dashboard_id=dashboard_id,
        ):
            return True

    return False


def folder_extra_owners(resource: Any) -> list[Any]:
    """Return folder editors as additional owners."""
    from superset.folders.models import FolderObject
    from superset.folders.utils import get_folder_editor_users

    tablename = resource.__tablename__
    if tablename == "slices":
        fk_col = FolderObject.chart_id
    elif tablename == "dashboards":
        fk_col = FolderObject.dashboard_id
    else:
        return []

    fo = db.session.query(FolderObject).filter(fk_col == resource.id).first()
    if not fo:
        return []

    return [
        {
            "id": u.id,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "username": u.username,
        }
        for u in get_folder_editor_users(fo.folder_id)
    ]
