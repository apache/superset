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
from typing import Optional

import click
from flask.cli import with_appcontext

logger = logging.getLogger(__name__)

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


def write_file_with_header(path: Path, content: bytes) -> None:
    """Write file, adding Apache license header for YAML files."""
    path.parent.mkdir(parents=True, exist_ok=True)

    if path.suffix == ".yaml":
        # Add license header to YAML files
        with open(path, "wb") as f:
            f.write(APACHE_LICENSE_HEADER.encode("utf-8"))
            f.write(content)
    else:
        # Binary files (like Parquet) written as-is
        with open(path, "wb") as f:
            f.write(content)

    logger.info("Wrote %s", path)


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
    # Import at runtime to avoid app initialization issues during CLI loading
    # pylint: disable=import-outside-toplevel
    from flask import g

    from superset import db, security_manager
    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.commands.dashboard.export_example import ExportExampleCommand
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

    # Run the export command
    command = ExportExampleCommand(
        dashboard_id=dashboard.id,
        export_data=export_data,
        sample_rows=sample_rows,
    )

    try:
        file_count = {"charts": 0, "datasets": 0, "data": 0}

        for filename, content_fn in command.run():
            file_path = example_dir / filename
            content = content_fn()
            write_file_with_header(file_path, content)

            # Track file counts for summary
            if filename.startswith("charts/"):
                file_count["charts"] += 1
            elif filename.startswith("datasets/") or filename == "dataset.yaml":
                file_count["datasets"] += 1
            elif filename.startswith("data/") or filename == "data.parquet":
                file_count["data"] += 1

    except DashboardNotFoundError as err:
        raise click.ClickException(
            f"Dashboard not found: {dashboard_id or dashboard_slug}"
        ) from err

    # Summary
    click.echo(f"\n✅ Exported to: {example_dir}")
    click.echo("   - dashboard.yaml")

    if file_count["datasets"] > 1:
        click.echo(f"   - datasets/ ({file_count['datasets']} datasets)")
        if export_data and file_count["data"]:
            click.echo(f"   - data/ ({file_count['data']} parquet files)")
    else:
        click.echo("   - dataset.yaml")
        if export_data and file_count["data"]:
            click.echo("   - data.parquet")

    click.echo(f"   - charts/ ({file_count['charts']} charts)")

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
