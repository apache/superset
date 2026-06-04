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
from functools import partial
from typing import Any, Optional

from marshmallow import Schema
from marshmallow.exceptions import ValidationError
from sqlalchemy.sql import delete, insert

from superset import db
from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.base import BaseCommand
from superset.commands.chart.importers.v1.utils import import_chart
from superset.commands.dashboard.importers.v1.utils import (
    find_chart_uuids,
    import_dashboard,
    update_id_refs,
)
from superset.commands.database.importers.v1.utils import import_database
from superset.commands.dataset.importers.v1.utils import import_dataset
from superset.commands.exceptions import CommandInvalidError, ImportFailedError
from superset.commands.importers.v1.utils import (
    get_resource_mappings_batched,
    import_tag,
    load_configs,
    load_metadata,
    validate_metadata_type,
)
from superset.commands.query.importers.v1.utils import import_saved_query
from superset.commands.utils import update_chart_config_dataset
from superset.connectors.sqla.models import SqlaTable
from superset.dashboards.schemas import ImportV1DashboardSchema
from superset.databases.schemas import ImportV1DatabaseSchema
from superset.datasets.schemas import ImportV1DatasetSchema
from superset.extensions import feature_flag_manager
from superset.migrations.shared.native_filters import migrate_dashboard
from superset.models.core import Database
from superset.models.dashboard import Dashboard, dashboard_slices
from superset.models.slice import Slice
from superset.models.sql_lab import SavedQuery
from superset.queries.saved_queries.schemas import ImportV1SavedQuerySchema
from superset.utils.decorators import on_error, transaction


