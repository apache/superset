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
# pylint: disable=import-outside-toplevel

import logging
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, TYPE_CHECKING

import yaml

from superset import db

if TYPE_CHECKING:
    from superset.models.core import Database

_logger = logging.getLogger(__name__)


def get_metric_expression(metric: Dict[str, Any]) -> str:
    """
    Return a SQL expression for a given DBT metric.
    """
    return "{type}({sql})".format(**metric)


def sync_datasets(  # pylint: disable=too-many-locals
    manifest_path: Path, database: "Database",
) -> None:
    """
    Read the DBT manifest and import models as datasets with metrics.
    """
    from superset import security_manager
    from superset.connectors.sqla.models import SqlaTable, SqlMetric
    from superset.datasets.commands.create import CreateDatasetCommand
    from superset.datasets.dao import DatasetDAO

    with open(manifest_path, encoding="utf-8") as inp:
        manifest = yaml.load(inp, Loader=yaml.SafeLoader)

    user = security_manager.find_user("admin")

    # extract metrics
    metrics: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for metric in manifest["metrics"].values():
        for unique_id in metric["depends_on"]["nodes"]:
            metrics[unique_id].append(metric)

    # add datasets
    datasets = list(manifest["sources"].values()) + list(manifest["nodes"].values())
    for config in datasets:
        new = DatasetDAO.validate_uniqueness(
            database.id, config["schema"], config["name"]
        )
        if new:
            _logger.info("Creating dataset %s", config["unique_id"])
            command = CreateDatasetCommand(
                user,
                {
                    "database": database.id,
                    "schema": config["schema"],
                    "table_name": config["name"],
                },
            )
            dataset = command.run()
        else:
            _logger.info("Updating dataset %s", config["unique_id"])
            dataset = (
                db.session.query(SqlaTable)
                .filter_by(
                    database_id=database.id,
                    schema=config["schema"],
                    table_name=config["name"],
                )
                .one()
            )
            dataset.fetch_metadata()

        # add extra metadata
        dataset.description = config["description"]

        # delete existing metrics before adding the ones from the config
        for existing_metric in dataset.metrics:
            db.session.delete(existing_metric)
        db.session.flush()

        # add metrics
        if config["resource_type"] == "model":
            for metric in metrics[config["unique_id"]]:
                dataset.metrics.append(
                    SqlMetric(
                        expression=get_metric_expression(metric),
                        metric_name=metric["name"],
                        metric_type=metric["type"],
                        verbose_name=get_metric_expression(metric),
                        description=metric["description"],
                        **metric["meta"],
                    )
                )

    db.session.commit()
