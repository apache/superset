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

logger = logging.getLogger(__name__)


def load_examples_run(
    load_test_data: bool = False,
    load_big_data: bool = False,
    only_metadata: bool = False,
    force: bool = False,
) -> None:
    if only_metadata:
        print("Loading examples metadata")
    else:
        examples_db = database_utils.get_example_database()
        print(f"Loading examples metadata and related data into {examples_db}")

    # pylint: disable=import-outside-toplevel
    import superset.examples.data_loading as examples

    examples.load_css_templates()

    if load_test_data:
        print("Loading energy related dataset")
        examples.load_energy(only_metadata, force)

    print("Loading [World Bank's Health Nutrition and Population Stats]")
    examples.load_world_bank_health_n_pop(only_metadata, force)

    print("Loading [Birth names]")
    examples.load_birth_names(only_metadata, force)

    if load_test_data:
        print("Loading [Tabbed dashboard]")
        examples.load_tabbed_dashboard(only_metadata)
    else:
        print("Loading [Random long/lat data]")
        examples.load_long_lat_data(only_metadata, force)

        print("Loading [Country Map data]")
        examples.load_country_map_data(only_metadata, force)

        print("Loading [San Francisco population polygons]")
        examples.load_sf_population_polygons(only_metadata, force)

        print("Loading [Flights data]")
        examples.load_flights(only_metadata, force)

        print("Loading [BART lines]")
        examples.load_bart_lines(only_metadata, force)

        print("Loading [Multi Line]")
        examples.load_multi_line(only_metadata)

        print("Loading [Misc Charts] dashboard")
        examples.load_misc_dashboard()

        print("Loading DECK.gl demo")
        examples.load_deck_dash()

    if load_big_data:
        print("Loading big synthetic data for tests")
        examples.load_big_data()

    # load examples that are stored as YAML config files
    examples.load_examples_from_configs(force, load_test_data)


@click.command()
@with_appcontext
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
    load_examples_run(load_test_data, load_big_data, only_metadata, force)
