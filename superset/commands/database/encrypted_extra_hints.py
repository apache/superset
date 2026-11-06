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

from typing import Any, cast

from flask import current_app as app

from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.daos.database import DatabaseDAO
from superset.models.core import Database


class GetEncryptedExtraHintsCommand(BaseCommand):
    """
    Return hints (label, length, short suffix) for the masked fields of a
    database's `encrypted_extra`, sized by `ENCRYPTED_EXTRA_HINT_CHARS`.
    """

    def __init__(self, database_id: int):
        self._database_id = database_id
        self._database: Database | None = None

    def run(self) -> list[dict[str, Any]]:
        self.validate()
        database = cast(Database, self._database)
        return database.db_engine_spec.encrypted_extra_hints(
            database.encrypted_extra,
            int(app.config["ENCRYPTED_EXTRA_HINT_CHARS"]),
        )

    def validate(self) -> None:
        self._database = DatabaseDAO.find_by_id(self._database_id)
        if not self._database:
            raise DatabaseNotFoundError()
