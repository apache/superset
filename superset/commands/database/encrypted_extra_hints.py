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

from typing import Any

from flask import current_app as app

from superset.commands.base import BaseCommand
from superset.models.core import Database


class GetEncryptedExtraHintsCommand(BaseCommand):
    """
    Return hints (label and short suffix) for the string secrets stored in a
    database's `encrypted_extra`, sized by `ENCRYPTED_EXTRA_HINT_CHARS`.
    """

    def __init__(self, database: Database):
        self._database = database

    def run(self) -> list[dict[str, Any]]:
        return self._database.db_engine_spec.encrypted_extra_hints(
            self._database.encrypted_extra,
            int(app.config["ENCRYPTED_EXTRA_HINT_CHARS"]),
        )

    def validate(self) -> None:
        """The caller resolves the database, so there is nothing to check."""
