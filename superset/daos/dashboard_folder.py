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
"""Data access for dashboard folders."""

from __future__ import annotations

from collections import defaultdict
from typing import Any
from uuid import UUID

from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy import func
from sqlalchemy.orm import Query

from superset import db, security_manager
from superset.daos.base import BaseDAO
from superset.dashboards.filters import DashboardAccessFilter
from superset.models.dashboard import Dashboard
from superset.models.dashboard_folder import DashboardFolder
from superset.subjects.models import dashboard_folder_editors, dashboard_folder_viewers
from superset.subjects.utils import get_user_subject_ids_subquery
from superset.utils.core import get_user_id


class DashboardFolderDAO(BaseDAO[DashboardFolder]):
    """Provide scoped dashboard folder queries and persistence."""

    @classmethod
    def can_write(cls, folder: DashboardFolder) -> bool:
        """Return whether the current user is an editor of the folder."""
        return security_manager.is_editor(folder)

    @classmethod
    def can_perform(cls, folder: DashboardFolder, action: str) -> bool:
        """Return whether the user can edit a folder and perform an action."""
        return cls.can_write(folder) and (
            security_manager.is_admin()
            or security_manager.can_access(f"can_{action}", "DashboardFolder")
        )

    @classmethod
    def get_by_id(cls, folder_id: UUID) -> DashboardFolder | None:
        """Find a folder by its public UUID."""
        return db.session.get(DashboardFolder, folder_id)

    @classmethod
    def find_name_conflict(
        cls,
        name: str,
        parent_id: UUID | None,
        excluded_folder_id: UUID | None = None,
    ) -> DashboardFolder | None:
        """Find a case-insensitive name conflict within one parent folder."""
        query = db.session.query(DashboardFolder).filter(
            func.lower(func.trim(DashboardFolder.name)) == name.strip().lower()
        )
        if parent_id is None:
            query = query.filter(DashboardFolder.parent_id.is_(None))
        else:
            query = query.filter(DashboardFolder.parent_id == parent_id)
        if excluded_folder_id is not None:
            query = query.filter(DashboardFolder.id != excluded_folder_id)
        return query.first()

    @classmethod
    def accessible_dashboard_query(cls) -> Query:
        """Build a dashboard query using Superset's canonical access filter."""
        query = db.session.query(Dashboard)
        return DashboardAccessFilter("id", SQLAInterface(Dashboard, db.session)).apply(
            query, None
        )

    @classmethod
    def uncategorize_dashboards(cls, folder: DashboardFolder) -> None:
        """Move dashboards in a folder subtree to the uncategorized root."""
        folder_ids: list[UUID] = []
        pending = [folder]
        visited: set[UUID] = set()
        while pending:
            current = pending.pop()
            if current.id in visited:
                continue
            visited.add(current.id)
            folder_ids.append(current.id)
            pending.extend(current.children)

        db.session.query(Dashboard).filter(Dashboard.folder_id.in_(folder_ids)).update(
            {Dashboard.folder_id: None}, synchronize_session=False
        )

    @classmethod
    def get_visible_tree(cls) -> dict[str, Any]:
        """Return visible folders and access-scoped recursive dashboard counts."""
        all_folders = db.session.query(DashboardFolder).all()
        dashboard_rows = (
            cls.accessible_dashboard_query()
            .with_entities(Dashboard.folder_id, func.count(Dashboard.id))
            .group_by(Dashboard.folder_id)
            .all()
        )
        direct_counts = dict(dashboard_rows)
        total_dashboards = sum(direct_counts.values())
        uncategorized_dashboards = direct_counts.get(None, 0)

        if security_manager.is_admin():
            visible_ids = {folder.id for folder in all_folders}
        else:
            visible_ids = {
                folder_id for folder_id in direct_counts if folder_id is not None
            }
            if user_id := get_user_id():
                subject_ids = get_user_subject_ids_subquery(user_id)
                for relation_table in (
                    dashboard_folder_editors,
                    dashboard_folder_viewers,
                ):
                    visible_ids.update(
                        folder_id
                        for (folder_id,) in db.session.query(relation_table.c.folder_id)
                        .filter(relation_table.c.subject_id.in_(subject_ids))
                        .all()
                    )
            parent_by_id = {folder.id: folder.parent_id for folder in all_folders}
            for folder_id in tuple(visible_ids):
                visited: set[UUID] = set()
                parent_id = parent_by_id.get(folder_id)
                while parent_id is not None and parent_id not in visited:
                    visited.add(parent_id)
                    visible_ids.add(parent_id)
                    parent_id = parent_by_id.get(parent_id)

        children: dict[UUID | None, list[UUID]] = defaultdict(list)
        for folder in all_folders:
            children[folder.parent_id].append(folder.id)

        def total_count(folder_id: UUID, path: set[UUID]) -> int:
            if folder_id in path:
                return 0
            next_path = path | {folder_id}
            return direct_counts.get(folder_id, 0) + sum(
                total_count(child_id, next_path)
                for child_id in children.get(folder_id, [])
            )

        folders = [
            {
                "id": str(folder.id),
                "name": folder.name,
                "description": folder.description,
                "parent_id": str(folder.parent_id) if folder.parent_id else None,
                "editors": [
                    cls._subject_payload(subject)
                    for subject in getattr(folder, "editors", [])
                ],
                "viewers": [
                    cls._subject_payload(subject)
                    for subject in getattr(folder, "viewers", [])
                ],
                "dashboard_count": total_count(folder.id, set()),
                "can_create": cls.can_perform(folder, "create"),
                "can_rename": cls.can_perform(folder, "rename"),
                "can_delete": cls.can_perform(folder, "delete"),
                "can_move_dashboard": cls.can_perform(folder, "move_dashboard"),
            }
            for folder in all_folders
            if folder.id in visible_ids
        ]
        return {
            "result": folders,
            "count": len(folders),
            "total_dashboards": total_dashboards,
            "uncategorized_dashboards": uncategorized_dashboards,
        }

    @staticmethod
    def _subject_payload(subject: Any) -> dict[str, Any]:
        """Serialize a Subject using the compact public response shape."""
        return {
            "id": subject.id,
            "label": subject.label,
            "secondary_label": subject.secondary_label,
            "img": subject.img,
            "type": subject.type,
        }
