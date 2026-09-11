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
"""Data access for folder permission operations."""

from __future__ import annotations

from typing import Any

from sqlalchemy import and_
from superset import db
from superset.utils import json as json_utils

from superset.folders.models import (
    Folder,
    folder_editors,
    folder_viewers,
    FolderObject,
)


class FolderPermissionDAO:
    """Queries and persistence for folder permissions (editors/viewers)."""

    # ------------------------------------------------------------------ #
    # Subject queries
    # ------------------------------------------------------------------ #
    @staticmethod
    def get_subjects(folder_id: int) -> list[dict[str, Any]]:
        """Get all editors and viewers for a folder."""
        subjects: list[dict[str, Any]] = []

        editors = db.session.execute(
            folder_editors.select().where(folder_editors.c.folder_id == folder_id)
        ).fetchall()
        for row in editors:
            subjects.append({"user_id": row.user_id, "permission": "editor"})

        viewers = db.session.execute(
            folder_viewers.select().where(folder_viewers.c.folder_id == folder_id)
        ).fetchall()
        for row in viewers:
            subjects.append({"user_id": row.user_id, "permission": "viewer"})

        return subjects

    # ------------------------------------------------------------------ #
    # Subject mutations
    # ------------------------------------------------------------------ #
    @staticmethod
    def add_editor(folder_id: int, user_id: int) -> None:
        db.session.execute(
            folder_editors.insert().values(folder_id=folder_id, user_id=user_id)
        )
        db.session.flush()

    @staticmethod
    def add_viewer(folder_id: int, user_id: int) -> None:
        db.session.execute(
            folder_viewers.insert().values(folder_id=folder_id, user_id=user_id)
        )
        db.session.flush()

    @staticmethod
    def remove_editor(folder_id: int, user_id: int) -> None:
        db.session.execute(
            folder_editors.delete().where(
                and_(
                    folder_editors.c.folder_id == folder_id,
                    folder_editors.c.user_id == user_id,
                )
            )
        )
        db.session.flush()

    @staticmethod
    def remove_viewer(folder_id: int, user_id: int) -> None:
        db.session.execute(
            folder_viewers.delete().where(
                and_(
                    folder_viewers.c.folder_id == folder_id,
                    folder_viewers.c.user_id == user_id,
                )
            )
        )
        db.session.flush()

    @staticmethod
    def update_subject_permission(
        folder_id: int, user_id: int, permission: str
    ) -> None:
        """Move a user between editors and viewers."""
        if permission not in ("editor", "viewer"):
            raise ValueError(
                f"Invalid permission: {permission!r}. Must be 'editor' or 'viewer'."
            )
        if permission == "editor":
            FolderPermissionDAO.remove_viewer(folder_id, user_id)
            FolderPermissionDAO.add_editor(folder_id, user_id)
        else:
            FolderPermissionDAO.remove_editor(folder_id, user_id)
            FolderPermissionDAO.add_viewer(folder_id, user_id)

    @staticmethod
    def remove_subject(folder_id: int, user_id: int) -> None:
        """Remove a user from both editors and viewers."""
        FolderPermissionDAO.remove_editor(folder_id, user_id)
        FolderPermissionDAO.remove_viewer(folder_id, user_id)

    # ------------------------------------------------------------------ #
    # Permission inheritance
    # ------------------------------------------------------------------ #
    @staticmethod
    def copy_permissions_to_subfolder(
        parent_folder_id: int, child_folder_id: int
    ) -> None:
        """Replace child folder permissions with parent's.

        Clears existing editors/viewers on the child, then copies the parent's.
        Sets extra.inherits_permissions = true on the child.
        Skips private folders — their permissions are owner-only.
        """
        child = db.session.query(Folder).get(child_folder_id)
        if child and child.is_private:
            return

        # Clear child's existing permissions
        db.session.execute(
            folder_editors.delete().where(
                folder_editors.c.folder_id == child_folder_id
            )
        )
        db.session.execute(
            folder_viewers.delete().where(
                folder_viewers.c.folder_id == child_folder_id
            )
        )

        # Copy from parent
        parent_editors = db.session.execute(
            folder_editors.select().where(
                folder_editors.c.folder_id == parent_folder_id
            )
        ).fetchall()
        for row in parent_editors:
            db.session.execute(
                folder_editors.insert().values(
                    folder_id=child_folder_id, user_id=row.user_id
                )
            )

        parent_viewers = db.session.execute(
            folder_viewers.select().where(
                folder_viewers.c.folder_id == parent_folder_id
            )
        ).fetchall()
        for row in parent_viewers:
            db.session.execute(
                folder_viewers.insert().values(
                    folder_id=child_folder_id, user_id=row.user_id
                )
            )

        # Set inherits flag on child
        if child := db.session.query(Folder).get(child_folder_id):
            extra = json_utils.loads(child.extra) if child.extra else {}
            extra["inherits_permissions"] = True
            child.extra = json_utils.dumps(extra)

        db.session.flush()

    @staticmethod
    def push_down_permissions(folder_id: int) -> None:
        """Re-sync permissions to all descendant folders still inheriting.

        Called when a folder's permissions change. Only affects descendants
        where extra.inherits_permissions = true.
        """

        folder = db.session.query(Folder).get(folder_id)
        if not folder:
            return

        # Get current folder's permissions
        current_subjects = FolderPermissionDAO.get_subjects(folder_id)

        # Find all descendants that still inherit
        def _get_inheriting_descendants(parent_id: int) -> list[int]:
            children = (
                db.session.query(Folder).filter(Folder.parent_id == parent_id).all()
            )
            result = []
            for child in children:
                if child.is_private:
                    continue
                extra = json_utils.loads(child.extra) if child.extra else {}
                if extra.get("inherits_permissions", True):
                    result.append(child.id)
                    result.extend(_get_inheriting_descendants(child.id))
            return result

        descendant_ids = _get_inheriting_descendants(folder_id)

        for desc_id in descendant_ids:
            # Clear existing permissions
            db.session.execute(
                folder_editors.delete().where(folder_editors.c.folder_id == desc_id)
            )
            db.session.execute(
                folder_viewers.delete().where(folder_viewers.c.folder_id == desc_id)
            )
            # Copy from parent
            for subject in current_subjects:
                if subject["permission"] == "editor":
                    db.session.execute(
                        folder_editors.insert().values(
                            folder_id=desc_id, user_id=subject["user_id"]
                        )
                    )
                else:
                    db.session.execute(
                        folder_viewers.insert().values(
                            folder_id=desc_id, user_id=subject["user_id"]
                        )
                    )

        db.session.flush()

    @staticmethod
    def mark_permissions_explicit(folder_id: int) -> None:
        """Mark a folder as having explicitly set permissions (no longer inheriting)."""

        if folder := db.session.query(Folder).get(folder_id):
            extra = json_utils.loads(folder.extra) if folder.extra else {}
            extra["inherits_permissions"] = False
            folder.extra = json_utils.dumps(extra)
            db.session.flush()

    # ------------------------------------------------------------------ #
    # Access checks
    # ------------------------------------------------------------------ #
    @staticmethod
    def user_has_folder_access(user_id: int, folder_id: int) -> bool:
        """Check if a user has viewer or editor access to a folder."""
        is_editor = db.session.execute(
            folder_editors.select().where(
                and_(
                    folder_editors.c.folder_id == folder_id,
                    folder_editors.c.user_id == user_id,
                )
            )
        ).first()
        if is_editor:
            return True

        is_viewer = db.session.execute(
            folder_viewers.select().where(
                and_(
                    folder_viewers.c.folder_id == folder_id,
                    folder_viewers.c.user_id == user_id,
                )
            )
        ).first()
        return is_viewer is not None

    @staticmethod
    def user_is_folder_editor(user_id: int, folder_id: int) -> bool:
        """Check if a user is an editor of a specific folder."""
        return (
            db.session.execute(
                folder_editors.select().where(
                    and_(
                        folder_editors.c.folder_id == folder_id,
                        folder_editors.c.user_id == user_id,
                    )
                )
            ).first()
            is not None
        )

    @staticmethod
    def user_has_any_folder_access(user_id: int) -> bool:
        """Check if user has any folder-level access (editor or viewer)."""
        has_access = (
            db.session.query(folder_editors.c.id)
            .filter(folder_editors.c.user_id == user_id)
            .first()
        ) or (
            db.session.query(folder_viewers.c.id)
            .filter(folder_viewers.c.user_id == user_id)
            .first()
        )
        return has_access is not None

    @staticmethod
    def user_has_any_folder_editor_access(user_id: int) -> bool:
        """Check if user is an editor on any folder."""
        return (
            db.session.query(folder_editors.c.id)
            .filter(folder_editors.c.user_id == user_id)
            .first()
        ) is not None

    @staticmethod
    def _check_folder_object_access(user_id: int, filter_condition: Any) -> bool:
        """Check if a matching FolderObject is in an accessible folder."""
        fo = db.session.query(FolderObject).filter(filter_condition).first()
        return bool(
            fo and FolderPermissionDAO.user_has_folder_access(user_id, fo.folder_id)
        )

    @staticmethod
    def user_has_folder_access_for_asset(
        user_id: int,
        dashboard_id: int | None = None,
        chart_id: int | None = None,
        datasource_id: int | None = None,
    ) -> bool:
        """Check if user has folder access that covers this asset.

        Checks multiple paths:
        1. Dashboard/chart is directly in a folder the user has access to
        2. Datasource is used by a chart in a folder the user has access to
        """
        check = FolderPermissionDAO._check_folder_object_access

        if dashboard_id and check(user_id, FolderObject.dashboard_id == dashboard_id):
            return True

        if chart_id and check(user_id, FolderObject.chart_id == chart_id):
            return True

        if datasource_id:
            from superset.models.slice import Slice as SliceModel

            folder_objects = (
                db.session.query(FolderObject)
                .join(SliceModel, SliceModel.id == FolderObject.chart_id)
                .filter(SliceModel.datasource_id == datasource_id)
                .all()
            )
            for fo in folder_objects:
                if FolderPermissionDAO.user_has_folder_access(user_id, fo.folder_id):
                    return True

        return False

    @staticmethod
    def user_has_transitive_dashboard_access(
        user_id: int,
        datasource_id: int,
    ) -> bool:
        """Check if a datasource is reachable via: datasource → chart → dashboard → folder.

        Grants access when a dashboard in the user's folder contains a chart
        that uses this datasource, even if the chart itself is not in any folder.
        """
        from superset.models.dashboard import dashboard_slices
        from superset.models.slice import Slice as SliceModel

        # Find dashboards that contain a chart using this datasource
        # and are in a folder the user has access to.
        rows = (
            db.session.query(FolderObject.folder_id)
            .join(
                dashboard_slices,
                dashboard_slices.c.dashboard_id == FolderObject.dashboard_id,
            )
            .join(SliceModel, SliceModel.id == dashboard_slices.c.slice_id)
            .filter(
                FolderObject.dashboard_id.isnot(None),
                SliceModel.datasource_id == datasource_id,
            )
            .all()
        )
        return any(
            FolderPermissionDAO.user_has_folder_access(user_id, row.folder_id)
            for row in rows
        )

    @staticmethod
    def user_is_folder_editor_for_asset(
        user_id: int,
        dashboard_id: int | None = None,
        chart_id: int | None = None,
    ) -> bool:
        """Check if user is a folder editor for an asset."""
        if dashboard_id:
            fo = (
                db.session.query(FolderObject)
                .filter(FolderObject.dashboard_id == dashboard_id)
                .first()
            )
            if fo:
                return FolderPermissionDAO.user_is_folder_editor(user_id, fo.folder_id)

        if chart_id:
            fo = (
                db.session.query(FolderObject)
                .filter(FolderObject.chart_id == chart_id)
                .first()
            )
            if fo:
                return FolderPermissionDAO.user_is_folder_editor(user_id, fo.folder_id)

        return False

    @staticmethod
    def get_folder_editors_as_owners(
        dashboard_id: int | None = None,
        chart_id: int | None = None,
    ) -> list[dict[str, Any]]:
        """Return folder editors for an asset as owner-shaped dicts.

        Used to populate the `extra_owners` field in API responses.
        """
        from superset.folders.utils import get_folder_editor_users

        if dashboard_id:
            fo = (
                db.session.query(FolderObject)
                .filter(FolderObject.dashboard_id == dashboard_id)
                .first()
            )
        elif chart_id:
            fo = (
                db.session.query(FolderObject)
                .filter(FolderObject.chart_id == chart_id)
                .first()
            )
        else:
            return []

        if not fo:
            return []

        return [
            {
                "id": u.id,
                "first_name": u.first_name,
                "last_name": u.last_name,
            }
            for u in get_folder_editor_users(fo.folder_id)
        ]
