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
import uuid
from typing import Any, Optional

from superset.commands.base import BaseCommand
from superset.daos.database import DatabaseDAO
from superset.datasource_analyzer.exceptions import (
    DatasourceAnalyzerAccessDeniedError,
    DatasourceAnalyzerDatabaseNotFoundError,
    DatasourceAnalyzerInvalidError,
    DatasourceAnalyzerSchemaNotFoundError,
)
from superset.extensions import security_manager

logger = logging.getLogger(__name__)


class InitiateDatasourceAnalyzerCommand(BaseCommand):
    """
    Command to initiate a datasource analysis job.

    This command validates the database and schema, checks user access,
    and initiates an analysis job (placeholder for Celery task).
    """

    def __init__(
        self,
        database_id: int,
        schema_name: str,
        catalog_name: Optional[str] = None,
    ):
        self._database_id = database_id
        self._schema_name = schema_name
        self._catalog_name = catalog_name
        self._database = None

    def run(self) -> dict[str, Any]:
        """
        Execute the command to initiate datasource analysis.

        :returns: Dictionary containing the run_id
        :raises: DatasourceAnalyzerInvalidError if validation fails
        """
        self.validate()

        # Generate a unique run_id for this analysis job
        run_id = str(uuid.uuid4())

        # TODO: Enqueue Celery task for actual schema introspection
        # celery_task.delay(run_id, self._database_id, self._schema_name, self._catalog_name)

        logger.info(
            "Initiated datasource analysis job %s for database %s, schema %s",
            run_id,
            self._database_id,
            self._schema_name,
        )

        return {"run_id": run_id}

    def validate(self) -> None:
        """
        Validate the command parameters.

        :raises: DatasourceAnalyzerDatabaseNotFoundError if database doesn't exist
        :raises: DatasourceAnalyzerAccessDeniedError if user doesn't have access
        :raises: DatasourceAnalyzerSchemaNotFoundError if schema doesn't exist
        :raises: DatasourceAnalyzerInvalidError for other validation failures
        """
        exceptions: list[Exception] = []

        # Verify database exists
        self._database = DatabaseDAO.find_by_id(self._database_id)
        if not self._database:
            raise DatasourceAnalyzerDatabaseNotFoundError()

        # Verify user has access to the database
        if not security_manager.can_access_database(self._database):
            raise DatasourceAnalyzerAccessDeniedError()

        # Verify schema exists in the database
        try:
            schemas = self._database.get_all_schema_names(
                catalog=self._catalog_name,
                cache=False,
            )
            if self._schema_name not in schemas:
                raise DatasourceAnalyzerSchemaNotFoundError()
        except Exception as ex:
            logger.warning("Error fetching schemas: %s", ex)
            exceptions.append(ex)

        if exceptions:
            raise DatasourceAnalyzerInvalidError(exceptions=exceptions)
