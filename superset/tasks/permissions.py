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
from __future__ import annotations

import logging

from flask import g

from superset import security_manager
from superset.commands.database.update import UpdateDatabaseCommand
from superset.daos.database import DatabaseDAO
from superset.extensions import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="resync_database_permissions", soft_time_limit=600)
def resync_database_permissions(database_id: int, username: str | None) -> None:
    logger.info("Resyncing permissions for DB connection ID %s", database_id)
    database = DatabaseDAO.find_by_id(database_id)
    ssh_tunnel = DatabaseDAO.get_ssh_tunnel(database_id)
    if not database:
        logger.error("Database ID %s not found", database_id)
        return
    if username and (user := security_manager.get_user_by_username(username)):
        g.user = user
        logger.info("Impersonating user ID %s", g.user.id)
    cmmd = UpdateDatabaseCommand(database_id, {})
    try:
        cmmd._refresh_catalogs(database, database.name, ssh_tunnel)
    except Exception:
        logger.error(
            "An error occurred while resyncing permissions for DB connection ID %s",
            database_id,
            exc_info=True,
        )
