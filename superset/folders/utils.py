"""Folder utility functions."""

from __future__ import annotations

from typing import Any

FOLDER_MANAGEMENT_ROLES = {"Admin", "Alpha", "Gamma"}


def can_manage_folders(user: Any) -> bool:
    """Check if user can create, delete, and manage folders.

    Only Admin and Alpha roles are allowed.
    """
    if not user or not getattr(user, "roles", None):
        return False
    return any(role.name in FOLDER_MANAGEMENT_ROLES for role in user.roles)
