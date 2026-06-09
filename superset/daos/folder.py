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
"""Data access for folders and the assets they contain.

Validation and orchestration live in ``superset.commands.folder``; this DAO is
limited to queries and persistence.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import func, literal, select, union_all

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.folders.constants import ASSET_TYPE_CONFIGS, asset_types_for_folder_type
from superset.folders.models import Folder, FolderObject, FolderPin

logger = logging.getLogger(__name__)

# A resolved asset: its type label paired with the underlying model instance.
ResolvedAsset = tuple[str, Any]


class FolderDAO(BaseDAO[Folder]):
    """Queries and persistence for folders and their asset links."""

    # ------------------------------------------------------------------ #
    # Lookups
    # ------------------------------------------------------------------ #
    @classmethod
    def get_by_uuid(cls, folder_uuid: str) -> Folder | None:
        """Find a folder by UUID (or numeric id)."""
        return cls.find_by_id_or_uuid(folder_uuid)

    @classmethod
    def get_folders(cls, folder_type: str | None = None) -> list[Folder]:
        """List folders, optionally filtered by ``folder_type``."""
        query = db.session.query(Folder)
        if folder_type:
            query = query.filter(Folder.folder_type == folder_type)
        return query.order_by(Folder.changed_on.desc()).all()

    @classmethod
    def get_roots(cls, folder_type: str) -> list[Folder]:
        """Top-level folders (no parent) for a folder type."""
        return (
            db.session.query(Folder)
            .filter(Folder.parent_id.is_(None), Folder.folder_type == folder_type)
            .order_by(Folder.changed_on.desc())
            .all()
        )

    @classmethod
    def get_children(cls, folder: Folder) -> list[Folder]:
        """Direct subfolders of ``folder``."""
        return (
            db.session.query(Folder)
            .filter(Folder.parent_id == folder.id)
            .order_by(Folder.changed_on.desc())
            .all()
        )

    # ------------------------------------------------------------------ #
    # Asset queries
    # ------------------------------------------------------------------ #
    @classmethod
    def get_folder_assets(cls, folder: Folder) -> list[ResolvedAsset]:
        """Resolve the assets linked directly to ``folder`` into model objects."""
        ids_by_type: dict[str, list[int]] = {name: [] for name in ASSET_TYPE_CONFIGS}
        for link in folder.objects:
            for name, config in ASSET_TYPE_CONFIGS.items():
                asset_id = getattr(link, config.fk_column)
                if asset_id is not None:
                    ids_by_type[name].append(asset_id)
        return cls._load_assets(ids_by_type)

    @classmethod
    def get_unfoldered_assets(cls, folder_type: str) -> list[ResolvedAsset]:
        """Assets of the given folder type that are not in any folder."""
        resolved: list[ResolvedAsset] = []
        for name in asset_types_for_folder_type(folder_type):
            config = ASSET_TYPE_CONFIGS[name]
            model = config.model
            link_column = getattr(FolderObject, config.fk_column)
            used = db.session.query(link_column).filter(link_column.isnot(None))
            rows = db.session.query(model).filter(model.id.notin_(used)).all()
            resolved.extend((name, row) for row in rows)
        return resolved

    @classmethod
    def get_contents(  # noqa: C901
        cls,
        folder: Folder | None,
        folder_type: str,
        *,
        search: str | None = None,
        types: list[str] | None = None,
        viz_types: list[str] | None = None,
        datasets: list[int] | None = None,
        owners: list[int] | None = None,
        modified_start: datetime | None = None,
        modified_end: datetime | None = None,
        page: int = 0,
        page_size: int = 25,
    ) -> tuple[list[ResolvedAsset], int]:
        """Paginated, filtered contents of a folder (or the root).

        Returns ``(rows, total)`` where each row is ``(kind, model_instance)`` with
        ``kind`` in ``{"folder", <asset types>}``. Pagination happens in the DB via a
        ``UNION ALL`` over the included sources ordered by (folders first, then most
        recently changed), so callers get exactly one page plus the total count.
        """
        from superset.connectors.sqla.models import SqlaTable  # noqa: F401
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice

        folder_id = folder.id if folder else None
        requested = set(types) if types else None
        asset_only_filter = bool(viz_types or datasets or owners)

        def included(kind: str) -> bool:
            return requested is None or kind in requested

        selects = []

        # --- Folders (subfolders / top-level) ---
        if included("folder") and not asset_only_filter:
            fq = select(
                literal(0).label("kind_order"),
                literal("folder").label("item_type"),
                Folder.id.label("item_id"),
                Folder.changed_on.label("changed_on"),
            ).where(Folder.folder_type == folder_type)
            fq = fq.where(
                Folder.parent_id.is_(None)
                if folder_id is None
                else Folder.parent_id == folder_id
            )
            if search:
                fq = fq.where(Folder.name.ilike(f"%{search}%"))
            if modified_start:
                fq = fq.where(Folder.changed_on >= modified_start)
            if modified_end:
                fq = fq.where(Folder.changed_on <= modified_end)
            selects.append(fq)

        # --- Assets (charts / dashboards for this folder type) ---
        title_attrs = {
            "chart": Slice.slice_name,
            "dashboard": Dashboard.dashboard_title,
        }
        for name in asset_types_for_folder_type(folder_type):
            if not included(name):
                continue
            # viz/dataset filters only make sense for charts.
            if (viz_types or datasets) and name != "chart":
                continue
            model = ASSET_TYPE_CONFIGS[name].model
            fk_col = getattr(FolderObject, ASSET_TYPE_CONFIGS[name].fk_column)
            aq = select(
                literal(1).label("kind_order"),
                literal(name).label("item_type"),
                model.id.label("item_id"),
                model.changed_on.label("changed_on"),
            )
            if folder_id is None:
                used = select(fk_col).where(fk_col.isnot(None))
                aq = aq.where(model.id.notin_(used))
            else:
                in_folder = select(fk_col).where(
                    FolderObject.folder_id == folder_id, fk_col.isnot(None)
                )
                aq = aq.where(model.id.in_(in_folder))
            if search:
                aq = aq.where(title_attrs[name].ilike(f"%{search}%"))
            if modified_start:
                aq = aq.where(model.changed_on >= modified_start)
            if modified_end:
                aq = aq.where(model.changed_on <= modified_end)
            if owners:
                aq = aq.where(model.owners.any(cls._user_model().id.in_(owners)))
            if name == "chart":
                if viz_types:
                    aq = aq.where(Slice.viz_type.in_(viz_types))
                if datasets:
                    aq = aq.where(Slice.datasource_id.in_(datasets))
            selects.append(aq)

        if not selects:
            return [], 0

        unioned = union_all(*selects).subquery()
        total = (
            db.session.execute(select(func.count()).select_from(unioned)).scalar() or 0
        )
        page_rows = db.session.execute(
            select(unioned.c.item_type, unioned.c.item_id)
            .order_by(unioned.c.kind_order, unioned.c.changed_on.desc())
            .limit(page_size)
            .offset(page * page_size)
        ).all()

        # Hydrate the page's ids into model instances, preserving order.
        ids_by_type: dict[str, list[int]] = defaultdict(list)
        for item_type, item_id in page_rows:
            ids_by_type[item_type].append(item_id)
        objects: dict[tuple[str, int], Any] = {}
        if ids_by_type.get("folder"):
            for obj in (
                db.session.query(Folder)
                .filter(Folder.id.in_(ids_by_type["folder"]))
                .all()
            ):
                objects[("folder", obj.id)] = obj
        for name in asset_types_for_folder_type(folder_type):
            if not ids_by_type.get(name):
                continue
            model = ASSET_TYPE_CONFIGS[name].model
            for obj in (
                db.session.query(model).filter(model.id.in_(ids_by_type[name])).all()
            ):
                objects[(name, obj.id)] = obj

        rows: list[ResolvedAsset] = [
            (item_type, objects[(item_type, item_id)])
            for item_type, item_id in page_rows
            if (item_type, item_id) in objects
        ]
        return rows, total

    @staticmethod
    def _user_model() -> Any:
        from superset import security_manager

        return security_manager.user_model

    @classmethod
    def _load_assets(cls, ids_by_type: dict[str, list[int]]) -> list[ResolvedAsset]:
        resolved: list[ResolvedAsset] = []
        for name, ids in ids_by_type.items():
            if not ids:
                continue
            model = ASSET_TYPE_CONFIGS[name].model
            rows = db.session.query(model).filter(model.id.in_(ids)).all()
            resolved.extend((name, row) for row in rows)
        return resolved

    # ------------------------------------------------------------------ #
    # Persistence
    # ------------------------------------------------------------------ #
    @classmethod
    def delete_folder(cls, folder: Folder) -> None:
        """Delete a folder, re-parenting children to its parent.

        Assets linked to the folder become unfoldered: the ``folder_objects``
        rows are removed (ORM delete-orphan / DB ``ON DELETE CASCADE``) while the
        assets themselves are untouched.
        """
        for child in list(folder.children):
            child.parent_id = folder.parent_id
        db.session.flush()
        db.session.delete(folder)

    @classmethod
    def assign_assets(cls, folder: Folder, assets: list[dict[str, Any]]) -> None:
        """Assign/move assets into ``folder`` (upsert).

        An asset can live in only one folder, so an existing link is moved rather
        than duplicated. Callers are expected to have validated the assets.
        """
        for asset in assets:
            config = ASSET_TYPE_CONFIGS[asset["type"]]
            link_column = getattr(FolderObject, config.fk_column)
            link = (
                db.session.query(FolderObject)
                .filter(link_column == asset["id"])
                .one_or_none()
            )
            if link:
                link.folder_id = folder.id
            else:
                link = FolderObject(folder_id=folder.id, created_on=datetime.now())
                setattr(link, config.fk_column, asset["id"])
                db.session.add(link)

    @classmethod
    def set_assets(cls, folder: Folder, assets: list[dict[str, Any]]) -> None:
        """Set ``folder``'s membership to exactly ``assets``.

        Listed assets are moved into the folder; the folder's current assets that
        are not listed have their link removed (back to the root). An empty list
        empties the folder. Callers are expected to have validated the assets.
        """
        desired = {(asset["type"], asset["id"]) for asset in assets}
        for link in list(folder.objects):
            for name, config in ASSET_TYPE_CONFIGS.items():
                asset_id = getattr(link, config.fk_column)
                if asset_id is not None and (name, asset_id) not in desired:
                    db.session.delete(link)
                    break
        db.session.flush()
        cls.assign_assets(folder, assets)

    # ------------------------------------------------------------------ #
    # Validation helpers (used by commands)
    # ------------------------------------------------------------------ #
    @classmethod
    def validate_name_uniqueness(
        cls,
        name: str,
        parent_id: int | None,
        folder_type: str,
        exclude_id: int | None = None,
    ) -> bool:
        """True if no sibling of the same type already uses ``name``."""
        query = db.session.query(Folder.id).filter(
            Folder.parent_id.is_(None)
            if parent_id is None
            else Folder.parent_id == parent_id,
            Folder.name == name,
            Folder.folder_type == folder_type,
        )
        if exclude_id is not None:
            query = query.filter(Folder.id != exclude_id)
        return query.first() is None

    @classmethod
    def is_descendant(cls, candidate: Folder, ancestor: Folder) -> bool:
        """True if ``candidate`` is ``ancestor`` itself or below it in the tree."""
        node: Folder | None = candidate
        while node is not None:
            if node.id == ancestor.id:
                return True
            node = node.parent
        return False

    @classmethod
    def asset_exists(cls, asset_type: str, asset_id: int) -> bool:
        """True if the referenced asset exists."""
        model = ASSET_TYPE_CONFIGS[asset_type].model
        return (
            db.session.query(model.id).filter(model.id == asset_id).first() is not None
        )

    # ------------------------------------------------------------------ #
    # Pins
    # ------------------------------------------------------------------ #
    @classmethod
    def get_pins(cls, user_id: int) -> list[FolderPin]:
        return (
            db.session.query(FolderPin)
            .filter(FolderPin.user_id == user_id)
            .order_by(FolderPin.position)
            .all()
        )

    @classmethod
    def create_pin(
        cls,
        user_id: int,
        object_id: int,
        object_type: str,
        position: int,
    ) -> FolderPin:
        from datetime import datetime

        pin = FolderPin(
            user_id=user_id,
            object_id=object_id,
            object_type=object_type,
            position=position,
            created_on=datetime.now(),
        )
        db.session.add(pin)
        db.session.flush()
        return pin

    @classmethod
    def delete_pin(cls, pin_id: int, user_id: int) -> bool:
        pin = (
            db.session.query(FolderPin)
            .filter(FolderPin.id == pin_id, FolderPin.user_id == user_id)
            .first()
        )
        if not pin:
            return False
        db.session.delete(pin)
        db.session.flush()
        return True

    # ------------------------------------------------------------------ #
    # Subjects (permissions)
    # ------------------------------------------------------------------ #
    @classmethod
    def get_subjects(cls, folder_id: int) -> list[dict[str, Any]]:
        from superset.folders.models import folder_editors, folder_viewers

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

    @classmethod
    def add_subject(cls, folder_id: int, user_id: int, permission: str) -> None:

        from superset.folders.models import folder_editors, folder_viewers

        if permission == "editor":
            db.session.execute(
                folder_editors.insert().values(folder_id=folder_id, user_id=user_id)
            )
        else:
            db.session.execute(
                folder_viewers.insert().values(folder_id=folder_id, user_id=user_id)
            )
        db.session.flush()

    @classmethod
    def update_subject(cls, folder_id: int, user_id: int, permission: str) -> None:
        from sqlalchemy import and_

        from superset.folders.models import folder_editors, folder_viewers

        # Remove from both, then add to the correct one
        db.session.execute(
            folder_editors.delete().where(
                and_(
                    folder_editors.c.folder_id == folder_id,
                    folder_editors.c.user_id == user_id,
                )
            )
        )
        db.session.execute(
            folder_viewers.delete().where(
                and_(
                    folder_viewers.c.folder_id == folder_id,
                    folder_viewers.c.user_id == user_id,
                )
            )
        )
        cls.add_subject(folder_id, user_id, permission)

    @classmethod
    def remove_subject(cls, folder_id: int, user_id: int) -> None:
        from sqlalchemy import and_

        from superset.folders.models import folder_editors, folder_viewers

        db.session.execute(
            folder_editors.delete().where(
                and_(
                    folder_editors.c.folder_id == folder_id,
                    folder_editors.c.user_id == user_id,
                )
            )
        )
        db.session.execute(
            folder_viewers.delete().where(
                and_(
                    folder_viewers.c.folder_id == folder_id,
                    folder_viewers.c.user_id == user_id,
                )
            )
        )
        db.session.flush()
