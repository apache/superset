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
import logging

import click
from flask.cli import with_appcontext

import superset.utils.database as database_utils
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


def load_examples_run(
    load_test_data: bool = False,
    load_big_data: bool = False,
    only_metadata: bool = False,
    force: bool = False,
    cleanup: bool = False,
) -> None:
    if only_metadata:
        logger.info("Loading examples metadata")
    else:
        examples_db = database_utils.get_example_database()
        logger.info(f"Loading examples metadata and related data into {examples_db}")

    # pylint: disable=import-outside-toplevel
    import superset.examples.data_loading as examples

    # Clear old examples if requested
    if cleanup:
        clear_old_examples()

    examples.load_css_templates()

    if load_test_data:
        # Import test fixtures from tests directory
        from tests.fixtures.examples.energy import load_energy
        from tests.fixtures.examples.supported_charts_dashboard import (
            load_supported_charts_dashboard,
        )
        from tests.fixtures.examples.tabbed_dashboard import load_tabbed_dashboard

        logger.info("Loading energy related dataset")
        load_energy(only_metadata, force)

        logger.info("Loading [Tabbed dashboard]")
        load_tabbed_dashboard(only_metadata)

        logger.info("Loading [Supported Charts Dashboard]")
        load_supported_charts_dashboard()
    else:
        logger.info("Loading [Country Map data]")
        examples.load_country_map_data(only_metadata, force)

    if load_big_data:
        # Import test fixture from tests directory
        from tests.fixtures.examples.big_data import load_big_data as load_big_data_func

        logger.info("Loading big synthetic data for tests")
        load_big_data_func()

    # load examples that are stored as YAML config files
    logger.info("Loading examples from YAML configuration files")
    examples.load_examples_from_configs(force, load_test_data)


@click.command()
@with_appcontext
@transaction()
@click.option("--load-test-data", "-t", is_flag=True, help="Load additional test data")
@click.option("--load-big-data", "-b", is_flag=True, help="Load additional big data")
@click.option(
    "--only-metadata",
    "-m",
    is_flag=True,
    help="Only load metadata, skip actual data",
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="Force load data even if table already exists",
)
def load_examples(
    load_test_data: bool = False,
    load_big_data: bool = False,
    only_metadata: bool = False,
    force: bool = False,
) -> None:
    """Loads a set of Slices and Dashboards and a supporting dataset"""
    # Show deprecation warning
    click.echo(
        click.style(
            "\nWARNING: 'superset load-examples' is deprecated. "
            "Please use 'superset examples load' instead.\n",
            fg="yellow",
        ),
        err=True,
    )

    load_examples_run(load_test_data, load_big_data, only_metadata, force)


# New CLI structure
@click.group(name="examples", help="Manage example data")
def examples_cli() -> None:
    """Group for example-related commands."""
    pass


@examples_cli.command(name="load", help="Load example data into the database")
@with_appcontext
@transaction()
@click.option("--load-test-data", "-t", is_flag=True, help="Load additional test data")
@click.option("--load-big-data", "-b", is_flag=True, help="Load additional big data")
@click.option(
    "--only-metadata",
    "-m",
    is_flag=True,
    help="Only load metadata, skip actual data",
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="Force load data even if table already exists",
)
def load(
    load_test_data: bool = False,
    load_big_data: bool = False,
    only_metadata: bool = False,
    force: bool = False,
) -> None:
    """Load example datasets, charts, and dashboards."""
    load_examples_run(
        load_test_data, load_big_data, only_metadata, force, cleanup=False
    )


