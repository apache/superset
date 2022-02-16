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
from typing import Any, Dict

from sqlalchemy.orm import Session

from superset.models.superset_core.role import SupersetRole

logger = logging.getLogger(__name__)


def import_role(
    session: Session, config: Dict[str, Any], overwrite: bool = False
) -> SupersetRole:
    existing = (
        session.query(SupersetRole.id, SupersetRole.name)
        .filter_by(name=config["name"])
        .first()
    )
    if existing:
        if not overwrite:
            return existing

    config = config.copy()

    role = SupersetRole.import_from_dict(session, config, recursive=False)

    # Create the new role at the db
    if role.id is None:
        session.flush()

    return role
