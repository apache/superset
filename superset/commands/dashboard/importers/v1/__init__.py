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

import logging
from typing import Any

from marshmallow import Schema
from sqlalchemy.orm import Session  # noqa: F401
from sqlalchemy.sql import delete, select

from superset import db
from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.chart.importers.v1.utils import import_chart
from superset.commands.dashboard.exceptions import DashboardImportError
from superset.commands.dashboard.importers.v1.utils import (
    find_chart_uuids,
    find_native_filter_datasets,
    import_dashboard,
    update_id_refs,
)
from superset.commands.database.importers.v1.utils import import_database
from superset.commands.dataset.importers.v1.utils import import_dataset
from superset.commands.importers.v1 import ImportModelsCommand
from superset.commands.importers.v1.utils import import_tag, load_yaml, METADATA_FILE_NAME
from superset.commands.theme.import_themes import import_theme
from superset.commands.utils import update_chart_config_dataset
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dashboard import DashboardDAO
from superset.dashboards.schemas import ImportV1DashboardSchema
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datasets.schemas import ImportV1DatasetSchema
from superset.extensions import feature_flag_manager
from superset.migrations.shared.native_filters import migrate_dashboard
from superset.models.dashboard import Dashboard, dashboard_slices
from superset.themes.schemas import ImportV1ThemeSchema

logger = logging.getLogger(__name__)


