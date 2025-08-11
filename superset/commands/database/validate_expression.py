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
from enum import Enum
from typing import Any, Optional

from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.daos.database import DatabaseDAO
from superset.models.core import Database

logger = logging.getLogger(__name__)


class ExpressionType(str, Enum):
    """Types of SQL expressions that can be validated"""

    METRIC = "metric"
    COLUMN = "column"
    WHERE = "where"
    HAVING = "having"
    # Keep FILTER for backward compatibility
    FILTER = "filter"


class ValidateExpressionCommand(BaseCommand):
    """
    Command for validating SQL expressions (not full queries).
    Wraps expressions in a test query for validation.
    """

    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._model: Optional[Database] = None
        self._expression = data.get("expression", "")
        self._expression_type = data.get("expression_type", ExpressionType.COLUMN)
        self._table_name = data.get("table_name")
        self._catalog_name = data.get("catalog")
        self._schema_name = data.get("schema")
        self._clause = data.get("clause")  # For backward compatibility with FILTER type
        self._dataset_id = data.get("dataset_id")  # Optional dataset ID for context

    def run(self) -> list[dict[str, Any]]:
        """
        Validates a SQL expression by executing it against the database

        :return: A List of SQLValidationAnnotation dictionaries
        :raises: DatabaseNotFoundError
        """
        # Validate that we have a database
        if not self._model:
            self._model = DatabaseDAO.find_by_id(self._model_id)
            if not self._model:
                raise DatabaseNotFoundError()

        # Convert FILTER type to WHERE/HAVING for backward compatibility
        expression_type = self._expression_type
        if expression_type == ExpressionType.FILTER:
            expression_type = (
                ExpressionType.HAVING
                if self._clause == "HAVING"
                else ExpressionType.WHERE
            )

        # Get dataset if dataset_id is provided
        dataset = None
        if self._dataset_id:
            try:
                from superset.daos.dataset import DatasetDAO

                dataset = DatasetDAO.find_by_id(self._dataset_id)
            except Exception:  # noqa: S110
                # Dataset is optional, continue without it
                pass

        # If dataset not found by ID, try to construct minimal context
        if not dataset and (
            self._table_name or self._schema_name or self._catalog_name
        ):
            # Create a minimal dataset-like object with necessary attributes
            class MinimalDataset:
                def __init__(
                    self,
                    table_name: str | None = None,
                    schema: str | None = None,
                    catalog: str | None = None,
                ) -> None:
                    self.table_name = table_name
                    self.schema = schema
                    self.catalog = catalog
                    self.fetch_values_predicate: str | None = None

            dataset = MinimalDataset(  # type: ignore[assignment]
                table_name=self._table_name,
                schema=self._schema_name,
                catalog=self._catalog_name,
            )

        # Use the new engine spec method for validation
        engine_spec = self._model.db_engine_spec
        result = engine_spec.validate_sql_expression(
            expression=self._expression,
            expression_type=expression_type.value,  # Convert enum to string
            dataset=dataset,
            database=self._model,
        )

        # Return the errors from the validation result
        return result["errors"]

    def validate(self) -> None:
        """
        Validates that the command can be executed.
        """
        # Validate that we have a database
        if not self._model:
            self._model = DatabaseDAO.find_by_id(self._model_id)
            if not self._model:
                raise DatabaseNotFoundError()
