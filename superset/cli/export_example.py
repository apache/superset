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
"""CLI command to export a dashboard as an example.

This creates an example-ready folder structure that can be committed
to superset/examples/ and loaded via the example loading system.

Usage:
    superset export-example --dashboard-id 123 --name my_example
    superset export-example --dashboard-slug my-dashboard --name my_example
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional, TYPE_CHECKING

import click
import yaml
from flask.cli import with_appcontext

if TYPE_CHECKING:

    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)

# Canonical UUID for the examples database
EXAMPLES_DATABASE_UUID = "a2dc77af-e654-49bb-b321-40f6b559a1ee"

APACHE_LICENSE_HEADER = """# Licensed to the Apache Software Foundation (ASF) under one
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


def write_yaml_with_header(path: Path, data: dict[str, Any]) -> None:
    """Write YAML file with Apache license header."""
    with open(path, "w") as f:
        f.write(APACHE_LICENSE_HEADER)
        yaml.safe_dump(data, f, default_flow_style=False, allow_unicode=True)
    logger.info("Wrote %s", path)


def export_dataset_yaml(dataset: SqlaTable) -> dict[str, Any]:
    """Export a dataset to YAML format (without writing to disk)."""
    dataset_config: dict[str, Any] = {
        "table_name": dataset.table_name,
        "main_dttm_col": dataset.main_dttm_col,
        "description": dataset.description,
        "default_endpoint": dataset.default_endpoint,
        "offset": dataset.offset,
        "cache_timeout": dataset.cache_timeout,
        "catalog": dataset.catalog,
        "schema": dataset.schema,
        "sql": dataset.sql,
        "params": dataset.params,
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
    output_path: Path,
    sample_rows: Optional[int] = None,
) -> bool:
    """Export dataset data to Parquet. Returns True on success."""
    import pandas as pd  # pylint: disable=import-outside-toplevel

    if not dataset.database:
        logger.warning("Dataset %s has no database", dataset.table_name)
        return False

    try:
        logger.info("Exporting data for %s to Parquet...", dataset.table_name)

        # Get column names for the query
        columns = [col.column_name for col in dataset.columns if not col.expression]

        if not columns:
            logger.warning("No columns to export for %s", dataset.table_name)
            return False

        # Build simple SELECT query
        column_list = ", ".join(f'"{c}"' for c in columns)
        table_ref = dataset.table_name
        if dataset.schema:
            table_ref = f"{dataset.schema}.{dataset.table_name}"
        sql = f"SELECT {column_list} FROM {table_ref}"  # noqa: S608

        with dataset.database.get_sqla_engine() as engine:
            df = pd.read_sql(sql, engine)

        if sample_rows and len(df) > sample_rows:
            df = df.head(sample_rows)
            logger.info("Sampled to %d rows", sample_rows)

        df.to_parquet(output_path, index=False)
        logger.info("Wrote %d rows to %s", len(df), output_path)
        return True

    except Exception as e:
        logger.warning("Could not export data for %s: %s", dataset.table_name, e)
        return False


