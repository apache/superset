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
from typing import Any, Callable

import click
from flask.cli import with_appcontext

import superset.utils.database as database_utils
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


def _should_skip_loader(
    loader_name: str, load_big_data: bool, only_metadata: bool
) -> bool:
    """Check if a loader should be skipped."""
    # Skip special loaders that aren't datasets
    if loader_name in ["load_css_templates", "load_examples_from_configs"]:
        return True

    # Skip big data if not requested or when only metadata is requested
    if loader_name == "load_big_data" and (not load_big_data or only_metadata):
        return True

    return False


def _load_dataset(
    loader: Callable[..., Any], loader_name: str, only_metadata: bool, force: bool
) -> None:
    """Load a single dataset with error handling."""
    import inspect

    dataset_name = loader_name[5:].replace("_", " ").title()
    logger.info("Loading [%s]", dataset_name)

    # Call loader with appropriate parameters
    sig = inspect.signature(loader)
    params = {}
    if "only_metadata" in sig.parameters:
        params["only_metadata"] = only_metadata
    if "force" in sig.parameters:
        params["force"] = force

    try:
        loader(**params)
    except Exception as e:
        logger.warning("Failed to load %s: %s", dataset_name, e)


def load_examples_run(
    load_test_data: bool = False,
    load_big_data: bool = False,
    only_metadata: bool = False,
    force: bool = False,
) -> None:
    if only_metadata:
        logger.info("Loading examples metadata")
    else:
        examples_db = database_utils.get_example_database()
        logger.info("Loading examples metadata and related data into %s", examples_db)

    # pylint: disable=import-outside-toplevel
    import superset.examples.data_loading as examples

    # Always load CSS templates
    examples.load_css_templates()

    # Auto-discover and load all datasets
    for loader_name in dir(examples):
        if not loader_name.startswith("load_"):
            continue

        if _should_skip_loader(loader_name, load_big_data, only_metadata):
            continue

        loader = getattr(examples, loader_name)
        _load_dataset(loader, loader_name, only_metadata, force)

    # Load examples that are stored as YAML config files
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
    load_examples_run(load_test_data, load_big_data, only_metadata, force)