class ImportDashboardsCommand(ImportModelsCommand):
    """Import dashboards"""

    dao = DashboardDAO
    model_name = "dashboard"
    prefix = "dashboards/"
    schemas: dict[str, Schema] = {
        "charts/": ImportV1ChartSchema(),
        "dashboards/": ImportV1DashboardSchema(),
        "datasets/": ImportV1DatasetSchema(),
        "databases/": ImportV1DatabaseSchema(),
        "themes/": ImportV1ThemeSchema(),
    }
    import_error = DashboardImportError

    # TODO (betodealmeida): refactor to use code from other commands
    # pylint: disable=too-many-branches, too-many-locals, too-many-statements
    @staticmethod
    # ruff: noqa: C901
    def _import(
        configs: dict[str, Any],
        overwrite: bool = False,
        contents: dict[str, Any] | None = None,
    ) -> None:
        contents = {} if contents is None else contents

        # Extract template metadata from metadata.yaml if present
        template_metadata: dict[str, Any] = {}
        if METADATA_FILE_NAME in contents:
            metadata = load_yaml(METADATA_FILE_NAME, contents[METADATA_FILE_NAME])
            template_fields = [
                "is_template",
                "is_featured_template",
                "template_category",
                "template_thumbnail_url",
                "template_description",
                "template_tags",
                "template_context",
            ]
            template_metadata = {
                k: v for k, v in metadata.items() if k in template_fields and v
            }

        # discover charts, datasets, and themes associated with dashboards
        chart_uuids: set[str] = set()
        dataset_uuids: set[str] = set()
        theme_uuids: set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("dashboards/"):
                chart_uuids.update(find_chart_uuids(config["position"]))
                dataset_uuids.update(
                    find_native_filter_datasets(config.get("metadata", {}))
                )
                # discover theme associated with dashboard
                if config.get("theme_uuid"):
                    theme_uuids.add(config["theme_uuid"])

        # discover datasets associated with charts
        for file_name, config in configs.items():
            if file_name.startswith("charts/") and config["uuid"] in chart_uuids:
                dataset_uuids.add(config["dataset_uuid"])

        # discover databases associated with datasets
        database_uuids: set[str] = set()
        for file_name, config in configs.items():
            if file_name.startswith("datasets/") and config["uuid"] in dataset_uuids:
                database_uuids.add(config["database_uuid"])

        # import related themes
        theme_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("themes/") and config["uuid"] in theme_uuids:
                theme = import_theme(config, overwrite=False)
                if theme:
                    theme_ids[str(theme.uuid)] = theme.id

        # import related databases
        database_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if file_name.startswith("databases/") and config["uuid"] in database_uuids:
                database = import_database(config, overwrite=False)
                database_ids[str(database.uuid)] = database.id

        # import datasets with the correct parent ref
        dataset_info: dict[str, dict[str, Any]] = {}
        for file_name, config in configs.items():
            if (
                file_name.startswith("datasets/")
                and config["database_uuid"] in database_ids
            ):
                config["database_id"] = database_ids[config["database_uuid"]]
                dataset = import_dataset(config, overwrite=False)
                dataset_info[str(dataset.uuid)] = {
                    "datasource_id": dataset.id,
                    "datasource_type": dataset.datasource_type,
                    "datasource_name": dataset.table_name,
                }

        # import charts with the correct parent ref
        charts = []
        chart_ids: dict[str, int] = {}
        for file_name, config in configs.items():
            if (
                file_name.startswith("charts/")
                and config["dataset_uuid"] in dataset_info
            ):
                # update datasource id, type, and name
                dataset_dict = dataset_info[config["dataset_uuid"]]
                config = update_chart_config_dataset(config, dataset_dict)

                chart = import_chart(config, overwrite=False)
                charts.append(chart)
                chart_ids[str(chart.uuid)] = chart.id

                # Handle tags using import_tag function
                if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
                    if "tags" in config:
                        target_tag_names = config["tags"]
                        import_tag(
                            target_tag_names, contents, chart.id, "chart", db.session
                        )

        # store the existing relationship between dashboards and charts
        # (only used when overwrite=False to avoid inserting duplicates)
        existing_relationships: set[tuple[int, int]] = set()
        if not overwrite:
            existing_relationships = set(
                db.session.execute(
                    select(dashboard_slices.c.dashboard_id, dashboard_slices.c.slice_id)
                ).fetchall()
            )

        # import dashboards
        dashboards: list[Dashboard] = []
        dashboard_chart_ids: list[tuple[int, int]] = []
        for file_name, config in configs.items():
            if file_name.startswith("dashboards/"):
                config = update_id_refs(config, chart_ids, dataset_info)
                # Handle theme UUID to ID mapping
                if "theme_uuid" in config and config["theme_uuid"] in theme_ids:
                    config["theme_id"] = theme_ids[config["theme_uuid"]]
                    del config["theme_uuid"]
                elif "theme_uuid" in config:
                    # Theme not found, set to None for graceful fallback
                    config["theme_id"] = None
                    del config["theme_uuid"]
                # Merge template metadata into dashboard's metadata
                if template_metadata:
                    if "metadata" not in config:
                        config["metadata"] = {}
                    config["metadata"]["template_info"] = template_metadata
                dashboard = import_dashboard(config, overwrite=overwrite)
                dashboards.append(dashboard)

                # When overwriting, first delete all existing chart relationships
                # so the dashboard is replaced rather than merged
                if overwrite:
                    db.session.execute(
                        delete(dashboard_slices).where(
                            dashboard_slices.c.dashboard_id == dashboard.id
                        )
                    )

                # Collect chart IDs to associate with this dashboard
                for uuid in find_chart_uuids(config["position"]):
                    if uuid not in chart_ids:
                        continue
                    chart_id = chart_ids[uuid]
                    if (
                        overwrite
                        or (dashboard.id, chart_id) not in existing_relationships
                    ):
                        dashboard_chart_ids.append((dashboard.id, chart_id))

                # Handle tags using import_tag function
                if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
                    if "tags" in config:
                        target_tag_names = config["tags"]
                        import_tag(
                            target_tag_names,
                            contents,
                            dashboard.id,
                            "dashboard",
                            db.session,
                        )

        # set ref in the dashboard_slices table
        if dashboard_chart_ids:
            values = [
                {"dashboard_id": dashboard_id, "slice_id": chart_id}
                for (dashboard_id, chart_id) in dashboard_chart_ids
            ]
            db.session.execute(dashboard_slices.insert(), values)

        # Migrate any filter-box charts to native dashboard filters.
        for dashboard in dashboards:
            migrate_dashboard(dashboard)

        # Set is_template_chart and is_template_dataset flags for template dashboards.
        # These flags prevent charts/datasets from being modified/deleted via the API.
        if template_metadata.get("is_template"):
            template_chart_ids: set[int] = set()
            template_dataset_ids: set[int] = set()

            # Collect all chart IDs from template dashboards
            for file_name, config in configs.items():
                if file_name.startswith("dashboards/"):
                    for chart_uuid in find_chart_uuids(config["position"]):
                        if chart_uuid in chart_ids:
                            template_chart_ids.add(chart_ids[chart_uuid])

            # Set is_template_chart=True for all template charts
            for chart in charts:
                if chart.id in template_chart_ids:
                    chart.is_template_chart = True
                    # Collect dataset IDs from template charts
                    if chart.datasource_id:
                        template_dataset_ids.add(chart.datasource_id)

            # Set is_template_dataset=True for all datasets used by template charts
            if template_dataset_ids:
                datasets = (
                    db.session.query(SqlaTable)
                    .filter(SqlaTable.id.in_(template_dataset_ids))  # type: ignore[attr-defined]
                    .all()
                )
                for dataset in datasets:
                    dataset.is_template_dataset = True

        # Remove all obsolete filter-box charts.
        for chart in charts:
            if chart.viz_type == "filter_box":
                db.session.delete(chart)
