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


def folder_raise_for_access_bypass(**kwargs: Any) -> bool:
    """Bypass raise_for_access if user has folder access to the asset."""
    from flask import current_app

    from superset.daos.folder_permissions import FolderPermissionDAO

    user_id = get_user_id()
    if not user_id:
        return False

    dashboard = kwargs.get("dashboard")
    chart = kwargs.get("chart")
    query_context = kwargs.get("query_context")
    viz = kwargs.get("viz")
    datasource = kwargs.get("datasource")

    if not datasource and query_context:
        datasource = query_context.datasource
    if not datasource and viz:
        datasource = viz.datasource

    if FolderPermissionDAO.user_has_folder_access_for_asset(
        user_id=user_id,
        dashboard_id=dashboard.id if dashboard else None,
        chart_id=chart.id if chart else None,
        datasource_id=datasource.id if datasource else None,
    ):
        return True

    # Transitive access: datasource → chart → dashboard → folder.
    # Grants access to datasources used by charts on dashboards in the
    # user's folders, even if the chart is not directly in any folder.
    if (
        datasource
        and current_app.config.get("FOLDER_DASHBOARD_TRANSITIVE_ACCESS")
        and FolderPermissionDAO.user_has_transitive_dashboard_access(
            user_id=user_id,
            datasource_id=datasource.id,
        )
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
