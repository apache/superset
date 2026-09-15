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
"""Resolve the ClickHouse database used by the MOH alert service.

The alert service normally looks the database up in the ``dbs`` table by its
``database_id``. For deployments where the stored connection string differs
from the live ClickHouse (e.g. credentials rotated outside Superset), the
``MOH_ALERTS_DB_URI`` config key can point the service at the correct server
without editing any database rows: when set, a transient in-memory ``Database``
is built from that URI instead.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from flask import current_app

if TYPE_CHECKING:
    from superset.models.core import Database


def get_moh_database(database_id: int | None) -> Database:
    """Return the database to evaluate an alert against.

    Prefers the ``MOH_ALERTS_DB_URI`` config override; falls back to the
    ``dbs`` table entry identified by ``database_id``.
    """
    # pylint: disable=import-outside-toplevel
    from superset.extensions import db
    from superset.models.core import Database

    override_uri = current_app.config.get("MOH_ALERTS_DB_URI")
    if override_uri:
        database = Database()
        database.id = database_id
        database.database_name = current_app.config.get(
            "MOH_ALERTS_DB_NAME", "MOH_Click_Hhouse"
        )
        database.set_sqlalchemy_uri(str(override_uri))
        return database

    if database_id is None:
        raise ValueError("MOH_ALERTS_DB_URI not set and database_id is None")
    database = (
        db.session.query(Database)
        .filter(Database.id == database_id)
        .one_or_none()
    )
    if database is None:
        raise ValueError(f"database_id {database_id} not found")
    return database
