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

from superset.models.dashboard import Dashboard

logger = logging.getLogger(__name__)


JSON_KEYS = {"position": "position_json", "metadata": "json_metadata"}


def import_dashboard(
    session: Session, config: Dict[str, Any], overwrite: bool = False
) -> Dashboard:
    existing = session.query(Dashboard).filter_by(uuid=config["uuid"]).first()
    if existing:
        if not overwrite:
            return existing
        config["id"] = existing.id

    # TODO (betodealmeida): move this logic to import_from_dict
    config = config.copy()
    for key, new_name in JSON_KEYS.items():
        if config.get(key):
            value = config.pop(key)
            try:
                config[new_name] = json.dumps(value)
            except json.decoder.JSONDecodeError:
                logger.info("Unable to decode `%s` field: %s", key, value)

    dashboard = Dashboard.import_from_dict(session, config, recursive=False)
    if dashboard.id is None:
        session.flush()

    return dashboard
