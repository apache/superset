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

    # Never bypass for assets in private folders unless the user is the owner
    if is_asset_in_private_folder(
        dashboard_id=dashboard.id if dashboard else None,
        chart_id=chart.id if chart else None,
    ):
        from superset.daos.folder_permissions import FolderPermissionDAO as _PDAO

        has_access = _PDAO.user_has_folder_access_for_asset(
            user_id=user_id,
            dashboard_id=dashboard.id if dashboard else None,
            chart_id=chart.id if chart else None,
        )
        return has_access

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


def after_asset_create(asset: Any, asset_type: str) -> None:
    """Auto-assign newly created charts/dashboards to the user's 'Only Me' folder."""
    import logging

    logger = logging.getLogger(__name__)
    logger.info("[after_asset_create] called with asset_type=%s, asset_id=%s", asset_type, asset.id)

    from superset.daos.folder import FolderDAO
    from superset.folders.utils import can_manage_folders

    user_id = get_user_id()
    logger.info("[after_asset_create] user_id=%s", user_id)
    if not user_id:
        logger.info("[after_asset_create] no user_id, returning")
        return

    from flask import g

    if not hasattr(g, "user"):
        logger.info("[after_asset_create] no g.user, returning")
        return
    if not can_manage_folders(g.user):
        logger.info("[after_asset_create] user cannot manage folders, roles=%s", [r.name for r in g.user.roles])
        return

    logger.info("[after_asset_create] creating/getting Only Me folder")
    folder = FolderDAO.get_or_create_only_me_folder(user_id)
    logger.info("[after_asset_create] assigning asset to folder %s", folder.id)
    FolderDAO.assign_assets(folder, [{"type": asset_type, "id": asset.id}])
    logger.info("[after_asset_create] done")


def is_asset_in_private_folder(
    dashboard_id: int | None = None,
    chart_id: int | None = None,
) -> bool:
    """Check if an asset is in a private folder."""
    from superset.folders.models import Folder, FolderObject

    query = db.session.query(FolderObject).join(
        Folder, Folder.id == FolderObject.folder_id
    ).filter(Folder.is_private.is_(True))

    if dashboard_id:
        if query.filter(FolderObject.dashboard_id == dashboard_id).first():
            return True
    if chart_id:
        if query.filter(FolderObject.chart_id == chart_id).first():
            return True
    return False