class ImportAssetsCommand(BaseCommand):
    """
    Command for importing databases, datasets, charts, dashboards and saved queries.

    This command is used for managing Superset assets externally under source control,
    and will overwrite everything.
    """

    schemas: dict[str, Schema] = {
        "charts/": ImportV1ChartSchema(),
        "dashboards/": ImportV1DashboardSchema(),
        "datasets/": ImportV1DatasetSchema(),
        "databases/": ImportV1DatabaseSchema(),
        "queries/": ImportV1SavedQuerySchema(),
    }

    # pylint: disable=unused-argument
    def __init__(self, contents: dict[str, str], *args: Any, **kwargs: Any):
        self.contents = contents
        self.passwords: dict[str, str] = kwargs.get("passwords") or {}
        self.ssh_tunnel_passwords: dict[str, str] = (
            kwargs.get("ssh_tunnel_passwords") or {}
        )
        self.ssh_tunnel_private_keys: dict[str, str] = (
            kwargs.get("ssh_tunnel_private_keys") or {}
        )
        self.ssh_tunnel_priv_key_passwords: dict[str, str] = (
            kwargs.get("ssh_tunnel_priv_key_passwords") or {}
        )
        self.encrypted_extra_secrets: dict[str, dict[str, str]] = (
            kwargs.get("encrypted_extra_secrets") or {}
        )
        self._configs: dict[str, Any] = {}
        self.sparse = kwargs.get("sparse", False)
        # Defaults to ``True`` for backwards compatibility: historically this
        # command always overwrote existing assets.
        self.overwrite: bool = kwargs.get("overwrite", True)

    # pylint: disable=too-many-locals
    @staticmethod
    def _import(  # noqa: C901
        configs: dict[str, Any],
        sparse: bool = False,
        contents: Optional[dict[str, Any]] = None,
        overwrite: bool = True,
    ) -> None:
        contents = {} if contents is None else contents
        # import databases first
        database_ids: dict[str, int] = {}
        dataset_info: dict[str, dict[str, Any]] = {}
        chart_ids: dict[str, int] = {}
        if sparse:
            chart_ids = get_resource_mappings_batched(Slice)
            database_ids = get_resource_mappings_batched(Database)
            dataset_info = get_resource_mappings_batched(
                SqlaTable,
                value_func=lambda x: {
                    "datasource_id": x.id,
                    "datasource_type": x.datasource_type,
                    "datasource_name": x.datasource_name,
                },
            )

        for file_name, config in configs.items():
            if file_name.startswith("databases/"):
                database = import_database(config, overwrite=overwrite)
                database_ids[str(database.uuid)] = database.id

        # import saved queries
        for file_name, config in configs.items():
            if file_name.startswith("queries/"):
                config["db_id"] = database_ids[config["database_uuid"]]
                import_saved_query(config, overwrite=overwrite)

        # import datasets
        for file_name, config in configs.items():
            if file_name.startswith("datasets/"):
                config["database_id"] = database_ids[config["database_uuid"]]
                dataset = import_dataset(config, overwrite=overwrite)
                dataset_info[str(dataset.uuid)] = {
                    "datasource_id": dataset.id,
                    "datasource_type": dataset.datasource_type,
                    "datasource_name": dataset.table_name,
                }

        # import charts
        charts = []
        for file_name, config in configs.items():
            if file_name.startswith("charts/"):
                dataset_dict = dataset_info[config["dataset_uuid"]]
                config = update_chart_config_dataset(config, dataset_dict)
                chart = import_chart(config, overwrite=overwrite)
                charts.append(chart)
                chart_ids[str(chart.uuid)] = chart.id

                # Handle tags using import_tag function
                if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
                    if "tags" in config:
                        import_tag(
                            config["tags"], contents, chart.id, "chart", db.session
                        )

        # import dashboards
        for file_name, config in configs.items():
            if file_name.startswith("dashboards/"):
                config = update_id_refs(config, chart_ids, dataset_info)
                dashboard = import_dashboard(config, overwrite=overwrite)

                # set ref in the dashboard_slices table
                dashboard_chart_ids: list[dict[str, int]] = []
                for uuid in find_chart_uuids(config["position"]):
                    if uuid not in chart_ids:
                        break
                    chart_id = chart_ids[uuid]
                    dashboard_chart_id = {
                        "dashboard_id": dashboard.id,
                        "slice_id": chart_id,
                    }
                    dashboard_chart_ids.append(dashboard_chart_id)

                db.session.execute(
                    delete(dashboard_slices).where(
                        dashboard_slices.c.dashboard_id == dashboard.id
                    )
                )
                db.session.execute(insert(dashboard_slices).values(dashboard_chart_ids))

                # Handle tags using import_tag function
                if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
                    if "tags" in config:
                        import_tag(
                            config["tags"],
                            contents,
                            dashboard.id,
                            "dashboard",
                            db.session,
                        )

                # Migrate any filter-box charts to native dashboard filters.
                migrate_dashboard(dashboard)

        # Remove all obsolete filter-box charts.
        for chart in charts:
            if chart.viz_type == "filter_box":
                db.session.delete(chart)

    @transaction(
        on_error=partial(
            on_error,
            catches=(Exception,),
            reraise=ImportFailedError,
        )
    )
    def run(self) -> None:
        self.validate()
        self._import(self._configs, self.sparse, self.contents, self.overwrite)

    # Maps asset file prefixes to the model class used to look up UUIDs for
    # the "already exists" validation check when ``overwrite`` is ``False``.
    _MODEL_BY_PREFIX: dict[str, Any] = {
        "databases/": Database,
        "datasets/": SqlaTable,
        "charts/": Slice,
        "dashboards/": Dashboard,
        "queries/": SavedQuery,
    }

    def _bundle_entries_by_prefix(self) -> dict[str, list[tuple[str, str]]]:
        """Group ``(file_name, uuid)`` pairs from the bundle by asset prefix."""
        bundle_by_prefix: dict[str, list[tuple[str, str]]] = {
            prefix: [] for prefix in self._MODEL_BY_PREFIX
        }
        for file_name, config in self._configs.items():
            uuid = config.get("uuid")
            if not uuid:
                continue
            for prefix in bundle_by_prefix:
                if file_name.startswith(prefix):
                    bundle_by_prefix[prefix].append((file_name, str(uuid)))
                    break
        return bundle_by_prefix

    def _prevent_overwrite_existing_assets(
        self, exceptions: list[ValidationError]
    ) -> None:
        """
        When ``overwrite`` is ``False``, raise a clear validation error for any
        asset in the bundle whose UUID already exists in the database.

        Only the UUIDs present in the import bundle are queried (per prefix),
        so the cost scales with the bundle size rather than with the total
        number of stored assets.
        """
        if self.overwrite:
            return

        for prefix, entries in self._bundle_entries_by_prefix().items():
            if not entries:
                continue
            model_cls = self._MODEL_BY_PREFIX[prefix]
            incoming_uuids = [uuid for _, uuid in entries]
            existing_uuids = {
                str(uuid)
                for (uuid,) in db.session.query(model_cls.uuid)
                .filter(model_cls.uuid.in_(incoming_uuids))
                .all()
            }
            if not existing_uuids:
                continue
            model_name = model_cls.__name__
            for file_name, uuid in entries:
                if uuid in existing_uuids:
                    exceptions.append(
                        ValidationError(
                            {
                                file_name: (
                                    f"{model_name} already exists "
                                    "and `overwrite=true` was not passed"
                                ),
                            }
                        )
                    )

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        # verify that the metadata file is present and valid
        try:
            metadata: Optional[dict[str, str]] = load_metadata(self.contents)
        except ValidationError as exc:
            exceptions.append(exc)
            metadata = None
        validate_metadata_type(metadata, "assets", exceptions)

        self._configs = load_configs(
            self.contents,
            self.schemas,
            self.passwords,
            exceptions,
            self.ssh_tunnel_passwords,
            self.ssh_tunnel_private_keys,
            self.ssh_tunnel_priv_key_passwords,
            self.encrypted_extra_secrets,
        )
        self._prevent_overwrite_existing_assets(exceptions)

        if exceptions:
            raise CommandInvalidError(
                "Error importing assets",
                exceptions,
            )
