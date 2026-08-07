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

from flask import g
from flask_appbuilder.models.sqla.interface import SQLAInterface
from sqlalchemy import func
from sqlalchemy.orm import Query

from superset import db, security_manager
from superset.daos.base import BaseDAO
from superset.dashboards.filters import DashboardAccessFilter
from superset.models.dashboard import Dashboard
from superset.models.dashboard_folder import DashboardFolder


class DashboardFolderDAO(BaseDAO[DashboardFolder]):
    """Provide scoped dashboard folder queries and persistence."""

    @classmethod
    def can_write(cls, folder: DashboardFolder) -> bool:
        """Return whether the current user may mutate a folder."""
        user_id = getattr(g.user, "id", None)
        return security_manager.is_admin() or any(
            owner.id == user_id for owner in folder.owners
        )

    @classmethod
    def can_perform(cls, folder: DashboardFolder, action: str) -> bool:
        """Return whether the user owns a folder and has the action permission."""
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
    def get_users(cls, user_ids: list[int]) -> list[Any]:
        """Resolve owner IDs to users."""
        if not user_ids:
            return []
        return (
            db.session.query(security_manager.user_model)
            .filter(security_manager.user_model.id.in_(user_ids))
            .all()
        )

    @classmethod
    def accessible_dashboard_query(cls) -> Query:
        """Build a dashboard query using Superset's canonical access filter."""
        query = db.session.query(Dashboard)
        return DashboardAccessFilter("id", SQLAInterface(Dashboard, db.session)).apply(
            query, None
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
            user_id = getattr(g.user, "id", None)
            visible_ids.update(
                folder.id
                for folder in all_folders
                if any(owner.id == user_id for owner in folder.owners)
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
                "owners": [
                    {
                        "id": owner.id,
                        "first_name": owner.first_name,
                        "last_name": owner.last_name,
                    }
                    for owner in folder.owners
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
