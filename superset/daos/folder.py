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

Validation and orchestration live in ``preset.folders.commands``; this DAO is
limited to queries and persistence.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from flask_appbuilder.security.sqla.models import User
from sqlalchemy import and_, func, literal, or_, select, union_all
from sqlalchemy.orm import joinedload

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.folders.constants import ASSET_TYPE_CONFIGS, asset_types_for_folder_type
from superset.folders.models import (
    Folder,
    folder_editors,
    folder_viewers,
    FolderObject,
    FolderPin,
)

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
        sort_column: str = "changed_on",
        sort_order: str = "desc",
    ) -> tuple[list[ResolvedAsset], int]:
        """Paginated, filtered contents of a folder (or the root).

        Returns ``(rows, total)`` where each row is ``(kind, model_instance)`` with
        ``kind`` in ``{"folder", <asset types>}``. Pagination happens in the DB via a
        ``UNION ALL`` over the included sources ordered by (folders first, then most
        recently changed), so callers get exactly one page plus the total count.
        """
        from superset import security_manager
        from superset.connectors.sqla.models import Database as ConnDatabase, SqlaTable
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice
        from superset.utils.core import get_user_id

        folder_id = folder.id if folder else None
        requested = set(types) if types else None
        asset_only_filter = bool(viz_types or datasets or owners)
        is_admin = security_manager.is_admin()
        user_id = get_user_id()

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
                Folder.name.label("sort_name"),
                literal("").label("sort_database"),
                literal("").label("sort_schema"),
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
            # Access filter: non-admins only see folders they are a member of
            if not is_admin and user_id:
                accessible_folder_ids = (
                    select(folder_viewers.c.folder_id)
                    .where(folder_viewers.c.user_id == user_id)
                    .union(
                        select(folder_editors.c.folder_id).where(
                            folder_editors.c.user_id == user_id
                        )
                    )
                )
                fq = fq.where(Folder.id.in_(accessible_folder_ids))
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
            if name == "chart":
                aq = (
                    select(
                        literal(1).label("kind_order"),
                        literal(name).label("item_type"),
                        model.id.label("item_id"),
                        model.changed_on.label("changed_on"),
                        title_attrs[name].label("sort_name"),
                        func.coalesce(ConnDatabase.database_name, "").label(
                            "sort_database"
                        ),
                        func.coalesce(SqlaTable.schema, "").label("sort_schema"),
                    )
                    .outerjoin(SqlaTable, Slice.datasource_id == SqlaTable.id)
                    .outerjoin(ConnDatabase, SqlaTable.database_id == ConnDatabase.id)
                )
            else:
                aq = select(
                    literal(1).label("kind_order"),
                    literal(name).label("item_type"),
                    model.id.label("item_id"),
                    model.changed_on.label("changed_on"),
                    title_attrs[name].label("sort_name"),
                    literal("").label("sort_database"),
                    literal("").label("sort_schema"),
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

            # Access filter: non-admins only see assets they can access
            if not is_admin and user_id:
                from superset.utils.filters import get_dataset_access_filters

                access_conditions = []

                # 1. User owns the asset
                access_conditions.append(
                    model.owners.any(cls._user_model().id == user_id)
                )

                # 2. User has folder membership for the asset
                user_folder_ids = (
                    select(folder_viewers.c.folder_id)
                    .where(folder_viewers.c.user_id == user_id)
                    .union(
                        select(folder_editors.c.folder_id).where(
                            folder_editors.c.user_id == user_id
                        )
                    )
                )
                folder_accessible = (
                    select(fk_col)
                    .select_from(FolderObject)
                    .where(
                        fk_col.isnot(None),
                        FolderObject.folder_id.in_(user_folder_ids),
                    )
                )
                access_conditions.append(model.id.in_(folder_accessible))

                # 3. Chart: user has datasource access
                can_access_all = security_manager.can_access_all_datasources()
                if name == "chart" and not can_access_all:
                    ds_accessible = (
                        select(Slice.id)
                        .join(
                            SqlaTable,
                            Slice.datasource_id == SqlaTable.id,
                        )
                        .join(
                            ConnDatabase,
                            SqlaTable.database_id == ConnDatabase.id,
                        )
                        .where(get_dataset_access_filters(Slice))
                    )
                    access_conditions.append(model.id.in_(ds_accessible))

                # 4. Dashboard: published + user has datasource access
                if name == "dashboard":
                    if can_access_all:
                        access_conditions.append(Dashboard.published.is_(True))
                    else:
                        published_accessible = (
                            select(Dashboard.id)
                            .join(Dashboard.slices, isouter=True)
                            .join(
                                SqlaTable,
                                Slice.datasource_id == SqlaTable.id,
                            )
                            .join(
                                ConnDatabase,
                                SqlaTable.database_id == ConnDatabase.id,
                            )
                            .where(
                                Dashboard.published.is_(True),
                                get_dataset_access_filters(Slice, can_access_all),
                            )
                        )
                        access_conditions.append(model.id.in_(published_accessible))

                aq = aq.where(or_(*access_conditions))
            selects.append(aq)

        if not selects:
            return [], 0

        unioned = union_all(*selects).subquery()
        total = (
            db.session.execute(select(func.count()).select_from(unioned)).scalar() or 0
        )
        sort_map = {
            "name": unioned.c.sort_name,
            "type": unioned.c.item_type,
            "changed_on": unioned.c.changed_on,
            "database": unioned.c.sort_database,
            "schema": unioned.c.sort_schema,
        }
        sort_col = sort_map.get(sort_column, unioned.c.changed_on)
        order = sort_col.asc() if sort_order == "asc" else sort_col.desc()

        # Pinned items always on top (root level only, per-user)
        pin_order = literal(1).label("pin_order")
        if folder_id is None and user_id:
            pin_sub = (
                select(FolderPin.object_type, FolderPin.object_id)
                .where(FolderPin.user_id == user_id)
                .subquery()
            )
            pin_order = (
                func.coalesce(
                    select(literal(0))
                    .where(
                        pin_sub.c.object_type == unioned.c.item_type,
                        pin_sub.c.object_id == unioned.c.item_id,
                    )
                    .correlate(unioned)
                    .scalar_subquery(),
                    1,
                )
            ).label("pin_order")

        page_rows = db.session.execute(
            select(unioned.c.item_type, unioned.c.item_id)
            .order_by(pin_order, order)
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
                .options(
                    joinedload(Folder.parent),
                    joinedload(Folder.created_by),
                    joinedload(Folder.changed_by),
                )
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
    def delete_folder(cls, folder: Folder, archive_items: bool = False) -> None:
        """Delete a folder, re-parenting children to its parent.

        When ``archive_items`` is False (default), assets linked to the folder
        become unfoldered. When True, the assets themselves are also deleted.
        """
        for child in list(folder.children):
            child.parent_id = folder.parent_id
            child.name = cls.resolve_name_conflict(
                child.name, folder.parent_id, folder.folder_type, exclude_id=child.id
            )
        db.session.flush()

        if archive_items:
            for link in list(folder.objects):
                for _name, config in ASSET_TYPE_CONFIGS.items():
                    asset_id = getattr(link, config.fk_column)
                    if asset_id is not None:
                        asset = db.session.get(config.model, asset_id)
                        if asset:
                            db.session.delete(asset)
                        break

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
                link = FolderObject(folder_id=folder.id, created_on=datetime.now())  # type: ignore[call-arg]
                setattr(link, config.fk_column, asset["id"])
                db.session.add(link)

            # Remove any pins for this asset since it's no longer at root
            db.session.query(FolderPin).filter(
                FolderPin.object_id == asset["id"],
                FolderPin.object_type == asset["type"],
            ).delete()

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

    @classmethod
    def remove_assets(cls, folder: Folder, assets: list[dict[str, Any]]) -> None:
        """Remove specific assets from ``folder`` (back to root)."""
        for asset in assets:
            config = ASSET_TYPE_CONFIGS[asset["type"]]
            link_column = getattr(FolderObject, config.fk_column)
            link = (
                db.session.query(FolderObject)
                .filter(
                    FolderObject.folder_id == folder.id,
                    link_column == asset["id"],
                )
                .one_or_none()
            )
            if link:
                db.session.delete(link)

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
    def resolve_name_conflict(
        cls,
        name: str,
        parent_id: int | None,
        folder_type: str,
        exclude_id: int | None = None,
    ) -> str:
        """Return a unique name by appending a numeric suffix if needed."""
        if cls.validate_name_uniqueness(name, parent_id, folder_type, exclude_id):
            return name
        counter = 1
        while True:
            candidate = f"{name} ({counter})"
            if cls.validate_name_uniqueness(
                candidate, parent_id, folder_type, exclude_id
            ):
                return candidate
            counter += 1

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
        pin = FolderPin(  # type: ignore[call-arg]
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
        subjects: list[dict[str, Any]] = []

        editors = db.session.execute(
            folder_editors.select().where(folder_editors.c.folder_id == folder_id)
        ).fetchall()
        viewers = db.session.execute(
            folder_viewers.select().where(folder_viewers.c.folder_id == folder_id)
        ).fetchall()

        all_user_ids = [r.user_id for r in editors] + [r.user_id for r in viewers]
        users_by_id = (
            {
                u.id: u
                for u in db.session.query(User).filter(User.id.in_(all_user_ids)).all()
            }
            if all_user_ids
            else {}
        )

        for row in editors:
            user = users_by_id.get(row.user_id)
            subjects.append(
                {
                    "user_id": row.user_id,
                    "permission": "editor",
                    "username": user.username if user else None,
                    "first_name": user.first_name if user else None,
                    "last_name": user.last_name if user else None,
                }
            )

        for row in viewers:
            user = users_by_id.get(row.user_id)
            subjects.append(
                {
                    "user_id": row.user_id,
                    "permission": "viewer",
                    "username": user.username if user else None,
                    "first_name": user.first_name if user else None,
                    "last_name": user.last_name if user else None,
                }
            )

        return subjects

    @classmethod
    def add_subject(cls, folder_id: int, user_id: int, permission: str) -> None:
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
