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

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import yaml
from flask import g, request, Response, current_app as app
from flask_appbuilder.api import expose, protect, safe
from sqlalchemy import and_, desc

from superset import db
from superset.commands.chart.export import ExportChartsCommand
from superset.commands.chart.importers.v1.utils import import_chart
from superset.commands.dashboard.export import ExportDashboardsCommand
from superset.commands.dashboard.importers.v1.utils import import_dashboard
from superset.commands.dataset.export import ExportDatasetsCommand
from superset.commands.dataset.importers.v1.utils import import_dataset
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.daos.dataset import DatasetDAO
from superset.models.dashboard import dashboard_slices
from superset.models.slice import Slice
from superset.models.version_history import AssetType, VersionHistory
from superset.views.base_api import BaseSupersetApi

logger = logging.getLogger(__name__)


class VersionControlRestApi(BaseSupersetApi):
    """Version control API that stores versions in the database"""

    resource_name = "version"
    allow_browser_login = True
    openapi_spec_tag = "Version Control"
    class_permission_name = "Version"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP | {
        "save_version": "write",
        "list_versions": "read",
        "restore_version": "write",
    }

    # Asset type mappings
    DAO_MAP: dict[str, type[ChartDAO] | type[DashboardDAO] | type[DatasetDAO]] = {
        "chart": ChartDAO,
        "dashboard": DashboardDAO,
        "dataset": DatasetDAO,
    }
    EXPORT_MAP: dict[str, type] = {
        "chart": ExportChartsCommand,
        "dashboard": ExportDashboardsCommand,
        "dataset": ExportDatasetsCommand,
    }
    NAME_ATTR: dict[str, str] = {
        "chart": "slice_name",
        "dashboard": "dashboard_title",
        "dataset": "table_name",
    }
    ASSET_TYPE_ENUM: dict[str, AssetType] = {
        "chart": AssetType.CHART,
        "dashboard": AssetType.DASHBOARD,
        "dataset": AssetType.DATASET,
    }

    @property
    def cfg(self) -> dict[str, Any]:
        """Get version control configuration"""
        c = app.config
        return {
            "enabled": c.get("VERSION_CONTROL_ENABLED", False),
            "retention": c.get("VERSION_RETENTION_LIMIT", 10),
        }

    def _export_asset(self, asset_type: str, asset_id: int) -> dict[str, Any]:
        """Export asset to YAML bundle"""
        configs: dict[str, Any] = {}
        for fname, content_fn in self.EXPORT_MAP[asset_type]([asset_id]).run():
            configs[fname] = content_fn()
        return configs

    def _import_asset(
        self, asset_type: str, asset_id: int, yaml_bundle: dict[str, Any]
    ) -> None:
        """Import asset from YAML bundle, preserving roles, owners, and dependencies"""
        # Get current asset to preserve roles/owners and references
        current_asset = self.DAO_MAP[asset_type].find_by_id(asset_id)
        current_roles = list(getattr(current_asset, "roles", []))
        current_owners = list(getattr(current_asset, "owners", []))

        logger.info(
            "Preserving %d owners and %d roles for %s %d",
            len(current_owners),
            len(current_roles),
            asset_type,
            asset_id,
        )

        # Parse the YAML bundle
        configs: dict[str, Any] = {}
        for fname, content in yaml_bundle.items():
            parsed = yaml.safe_load(content) if isinstance(content, str) else content
            configs[fname] = parsed

        # Import only the main asset, preserving current dataset/database/chart references
        for fname, config in configs.items():
            if fname.startswith(f"{asset_type}s/"):
                # Remove roles and owners from config
                if isinstance(config, list):
                    config = config[0] if config else {}

                # Strip out all permission-related fields
                config.pop("roles", None)
                config.pop("owners", None)
                config.pop("owner", None)
                config.pop("role", None)

                # Log what fields we're importing
                logger.info(
                    "Importing %s with fields: %s", asset_type, list(config.keys())
                )
                if asset_type == "dashboard":
                    logger.info(
                        "Dashboard title in config: %s",
                        config.get("dashboard_title", "NOT FOUND"),
                    )

                # For charts, ensure we keep the current dataset reference
                if asset_type == "chart" and hasattr(current_asset, "datasource_id"):
                    config["datasource_id"] = current_asset.datasource_id
                    config["datasource_type"] = current_asset.datasource_type
                    config["datasource_name"] = getattr(
                        current_asset.datasource, "table_name", ""
                    )

                # For datasets, preserve the current database reference
                elif asset_type == "dataset" and hasattr(current_asset, "database_id"):
                    config["database_id"] = current_asset.database_id

                # For dashboards, look up chart IDs by UUID from the database
                # and rebuild dashboard_slices
                elif asset_type == "dashboard":
                    chart_ids_to_add: list[int] = []
                    if "position" in config:
                        for key, child in config["position"].items():
                            if (
                                isinstance(child, dict)
                                and child.get("type") == "CHART"
                                and "uuid" in child.get("meta", {})
                            ):
                                chart_uuid = child["meta"]["uuid"]

                                # Look up chart by UUID in database
                                chart = (
                                    db.session.query(Slice)
                                    .filter_by(uuid=chart_uuid)
                                    .first()
                                )
                                if chart:
                                    # Chart exists, use its current ID and remove UUID
                                    child["meta"]["chartId"] = chart.id
                                    child["meta"].pop("uuid", None)
                                    chart_ids_to_add.append(chart.id)
                                else:
                                    # Chart truly doesn't exist
                                    logger.warning(
                                        "Chart with UUID %s not found, "
                                        "will skip this chart",
                                        chart_uuid,
                                    )

                # Call the appropriate import function directly
                if asset_type == "chart":
                    import_chart(config, overwrite=True, ignore_permissions=True)
                elif asset_type == "dashboard":
                    logger.info(
                        "Calling import_dashboard with dashboard_title: %s",
                        config.get("dashboard_title", "MISSING"),
                    )
                    dashboard = import_dashboard(
                        config, overwrite=True, ignore_permissions=True
                    )
                    logger.info(
                        "After import_dashboard, dashboard.dashboard_title: %s",
                        dashboard.dashboard_title,
                    )

                    # Rebuild the dashboard_slices relationship to match
                    # the restored version
                    existing_relationships = db.session.execute(
                        db.select(
                            dashboard_slices.c.dashboard_id, dashboard_slices.c.slice_id
                        ).where(dashboard_slices.c.dashboard_id == dashboard.id)
                    ).fetchall()
                    existing_chart_ids = {
                        chart_id for _, chart_id in existing_relationships
                    }

                    # Convert chart_ids_to_add to a set for easier comparison
                    chart_ids_set = set(chart_ids_to_add)

                    # Add missing chart relationships
                    new_relationships = [
                        {"dashboard_id": dashboard.id, "slice_id": chart_id}
                        for chart_id in chart_ids_to_add
                        if chart_id not in existing_chart_ids
                    ]
                    if new_relationships:
                        db.session.execute(
                            dashboard_slices.insert(), new_relationships
                        )

                    # Remove chart relationships that shouldn't be there anymore
                    charts_to_remove = existing_chart_ids - chart_ids_set
                    if charts_to_remove:
                        db.session.execute(
                            dashboard_slices.delete().where(
                                and_(
                                    dashboard_slices.c.dashboard_id == dashboard.id,
                                    dashboard_slices.c.slice_id.in_(charts_to_remove),
                                )
                            )
                        )

                elif asset_type == "dataset":
                    import_dataset(config, overwrite=True, ignore_permissions=True)

        # Commit the import changes first before restoring roles/owners
        db.session.commit()

        # Restore original roles and owners after import
        # Refresh the asset from DB to get the updated state
        db.session.expire_all()
        restored_asset = self.DAO_MAP[asset_type].find_by_id(asset_id)

        logger.info(
            "After import, asset has %d owners and %d roles",
            len(getattr(restored_asset, "owners", [])),
            len(getattr(restored_asset, "roles", [])),
        )

        # Explicitly set roles and owners back to original values
        restored_asset.roles = current_roles
        restored_asset.owners = current_owners

        logger.info(
            "Restored to %d owners and %d roles",
            len(current_owners),
            len(current_roles),
        )

        # Commit the role/owner restoration
        db.session.commit()

    @expose("/<asset_type>/<int:asset_id>/save", methods=["POST"])
    @protect()
    @safe
    def save_version(self, asset_type: str, asset_id: int) -> Response:
        """Save a new version to the database"""
        cfg = self.cfg
        if not cfg["enabled"]:
            return self.response_400(message="Version control not configured")

        description = (request.json or {}).get("description", "").strip()
        if not description:
            return self.response_400(message="Description required")

        asset = self.DAO_MAP[asset_type].find_by_id(asset_id)
        if not asset:
            return self.response_404()

        try:
            # Export asset
            yaml_bundle = self._export_asset(asset_type, asset_id)

            # Get next version number
            last_version = (
                db.session.query(VersionHistory)
                .filter(
                    VersionHistory.asset_type == self.ASSET_TYPE_ENUM[asset_type],
                    VersionHistory.asset_id == asset_id,
                )
                .order_by(desc(VersionHistory.version_number))
                .first()
            )
            version_num = (last_version.version_number + 1) if last_version else 1

            # Get current user
            username = g.user.username if hasattr(g, "user") and g.user else "Unknown"
            user_id = g.user.id if hasattr(g, "user") and g.user else None

            if not user_id:
                return self.response_400(message="User not authenticated")

            # Create version record
            version_record = VersionHistory(
                asset_type=self.ASSET_TYPE_ENUM[asset_type],
                asset_id=asset_id,
                version_number=version_num,
                version_data=json.dumps(yaml_bundle),
                description=description,
                created_on=datetime.now(timezone.utc),
                created_by_fk=user_id,
            )
            db.session.add(version_record)
            db.session.commit()

            # Cleanup old versions based on retention policy
            all_versions = (
                db.session.query(VersionHistory)
                .filter(
                    VersionHistory.asset_type == self.ASSET_TYPE_ENUM[asset_type],
                    VersionHistory.asset_id == asset_id,
                )
                .order_by(desc(VersionHistory.version_number))
                .all()
            )

            if len(all_versions) > cfg["retention"]:
                versions_to_delete = all_versions[cfg["retention"] :]
                for old_version in versions_to_delete:
                    db.session.delete(old_version)
                db.session.commit()

            return self.response(
                200,
                result={
                    "version_number": version_num,
                    "description": description,
                    "created_by": username,
                    "created_on": version_record.created_on.isoformat(),
                },
            )
        except Exception as e:
            db.session.rollback()
            logger.exception("Error saving version")
            return self.response_500(message=str(e))

    @expose("/<asset_type>/<int:asset_id>/list", methods=["GET"])
    @protect()
    @safe
    def list_versions(self, asset_type: str, asset_id: int) -> Response:
        """List all versions from the database"""
        try:
            if not self.cfg["enabled"]:
                return self.response(200, result={"count": 0, "versions": []})

            versions = (
                db.session.query(VersionHistory)
                .filter(
                    VersionHistory.asset_type == self.ASSET_TYPE_ENUM[asset_type],
                    VersionHistory.asset_id == asset_id,
                )
                .order_by(desc(VersionHistory.version_number))
                .all()
            )

            version_list = [
                {
                    "version_number": v.version_number,
                    "description": v.description or "",
                    "created_by": v.created_by_name,
                    "created_on": v.created_on.isoformat() if v.created_on else "",
                    "commit_sha": "",
                }
                for v in versions
            ]

            return self.response(
                200, result={"count": len(version_list), "versions": version_list}
            )
        except Exception as e:
            logger.exception("Error listing versions")
            return self.response_500(message=str(e))

    @expose("/<asset_type>/<int:asset_id>/restore", methods=["POST"])
    @protect()
    @safe
    def restore_version(self, asset_type: str, asset_id: int) -> Response:
        """Restore a previous version from the database"""
        if not self.cfg["enabled"]:
            return self.response_400(message="Version control not enabled")

        version_num = (request.json or {}).get("version_number")
        if not version_num:
            return self.response_400(message="version_number required")

        try:
            # Load version record
            version_record = (
                db.session.query(VersionHistory)
                .filter(
                    VersionHistory.asset_type == self.ASSET_TYPE_ENUM[asset_type],
                    VersionHistory.asset_id == asset_id,
                    VersionHistory.version_number == version_num,
                )
                .first()
            )

            if not version_record:
                return self.response_404(message=f"Version {version_num} not found")

            # Parse version data
            yaml_bundle = json.loads(version_record.version_data)

            # Import the asset
            self._import_asset(asset_type, asset_id, yaml_bundle)

            return self.response(
                200,
                result={
                    "asset_type": asset_type,
                    "asset_id": asset_id,
                    "version_number": version_num,
                    "success": True,
                },
            )
        except Exception as e:
            db.session.rollback()
            logger.exception("Error restoring version")
            return self.response_500(message=str(e))
