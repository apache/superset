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

import json
import logging
from typing import Any, Dict

from sqlalchemy.orm import Session

from superset.connectors.sqla.models import SqlaTable

logger = logging.getLogger(__name__)

JSON_KEYS = {"params", "template_params", "extra"}


def import_dataset(
    session: Session, config: Dict[str, Any], overwrite: bool = False
) -> SqlaTable:
    existing = session.query(SqlaTable).filter_by(uuid=config["uuid"]).first()
    if existing:
        if not overwrite:
            return existing
        config["id"] = existing.id

    # TODO (betodealmeida): move this logic to import_from_dict
    config = config.copy()
    for key in JSON_KEYS:
        if config.get(key):
            try:
                config[key] = json.dumps(config[key])
            except TypeError:
                logger.info("Unable to encode `%s` field: %s", key, config[key])
    for metric in config.get("metrics", []):
        if metric.get("extra"):
            try:
                metric["extra"] = json.dumps(metric["extra"])
            except TypeError:
                logger.info("Unable to encode `extra` field: %s", metric["extra"])

    # should we delete columns and metrics not present in the current import?
    sync = ["columns", "metrics"] if overwrite else []

    # import recursively to include columns and metrics
    dataset = SqlaTable.import_from_dict(session, config, recursive=True, sync=sync)
    if dataset.id is None:
        session.flush()

    return dataset