def export_chart(chart: Slice, dataset_uuid: str) -> dict[str, Any]:
    """Export a chart to YAML format."""
    params = chart.params_dict if hasattr(chart, "params_dict") else {}

    chart_config: dict[str, Any] = {
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

    return chart_config


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
                # If target has datasetId, convert to datasetUuid
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


def export_dashboard(
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

    dashboard_config: dict[str, Any] = {
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

    return dashboard_config


@click.command()
@with_appcontext
@click.option("--dashboard-id", "-d", type=int, help="Dashboard ID to export")
@click.option("--dashboard-slug", "-s", type=str, help="Dashboard slug to export")
@click.option("--name", "-n", required=True, help="Name for the example folder")
@click.option(
    "--output-dir",
    "-o",
    default="superset/examples",
    help="Output directory (default: superset/examples)",
)
@click.option(
    "--export-data/--no-export-data",
    default=True,
    help="Export data to Parquet (default: True)",
)
@click.option(
    "--sample-rows", type=int, default=None, help="Limit data export to this many rows"
)
@click.option("--force", "-f", is_flag=True, help="Overwrite existing example folder")
def export_example(  # noqa: C901
    dashboard_id: Optional[int],
    dashboard_slug: Optional[str],
    name: str,
    output_dir: str,
    export_data: bool,
    sample_rows: Optional[int],
    force: bool,
) -> None:
    """Export a dashboard as an example.

    Creates a folder structure in superset/examples/ that can be loaded
    by the example loading system:

    \b
    Single dataset:
        <name>/
        ├── data.parquet      # Raw data
        ├── dataset.yaml      # Dataset metadata
        ├── dashboard.yaml    # Dashboard definition
        └── charts/
            └── *.yaml        # Chart definitions

    \b
    Multiple datasets:
        <name>/
        ├── data/
        │   ├── table1.parquet
        │   └── table2.parquet
        ├── datasets/
        │   ├── table1.yaml
        │   └── table2.yaml
        ├── dashboard.yaml
        └── charts/
            └── *.yaml

    Examples:

    \b
        # Export by dashboard ID
        superset export-example -d 1 -n my_example

    \b
        # Export by slug, limit data to 1000 rows
        superset export-example -s my-dashboard -n my_example --sample-rows 1000

    \b
        # Export metadata only (no data)
        superset export-example -d 1 -n my_example --no-export-data
    """
    # Import Superset modules at runtime to avoid app initialization issues
    # pylint: disable=import-outside-toplevel
    from flask import g

    from superset import db, security_manager
    from superset.models.dashboard import Dashboard
    from superset.utils import json as superset_json

    g.user = security_manager.find_user(username="admin")

    # Find the dashboard
    if dashboard_id:
        dashboard = db.session.query(Dashboard).get(dashboard_id)
    elif dashboard_slug:
        dashboard = db.session.query(Dashboard).filter_by(slug=dashboard_slug).first()
    else:
        raise click.UsageError("Must specify --dashboard-id or --dashboard-slug")

    if not dashboard:
        raise click.ClickException(
            f"Dashboard not found: {dashboard_id or dashboard_slug}"
        )

    logger.info("Exporting dashboard: %s", dashboard.dashboard_title)

    # Create output directory
    example_dir = Path(output_dir) / name
    if example_dir.exists() and not force:
        raise click.ClickException(
            f"Directory already exists: {example_dir}. Use --force to overwrite."
        )

    example_dir.mkdir(parents=True, exist_ok=True)
    charts_dir = example_dir / "charts"
    charts_dir.mkdir(exist_ok=True)

    # Collect all charts and their datasets
    charts = dashboard.slices
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

    # Export datasets
    multi_dataset = len(datasets) > 1

    if multi_dataset:
        # Multiple datasets: use datasets/ and data/ folders
        datasets_dir = example_dir / "datasets"
        datasets_dir.mkdir(exist_ok=True)
        data_dir = example_dir / "data"
        data_dir.mkdir(exist_ok=True)

        for dataset in datasets.values():
            # Export YAML
            dataset_config = export_dataset_yaml(dataset)
            yaml_path = datasets_dir / f"{dataset.table_name}.yaml"
            write_yaml_with_header(yaml_path, dataset_config)

            # Export data
            if export_data:
                parquet_path = data_dir / f"{dataset.table_name}.parquet"
                export_dataset_data(dataset, parquet_path, sample_rows)
    elif len(datasets) == 1:
        # Single dataset: use dataset.yaml and data.parquet at root
        dataset = list(datasets.values())[0]
        dataset_config = export_dataset_yaml(dataset)
        write_yaml_with_header(example_dir / "dataset.yaml", dataset_config)

        if export_data:
            export_dataset_data(dataset, example_dir / "data.parquet", sample_rows)
    else:
        logger.warning("No datasets found!")

    # Export charts
    for chart in charts:
        dataset_uuid = chart_to_dataset_uuid.get(chart.id, "")
        chart_config = export_chart(chart, dataset_uuid)
        filename = sanitize_filename(chart.slice_name) + ".yaml"
        write_yaml_with_header(charts_dir / filename, chart_config)

    # Export dashboard
    dashboard_config = export_dashboard(dashboard, chart_id_to_uuid, dataset_id_to_uuid)
    write_yaml_with_header(example_dir / "dashboard.yaml", dashboard_config)

    # Summary
    click.echo(f"\n✅ Exported to: {example_dir}")
    click.echo("   - dashboard.yaml")
    if multi_dataset:
        click.echo(f"   - datasets/ ({len(datasets)} datasets)")
        if export_data:
            click.echo(f"   - data/ ({len(datasets)} parquet files)")
    else:
        click.echo("   - dataset.yaml")
        if export_data:
            click.echo("   - data.parquet")
    click.echo(f"   - charts/ ({len(charts)} charts)")

    # Native filters summary
    if dashboard.json_metadata:
        try:
            meta = superset_json.loads(dashboard.json_metadata)
            filters = meta.get("native_filter_configuration", [])
            if filters:
                click.echo(f"   - {len(filters)} native filters exported")
        except Exception:
            logger.debug("Could not parse json_metadata for filter count")

    click.echo("\nTo load this example, ensure the folder is in superset/examples/")
    click.echo("and it will be picked up by load_examples_from_configs().")
