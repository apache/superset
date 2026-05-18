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
from sqlalchemy.sql import select

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
from superset.commands.importers.v1.utils import import_tag
from superset.commands.theme.import_themes import import_theme
from superset.commands.utils import update_chart_config_dataset
from superset.daos.dashboard import DashboardDAO
from superset.dashboards.schemas import ImportV1DashboardSchema
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datasets.schemas import ImportV1DatasetSchema
from superset.extensions import feature_flag_manager
from superset.migrations.shared.native_filters import migrate_dashboard
from superset.models.dashboard import Dashboard, dashboard_slices
from superset.models.slice import Slice
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
        #
        # Dashboard → charts associations go through the ORM relationship
        # (``dashboard.slices = [...]``) rather than Core
        # ``delete()``/``insert()`` on the ``dashboard_slices`` table.
        # Bulk DML via Core would emit a malformed INSERT into
        # ``dashboard_slices_version`` (missing the composite-PK columns)
        # because SQLAlchemy-Continuum's M2M tracker can't see per-row
        # column values when the DELETE/INSERT goes through the Core
        # layer. The same pattern is applied in
        # ``superset/commands/importers/v1/assets.py`` and the spike's
        # ``DatasetDAO.update_columns`` rewrite.
        dashboards: list[Dashboard] = []
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
                dashboard = import_dashboard(config, overwrite=overwrite)
                dashboards.append(dashboard)

                # Resolve the dashboard's chart membership from the imported
                # position_json and apply it to the ORM relationship.
                target_chart_ids: list[int] = []
                for uuid in find_chart_uuids(config["position"]):
                    if uuid not in chart_ids:
                        continue
                    chart_id = chart_ids[uuid]
                    if (
                        overwrite
                        or (dashboard.id, chart_id) not in existing_relationships
                    ):
                        target_chart_ids.append(chart_id)

                if overwrite:
                    # Replace the dashboard's chart membership entirely.
                    dashboard.slices = (
                        db.session.query(Slice)
                        .filter(Slice.id.in_(target_chart_ids))
                        .all()
                        if target_chart_ids
                        else []
                    )
                    # Flush eagerly so the M2M rows land in
                    # ``dashboard_slices`` before any subsequent
                    # autoflush fires an inner-flush event handler
                    # that would reset the relationship change.
                    db.session.flush()
                elif target_chart_ids:
                    # Append only the new associations to existing ones.
                    new_slices = (
                        db.session.query(Slice)
                        .filter(Slice.id.in_(target_chart_ids))
                        .all()
                    )
                    dashboard.slices = list(dashboard.slices) + new_slices
                    db.session.flush()

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

        # Migrate any filter-box charts to native dashboard filters.
        for dashboard in dashboards:
            migrate_dashboard(dashboard)

        # Remove all obsolete filter-box charts.
        for chart in charts:
            if chart.viz_type == "filter_box":
                db.session.delete(chart)
