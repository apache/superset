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
"""Command to export a dashboard as an example bundle.

This creates an example-ready structure that can be committed to
superset/examples/ and loaded via the example loading system.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from io import BytesIO
from typing import Any, Callable, TYPE_CHECKING

import yaml

from superset.commands.base import BaseCommand
from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.daos.dashboard import DashboardDAO

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

from superset.sql.parse import SQLStatement, Table

logger = logging.getLogger(__name__)

# Canonical UUID for the examples database
EXAMPLES_DATABASE_UUID = "a2dc77af-e654-49bb-b321-40f6b559a1ee"

# ASF license header for generated YAML files
YAML_LICENSE_HEADER = """\
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
"""


def sanitize_filename(name: str) -> str:
    """Convert a name to a safe filename."""
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in name)
    while "__" in safe:
        safe = safe.replace("__", "_")
    return safe.strip("_")


def get_referenced_tables(sql: str, engine: str = "base") -> set[Table]:
    """Extract table references from SQL using Superset's SQL parser.

    Args:
        sql: The SQL query to parse
        engine: The database engine/dialect (e.g., "postgresql", "mysql")

    Returns:
        Set of Table objects referenced in the SQL
    """
    try:
        statement = SQLStatement(sql, engine=engine)
        return statement.tables
    except Exception as e:
        logger.warning("Could not parse SQL to extract tables: %s", e)
        return set()


def is_virtual_dataset(dataset: SqlaTable) -> bool:
    """Check if a dataset is virtual (SQL-based) vs physical (table-based)."""
    return bool(dataset.sql)


def can_preserve_virtual_dataset(
    dataset: SqlaTable,
    physical_tables: set[str],
    engine: str = "base",
) -> bool:
    """Check if a virtual dataset can be preserved (all dependencies are in export).

    A virtual dataset can be preserved if all tables it references are
    physical tables that will be exported as Parquet files.

    Args:
        dataset: The virtual dataset to check
        physical_tables: Set of physical table names being exported
        engine: The database engine/dialect for SQL parsing

    Returns:
        True if the virtual dataset can be preserved with its SQL intact
    """
    if not dataset.sql:
        return False  # Not a virtual dataset

    referenced = get_referenced_tables(dataset.sql, engine)
    if not referenced:
        # Couldn't parse SQL or no tables found - safer to materialize
        logger.info(
            "Could not determine dependencies for %s, will materialize",
            dataset.table_name,
        )
        return False

    # Check if all referenced tables are in our physical tables set
    for table in referenced:
        # Match by table name (ignore schema since we normalize to default schema)
        if table.table not in physical_tables:
            logger.info(
                "Virtual dataset %s references external table %s, will materialize",
                dataset.table_name,
                table.table,
            )
            return False

    logger.info(
        "Virtual dataset %s can be preserved (references: %s)",
        dataset.table_name,
        ", ".join(t.table for t in referenced),
    )
    return True


def export_dataset_yaml(
    dataset: SqlaTable,
    data_file: str | None = None,
    preserve_virtual: bool = False,
) -> dict[str, Any]:
    """Export a dataset to YAML format.

    Args:
        dataset: The dataset to export
        data_file: Optional explicit parquet filename (for physical datasets)
        preserve_virtual: If True and dataset is virtual, preserve the SQL query
                         instead of converting to physical with data_file
    """
    # Determine if this is a preserved virtual dataset
    is_preserved_virtual = preserve_virtual and dataset.sql

    dataset_config: dict[str, Any] = {
        "table_name": dataset.table_name,
        # Virtual datasets don't have data files - they query other tables
        "data_file": None if is_preserved_virtual else data_file,
        "main_dttm_col": dataset.main_dttm_col,
        "description": dataset.description,
        "default_endpoint": dataset.default_endpoint,
        "offset": dataset.offset,
        "cache_timeout": dataset.cache_timeout,
        "catalog": dataset.catalog,
        "schema": None,  # Don't export - use target database's default schema
        # Preserve SQL for virtual datasets, None for physical (data is in parquet)
        "sql": dataset.sql if is_preserved_virtual else None,
        "params": None,  # Don't export - contains stale import metadata
        "template_params": dataset.template_params,
        "filter_select_enabled": dataset.filter_select_enabled,
        "fetch_values_predicate": dataset.fetch_values_predicate,
        "extra": dataset.extra,
        "normalize_columns": dataset.normalize_columns,
        "always_filter_main_dttm": dataset.always_filter_main_dttm,
        "folders": None,
        "uuid": str(dataset.uuid),
        "metrics": [],
        "columns": [],
        "version": "1.0.0",
        "database_uuid": EXAMPLES_DATABASE_UUID,
    }

    for metric in dataset.metrics:
        dataset_config["metrics"].append(
            {
                "metric_name": metric.metric_name,
                "verbose_name": metric.verbose_name,
                "metric_type": metric.metric_type,
                "expression": metric.expression,
                "description": metric.description,
                "d3format": metric.d3format,
                "currency": metric.currency,
                "extra": metric.extra,
                "warning_text": metric.warning_text,
            }
        )

    for column in dataset.columns:
        dataset_config["columns"].append(
            {
                "column_name": column.column_name,
                "verbose_name": column.verbose_name,
                "is_dttm": column.is_dttm,
                "is_active": column.is_active,
                "type": column.type,
                "advanced_data_type": column.advanced_data_type,
                "groupby": column.groupby,
                "filterable": column.filterable,
                "expression": column.expression,
                "description": column.description,
                "python_date_format": column.python_date_format,
                "extra": column.extra,
            }
        )

    return dataset_config


def export_dataset_data(
    dataset: SqlaTable,
    sample_rows: int | None = None,
) -> bytes | None:
    """Export dataset data to Parquet format. Returns bytes or None on failure."""
    import pandas as pd  # pylint: disable=import-outside-toplevel

    from superset import db  # pylint: disable=import-outside-toplevel

    # Ensure dataset is attached to session and relationships are loaded
    if dataset not in db.session:
        dataset = db.session.merge(dataset)

    # Force load the database and columns relationships by accessing them
    _ = dataset.database
    _ = dataset.columns

    if not dataset.database:
        logger.warning("Dataset %s has no database", dataset.table_name)
        return None

    try:
        logger.info("Exporting data for %s to Parquet...", dataset.table_name)

        # Check if this is a virtual dataset (SQL-based)
        if dataset.sql:
            sql = dataset.sql
        else:
            # For physical tables, build SELECT query from columns
            columns = [col.column_name for col in dataset.columns if not col.expression]

            if not columns:
                logger.warning("No columns to export for %s", dataset.table_name)
                return None

            # Build simple SELECT query (quote identifiers to handle spaces/keywords)
            column_list = ", ".join(f'"{c}"' for c in columns)
            quoted_table = f'"{dataset.table_name}"'
            if dataset.schema:
                table_ref = f'"{dataset.schema}".{quoted_table}'
            else:
                table_ref = quoted_table
            sql = f"SELECT {column_list} FROM {table_ref}"  # noqa: S608

        with dataset.database.get_sqla_engine() as engine:
            df = pd.read_sql(sql, engine)

        if sample_rows and len(df) > sample_rows:
            df = df.head(sample_rows)
            logger.info("Sampled to %d rows", sample_rows)

        # Write to bytes buffer
        buf = BytesIO()
        df.to_parquet(buf, index=False)
        buf.seek(0)
        logger.info("Exported %d rows for %s", len(df), dataset.table_name)
        return buf.getvalue()

    except Exception as e:
        logger.exception("Could not export data for %s: %s", dataset.table_name, e)
        return None


def export_chart(chart: Slice, dataset_uuid: str) -> dict[str, Any]:
    """Export a chart to YAML format."""
    params = chart.params_dict if hasattr(chart, "params_dict") else {}

    return {
        "slice_name": chart.slice_name,
        "description": chart.description,
        "certified_by": chart.certified_by,
        "certification_details": chart.certification_details,
        "viz_type": chart.viz_type,
        "params": params,
        "query_context": None,  # Don't include - contains stale IDs
        "cache_timeout": chart.cache_timeout,
        "uuid": str(chart.uuid),
        "version": "1.0.0",
        "dataset_uuid": dataset_uuid,
    }


def remap_native_filters(
    filters: list[dict[str, Any]],
    chart_id_to_uuid: dict[int, str],
    dataset_id_to_uuid: dict[int, str],
) -> list[dict[str, Any]]:
    """Remap IDs to UUIDs in native filter configuration."""
    remapped = []
    for f in filters:
        new_filter = f.copy()

        # Remap chartsInScope from IDs to UUIDs
        if "chartsInScope" in new_filter:
            new_filter["chartsInScope"] = [
                chart_id_to_uuid.get(cid, cid) for cid in new_filter["chartsInScope"]
            ]

        # Remap targets to use datasetUuid
        if "targets" in new_filter:
            new_targets = []
            for target in new_filter["targets"]:
                new_target = target.copy()
                if "datasetId" in new_target:
                    dataset_id = new_target.pop("datasetId")
                    if dataset_id in dataset_id_to_uuid:
                        new_target["datasetUuid"] = dataset_id_to_uuid[dataset_id]
                new_targets.append(new_target)
            new_filter["targets"] = new_targets

        remapped.append(new_filter)
    return remapped


def remap_chart_configuration(
    chart_config: dict[str, Any],
    chart_id_to_uuid: dict[int, str],
) -> dict[str, Any]:
    """Remap chart IDs to UUIDs in chart_configuration (cross-filters)."""
    remapped: dict[str, Any] = {}
    for chart_id_str, config in chart_config.items():
        chart_id = int(chart_id_str)
        if chart_id not in chart_id_to_uuid:
            continue

        new_config = config.copy()
        chart_uuid = chart_id_to_uuid[chart_id]

        # Update the id field
        new_config["id"] = chart_uuid

        # Remap chartsInScope
        cross_filters = new_config.get("crossFilters", {})
        if "chartsInScope" in cross_filters:
            new_config["crossFilters"] = new_config["crossFilters"].copy()
            new_config["crossFilters"]["chartsInScope"] = [
                chart_id_to_uuid.get(cid, cid)
                for cid in new_config["crossFilters"]["chartsInScope"]
            ]

        remapped[chart_uuid] = new_config

    return remapped


def remap_global_chart_configuration(
    global_config: dict[str, Any],
    chart_id_to_uuid: dict[int, str],
) -> dict[str, Any]:
    """Remap chart IDs in global_chart_configuration."""
    new_config = global_config.copy()
    if "chartsInScope" in new_config:
        new_config["chartsInScope"] = [
            chart_id_to_uuid.get(cid, cid) for cid in new_config["chartsInScope"]
        ]
    return new_config


def export_dashboard_yaml(
    dashboard: Dashboard,
    chart_id_to_uuid: dict[int, str],
    dataset_id_to_uuid: dict[int, str],
) -> dict[str, Any]:
    """Export dashboard to YAML format with proper ID remapping."""
    from superset.utils import (
        json as superset_json,  # pylint: disable=import-outside-toplevel
    )

    position = dashboard.position or {}

    # Update position to use UUIDs
    updated_position = {}
    for key, value in position.items():
        if isinstance(value, dict):
            updated_value = value.copy()
            if "meta" in updated_value and "chartId" in updated_value.get("meta", {}):
                chart_id = updated_value["meta"]["chartId"]
                if chart_id in chart_id_to_uuid:
                    updated_value["meta"]["uuid"] = chart_id_to_uuid[chart_id]
            updated_position[key] = updated_value
        else:
            updated_position[key] = value

    # Parse json_metadata
    json_metadata = {}
    if dashboard.json_metadata:
        try:
            json_metadata = superset_json.loads(dashboard.json_metadata)
        except Exception:
            logger.debug("Could not parse json_metadata")

    # Remap native filters
    native_filters = json_metadata.get("native_filter_configuration", [])
    remapped_filters = remap_native_filters(
        native_filters, chart_id_to_uuid, dataset_id_to_uuid
    )

    # Remap chart_configuration (cross-filters)
    chart_configuration = json_metadata.get("chart_configuration", {})
    remapped_chart_config = remap_chart_configuration(
        chart_configuration, chart_id_to_uuid
    )

    # Remap global_chart_configuration
    global_chart_config = json_metadata.get("global_chart_configuration", {})
    remapped_global_config = remap_global_chart_configuration(
        global_chart_config, chart_id_to_uuid
    )

    # Build metadata section
    metadata: dict[str, Any] = {
        "timed_refresh_immune_slices": json_metadata.get(
            "timed_refresh_immune_slices", []
        ),
        "expanded_slices": json_metadata.get("expanded_slices", {}),
        "refresh_frequency": json_metadata.get("refresh_frequency", 0),
        "default_filters": json_metadata.get("default_filters", "{}"),
        "color_scheme": json_metadata.get("color_scheme", ""),
        "label_colors": json_metadata.get("label_colors", {}),
        "native_filter_configuration": remapped_filters,
        "shared_label_colors": json_metadata.get("shared_label_colors", []),
        "map_label_colors": json_metadata.get("map_label_colors", {}),
        "color_scheme_domain": json_metadata.get("color_scheme_domain", []),
        "cross_filters_enabled": json_metadata.get("cross_filters_enabled", False),
        "chart_configuration": remapped_chart_config,
        "global_chart_configuration": remapped_global_config,
    }

    return {
        "dashboard_title": dashboard.dashboard_title,
        "description": dashboard.description,
        "css": dashboard.css,
        "slug": dashboard.slug,
        "certified_by": dashboard.certified_by,
        "certification_details": dashboard.certification_details,
        "published": dashboard.published,
        "uuid": str(dashboard.uuid),
        "position": updated_position,
        "metadata": metadata,
        "version": "1.0.0",
    }


def _make_yaml_generator(config: dict[str, Any]) -> Callable[[], bytes]:
    """Create a generator function for YAML content with ASF license header."""
    yaml_content = yaml.safe_dump(config, default_flow_style=False, allow_unicode=True)
    return lambda: (YAML_LICENSE_HEADER + yaml_content).encode("utf-8")


def _make_bytes_generator(data: bytes) -> Callable[[], bytes]:
    """Create a generator function for raw bytes content."""
    return lambda: data


class ExportExampleCommand(BaseCommand):
    """Export dashboard as an example bundle with Parquet data and YAML configs.

    Output structure for single dataset:
        data.parquet      - Raw data
        dataset.yaml      - Dataset metadata
        dashboard.yaml    - Dashboard definition
        charts/*.yaml     - Chart definitions

    Output structure for multiple datasets:
        data/*.parquet    - Raw data files
        datasets/*.yaml   - Dataset metadata files
        dashboard.yaml    - Dashboard definition
        charts/*.yaml     - Chart definitions
    """

    def __init__(
        self,
        dashboard_id: int,
        export_data: bool = True,
        sample_rows: int | None = None,
    ):
        self._dashboard_id = dashboard_id
        self._export_data = export_data
        self._sample_rows = sample_rows
        self._dashboard: Dashboard | None = None

    def validate(self) -> None:
        self._dashboard = DashboardDAO.find_by_id(self._dashboard_id)
        if not self._dashboard:
            raise DashboardNotFoundError()

    def run(self) -> Iterator[tuple[str, Callable[[], bytes]]]:  # noqa: C901
        """Yield (filename, content_generator) tuples for ZIP packaging.

        Content generators return bytes (either YAML encoded or raw Parquet).
        """
        self.validate()
        assert self._dashboard is not None

        # Collect all charts and their datasets
        charts = self._dashboard.slices
        datasets: dict[int, SqlaTable] = {}
        chart_id_to_uuid: dict[int, str] = {}
        chart_to_dataset_uuid: dict[int, str] = {}

        for chart in charts:
            chart_id_to_uuid[chart.id] = str(chart.uuid)
            if chart.datasource:
                datasets[chart.datasource.id] = chart.datasource
                chart_to_dataset_uuid[chart.id] = str(chart.datasource.uuid)

        # Build dataset ID to UUID mapping
        dataset_id_to_uuid: dict[int, str] = {
            ds_id: str(ds.uuid) for ds_id, ds in datasets.items()
        }

        logger.info("Found %d charts and %d datasets", len(charts), len(datasets))

        # Classify datasets: physical vs virtual
        # Physical datasets need Parquet export; virtual datasets with all
        # dependencies in the export can preserve their SQL
        physical_datasets: dict[int, SqlaTable] = {}
        virtual_datasets: dict[int, SqlaTable] = {}

        for ds_id, dataset in datasets.items():
            if is_virtual_dataset(dataset):
                virtual_datasets[ds_id] = dataset
            else:
                physical_datasets[ds_id] = dataset

        # Get the set of physical table names for dependency checking
        physical_table_names = {ds.table_name for ds in physical_datasets.values()}

        # Determine which virtual datasets can be preserved vs need materialization
        # A virtual dataset can be preserved if all its referenced tables are
        # physical datasets in this export
        preserved_virtual: dict[int, SqlaTable] = {}
        materialized_virtual: dict[int, SqlaTable] = {}

        # Get database engine for SQL parsing (use first dataset's database)
        db_engine = "base"
        if datasets:
            first_dataset = next(iter(datasets.values()))
            if first_dataset.database:
                db_engine = first_dataset.database.backend or "base"

        for ds_id, dataset in virtual_datasets.items():
            if can_preserve_virtual_dataset(dataset, physical_table_names, db_engine):
                preserved_virtual[ds_id] = dataset
            else:
                materialized_virtual[ds_id] = dataset

        # Log classification summary
        logger.info(
            "Dataset classification: %d physical, %d virtual preserved, "
            "%d virtual materialized",
            len(physical_datasets),
            len(preserved_virtual),
            len(materialized_virtual),
        )

        # Datasets that need Parquet export = physical + materialized virtual
        datasets_needing_data = {**physical_datasets, **materialized_virtual}

        # Build unique filenames for datasets (handle table_name collisions)
        dataset_filenames: dict[int, str] = {}
        seen_table_names: dict[str, int] = {}  # table_name -> first dataset_id

        for ds_id, dataset in datasets.items():
            table_name = dataset.table_name
            if table_name in seen_table_names:
                # Collision! Use UUID suffix for uniqueness
                uuid_suffix = str(dataset.uuid)[:8]
                filename = f"{table_name}-{uuid_suffix}"
                logger.info(
                    "Table name collision for '%s', using '%s'", table_name, filename
                )
            else:
                filename = table_name
                seen_table_names[table_name] = ds_id
            dataset_filenames[ds_id] = filename

        # Export datasets
        multi_dataset = len(datasets) > 1

        if multi_dataset:
            # Multiple datasets: use datasets/ and data/ folders
            for ds_id, dataset in datasets.items():
                filename = dataset_filenames[ds_id]
                needs_data = ds_id in datasets_needing_data
                is_preserved = ds_id in preserved_virtual
                data_file = f"{filename}.parquet" if needs_data else None

                # Export YAML
                dataset_config = export_dataset_yaml(
                    dataset,
                    data_file=data_file,
                    preserve_virtual=is_preserved,
                )
                yield (
                    f"datasets/{filename}.yaml",
                    _make_yaml_generator(dataset_config),
                )

                # Export data only for datasets that need it
                if self._export_data and needs_data:
                    data = export_dataset_data(dataset, self._sample_rows)
                    if data:
                        yield (
                            f"data/{data_file}",
                            _make_bytes_generator(data),
                        )

        elif len(datasets) == 1:
            # Single dataset: use dataset.yaml and data.parquet at root
            ds_id = next(iter(datasets.keys()))
            dataset = datasets[ds_id]
            needs_data = ds_id in datasets_needing_data
            is_preserved = ds_id in preserved_virtual
            data_file = "data.parquet" if needs_data else None

            dataset_config = export_dataset_yaml(
                dataset,
                data_file=data_file,
                preserve_virtual=is_preserved,
            )
            yield ("dataset.yaml", _make_yaml_generator(dataset_config))

            if self._export_data and needs_data:
                data = export_dataset_data(dataset, self._sample_rows)
                if data:
                    yield ("data.parquet", _make_bytes_generator(data))

        # Export charts
        for chart in charts:
            dataset_uuid = chart_to_dataset_uuid.get(chart.id, "")
            chart_config = export_chart(chart, dataset_uuid)
            filename = sanitize_filename(chart.slice_name) + ".yaml"
            yield (f"charts/{filename}", _make_yaml_generator(chart_config))

        # Export dashboard
        dashboard_config = export_dashboard_yaml(
            self._dashboard, chart_id_to_uuid, dataset_id_to_uuid
        )
        yield ("dashboard.yaml", _make_yaml_generator(dashboard_config))
