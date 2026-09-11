"""Folder utility functions."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select

FOLDER_MANAGEMENT_ROLES = {"Admin", "Alpha", "Gamma"}


def can_manage_folders(user: Any) -> bool:
    """Check if user can create, delete, and manage folders.

    Allowed for Admin, Alpha, and Gamma roles.
    """
    if not user or not getattr(user, "roles", None):
        return False
    return any(role.name in FOLDER_MANAGEMENT_ROLES for role in user.roles)


def get_folder_editor_users(folder_id: int) -> list[Any]:
    """Load User objects that are editors of the given folder."""
    from flask_appbuilder.security.sqla.models import User
    from superset import db

    from superset.folders.models import folder_editors

    editor_user_ids = [
        row.user_id
        for row in db.session.execute(
            folder_editors.select().where(folder_editors.c.folder_id == folder_id)
        ).fetchall()
    ]
    if not editor_user_ids:
        return []
    return db.session.query(User).filter(User.id.in_(editor_user_ids)).all()


def user_accessible_folder_ids(user_id: int) -> Any:
    """Subquery of folder IDs the user has access to (editor or viewer)."""
    from superset.folders.models import folder_editors, folder_viewers

    return (
        select(folder_viewers.c.folder_id)
        .where(folder_viewers.c.user_id == user_id)
        .union(
            select(folder_editors.c.folder_id).where(
                folder_editors.c.user_id == user_id
            )
        )
    )
