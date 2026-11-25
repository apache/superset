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

from typing import Any, TYPE_CHECKING

from marshmallow import ValidationError

from superset.db_engine_specs.query_warning import QueryWarningResult

if TYPE_CHECKING:
    from superset.models.core import Database


class MessageOnlyQueryWarningCheck:
    """Test the shared contract without a metric or an estimation prerequisite."""

    def validate(self, rule: dict[str, Any]) -> None:
        """Validate the optional saved notice independently of numeric fields."""
        if "notice" in rule and (
            not isinstance(rule["notice"], str) or not rule["notice"].strip()
        ):
            raise ValidationError({"notice": ["A notice must be nonempty text."]})

    def is_enabled(self, database: Database) -> bool:
        """Require only the saved opt-in, without checking manual estimation."""
        return database.get_extra().get("query_cost_warning", {}).get("enabled") is True

    def assess(
        self,
        database: Database,
        catalog: str | None,
        schema: str,
        prepared_sql: str,
        rule: dict[str, Any],
    ) -> QueryWarningResult:
        """Ask for confirmation using a message alone."""
        return {
            "action": "confirm",
            "reason": "warning",
            "message": rule.get("notice", "Review this query."),
        }