def clear_old_examples() -> bool:
    """
    Clear old Python-generated examples.
    Returns True if clear was performed, False otherwise.
    """
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.examples.utils import _has_old_examples
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard, dashboard_slices
    from superset.models.slice import Slice

    # Check if old examples exist
    if not _has_old_examples():
        logger.info("No old examples found to clear")
        return False

    # Find the examples database
    examples_db = db.session.query(Database).filter_by(database_name="examples").first()

    if not examples_db:
        return False

    logger.info("Found examples database (id=%s)", examples_db.id)
    logger.info("Clearing old examples...")

    # 1. Get all datasets from examples database
    example_datasets = (
        db.session.query(SqlaTable).filter_by(database_id=examples_db.id).all()
    )
    dataset_ids = [ds.id for ds in example_datasets]
    logger.info("Found %d example datasets", len(example_datasets))

    # 2. Find all charts using these datasets
    example_charts = []
    if dataset_ids:
        example_charts = (
            db.session.query(Slice)
            .filter(
                Slice.datasource_id.in_(dataset_ids),
                Slice.datasource_type == "table",
            )
            .all()
        )
        logger.info("Found %d example charts", len(example_charts))

    chart_ids = [chart.id for chart in example_charts]

    # 3. Find dashboards that contain these charts
    example_dashboards = []
    if chart_ids:
        # Get dashboards that have relationships with our example charts
        example_dashboards = (
            db.session.query(Dashboard)
            .join(dashboard_slices)
            .filter(dashboard_slices.c.slice_id.in_(chart_ids))
            .distinct()
            .all()
        )
        logger.info("Found %d example dashboards", len(example_dashboards))

        # Remove dashboard-slice relationships first
        db.session.execute(
            dashboard_slices.delete().where(dashboard_slices.c.slice_id.in_(chart_ids))
        )
        logger.info(
            "Removed dashboard-slice relationships for %d charts",
            len(chart_ids),
        )

    # 4. Delete dashboards that are now empty (contain only example charts)
    for dashboard in example_dashboards:
        # Since we already deleted the relationships, check if dashboard is empty
        remaining_charts = (
            db.session.query(dashboard_slices.c.slice_id)
            .filter(dashboard_slices.c.dashboard_id == dashboard.id)
            .count()
        )

        if remaining_charts == 0:
            db.session.delete(dashboard)
            logger.info(
                "Deleted dashboard: %s (slug: %s)",
                dashboard.dashboard_title,
                dashboard.slug,
            )
        else:
            logger.info(
                "Keeping dashboard %s as it contains non-example charts",
                dashboard.dashboard_title,
            )

    # 5. Delete charts
    for chart in example_charts:
        db.session.delete(chart)
    logger.info("Deleted %d example charts", len(example_charts))

    # 6. Delete the database - this will cascade delete all datasets,
    # columns, and metrics thanks to the cascade="all, delete-orphan"
    db.session.delete(examples_db)

    logger.info("Examples database and all related objects removed successfully")
    return True


@examples_cli.command(name="clear-old", help="Clear old Python-based example data")
@with_appcontext
@transaction()
@click.option(
    "--confirm",
    is_flag=True,
    help="Skip confirmation prompt",
)
def clear_old(confirm: bool = False) -> None:
    """Clear old Python-generated example datasets, charts, and dashboards."""
    if not confirm:
        click.confirm(
            "This will delete old Python-based example data. Are you sure?",
            abort=True,
        )

    try:
        if clear_old_examples():
            logger.info("Old examples cleared successfully")
        else:
            logger.info("No old examples found to clear")
    except Exception as e:
        logger.error(f"Failed to clear old examples: {e}")
        raise


@examples_cli.command(name="clear", help="Clear all example data (NOT YET IMPLEMENTED)")
@with_appcontext
def clear() -> None:
    """Clear all example data including YAML-based examples."""
    click.echo(
        click.style(
            "Clearing YAML-based examples is NOT YET IMPLEMENTED.\n"
            "Use 'superset examples clear-old' to remove old Python-based examples.",
            fg="yellow",
        )
    )


@examples_cli.command(name="reload", help="Clear and reload example data")
@with_appcontext
@transaction()
@click.option("--load-test-data", "-t", is_flag=True, help="Load additional test data")
@click.option("--load-big-data", "-b", is_flag=True, help="Load additional big data")
@click.option(
    "--only-metadata",
    "-m",
    is_flag=True,
    help="Only load metadata, skip actual data",
)
@click.option(
    "--force",
    "-f",
    is_flag=True,
    help="Force load data even if table already exists",
)
def reload(
    load_test_data: bool = False,
    load_big_data: bool = False,
    only_metadata: bool = False,
    force: bool = False,
) -> None:
    """Clear existing examples and load fresh ones."""
    # This is essentially the old --cleanup behavior
    load_examples_run(load_test_data, load_big_data, only_metadata, force, cleanup=True)
