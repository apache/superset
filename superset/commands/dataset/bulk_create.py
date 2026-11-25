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
from typing import Any, Literal, TypedDict

from flask_babel import gettext as _

from superset.commands.base import BaseCommand
from superset.commands.dataset.create import CreateDatasetCommand
from superset.commands.dataset.exceptions import DatasetInvalidError
from superset.datasets.schemas import DatasetBulkCreateSchema
from superset.exceptions import OAuth2RedirectError

logger = logging.getLogger(__name__)


class DatasetRegistrationResult(TypedDict):
    """Serializable result for a single selected table."""

    table_name: str
    status: Literal["created", "skipped", "failed"]
    uuid: str | None
    message: str


class BulkCreateDatasetsCommand(BaseCommand):
    """Register tables independently so a failure preserves prior successes."""

    def __init__(self, data: dict[str, Any]) -> None:
        self._properties = data.copy()

    def validate(self) -> None:
        """Validate the batch size, table names, and connection parameters."""
        self._properties = DatasetBulkCreateSchema().load(self._properties)

    def run(self) -> list[DatasetRegistrationResult]:
        """Reuse single-dataset authorization, metadata loading, and transactions."""
        self.validate()
        results: list[DatasetRegistrationResult] = []
        for table_name in self._properties["tables"]:
            result: DatasetRegistrationResult = {
                "table_name": table_name,
                "status": "failed",
                "uuid": None,
                "message": "",
            }
            try:
                # Each command owns its transaction. An outer transaction would
                # couple failures and successes across the entire batch.
                dataset = CreateDatasetCommand(
                    {
                        "database": self._properties["database"],
                        "catalog": self._properties.get("catalog"),
                        "schema": self._properties.get("schema"),
                        "table_name": table_name,
                    }
                ).run()
                result.update(status="created", uuid=str(dataset.uuid))
            except DatasetInvalidError as ex:
                # Only skip when existence is the sole validation failure;
                # permission or missing-table failures must remain failures.
                if ex.get_list_classnames() == ["DatasetExistsValidationError"]:
                    result.update(
                        status="skipped", message=_("Dataset already exists.")
                    )
                else:
                    result["message"] = " ".join(
                        str(message)
                        for messages in ex.normalized_messages().values()
                        for message in (
                            messages if isinstance(messages, list) else [messages]
                        )
                    )
            except OAuth2RedirectError:
                result["message"] = _(
                    "Database authentication is required. Authenticate and retry."
                )
            except Exception:  # pylint: disable=broad-except
                # Preserve partial results without exposing driver/connection errors.
                logger.exception("Error registering dataset for table %s", table_name)
                result["message"] = _("Dataset could not be created.")
            results.append(result)
        return results
