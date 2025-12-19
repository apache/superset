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
from datetime import datetime
from io import BytesIO
from typing import Any

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from flask import request, send_file, Response
from flask_appbuilder.api import expose, permission_name, protect
from flask_babel import gettext as __
from superset_core.api.daos import DatabaseDAO
from superset_core.api.rest_api import RestApi
from superset_core.api.types import QueryOptions, QueryStatus

logger = logging.getLogger(__name__)


class ParquetExportAPI(RestApi):
    resource_name = "sqllab_parquet"
    openapi_spec_tag = "SQL Lab Parquet Export"
    class_permission_name = "sqllab_parquet"

    @expose("/export/", methods=("POST",))
    @protect()
    @permission_name("read")
    def export_parquet(self) -> Response:
        """Export SQL query results to Parquet format.

        Request body:
            sql: SQL query to execute
            databaseId: Database ID to execute against
            catalog: Optional catalog name
            schema: Optional schema name

        Returns:
            Parquet file download
        """
        try:
            # 1. Parse request body
            body = request.json or {}
            sql = body.get("sql")
            database_id = body.get("databaseId")
            catalog = body.get("catalog")
            schema = body.get("schema")

            if not sql:
                return self.response(400, message=__("SQL query is required"))

            if not database_id:
                return self.response(400, message=__("Database ID is required"))

            # 2. Get database
            database = DatabaseDAO.find_one_or_none(id=database_id)
            if database is None:
                return self.response(404, message=__("Database not found"))

            # 3. Execute query
            df = self._execute_query(database, sql, catalog, schema)

            # 4. Convert DataFrame to Parquet bytes
            parquet_buffer = self._dataframe_to_parquet(df)

            # 5. Generate filename with timestamp
            filename = f"query_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.parquet"

            logger.info("Exported %d rows to Parquet file: %s", len(df.index), filename)

            # 6. Return as file download
            return send_file(
                parquet_buffer,
                mimetype="application/vnd.apache.parquet",
                as_attachment=True,
                download_name=filename,
            )

        except Exception as ex:
            logger.exception("Error exporting to Parquet: %s", str(ex))
            return self.response(500, message=str(ex))

    def _execute_query(
        self,
        database: Any,
        sql: str,
        catalog: str | None,
        schema: str | None,
    ) -> pd.DataFrame:
        """Execute query and return results as DataFrame."""
        logger.info("Executing query on database %s", database.id)

        options = QueryOptions(
            catalog=catalog,
            schema=schema,
        )

        result = database.execute(sql, options)

        if result.status != QueryStatus.SUCCESS:
            raise ValueError(result.error_message or "Query execution failed")

        if not result.statements or result.statements[0].data is None:
            return pd.DataFrame()

        return result.statements[0].data

    def _dataframe_to_parquet(self, df: pd.DataFrame) -> BytesIO:
        """Convert DataFrame to Parquet bytes with Snappy compression."""
        # Convert DataFrame to PyArrow Table
        table = pa.Table.from_pandas(df, preserve_index=False)

        # Write to buffer with Snappy compression
        buffer = BytesIO()
        pq.write_table(table, buffer, compression="snappy")
        buffer.seek(0)

        return buffer
