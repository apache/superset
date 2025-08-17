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
import random
from datetime import datetime, timedelta

from flask import request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from sqlglot import Dialects
from superset_core.api import models, query
from superset_core.api.types.rest_api import RestApi

from dataset_references.query_parsing import extract_tables


class DatasetReferencesAPI(RestApi):
    resource_name = "dataset_references"
    openapi_spec_tag = "Dataset references"
    class_permission_name = "dataset_references"

    @expose("/metadata", methods=("POST",))
    @protect()
    @safe
    @permission_name("read")
    def metadata(self) -> Response:
        sql: str = request.json.get("sql")
        database_id: int = request.json.get("databaseId")

        # Access to the metadata database using core APIs to retrive dataset owners
        databases = models.get_databases(id=database_id)
        if not databases:
            return self.response_404()

        database = databases[0]
        dialect = query.get_sqlglot_dialect(database)

        datasets = models.get_datasets()

        owners_map = {}

        for dataset in datasets:
            table_name = dataset.table_name
            owners_map[table_name] = [
                f"{owner.first_name} {owner.last_name}" for owner in dataset.owners
            ]

        # Access to first-class dependencies like SQL Glot
        tables = extract_tables(sql, dialect=dialect)

        # Access to an analytical database to get estimated row counts
        row_counts = {}
        if tables:
            if dialect == Dialects.POSTGRES:
                table_names = ", ".join(f"'{t}'" for t in tables)
                count_estimates = database.get_df(
                    sql=f"""
                            SELECT
                                relname AS table_name,
                                reltuples::BIGINT AS estimated_row_count
                            FROM pg_class
                            WHERE relname IN ({table_names})
                        """  # noqa: S608
                )
                for _, row in count_estimates.iterrows():
                    table_name = row["table_name"]
                    estimated_row_count = row["estimated_row_count"]
                    row_counts[table_name] = estimated_row_count
            else:
                # For other databases, we simulate row counts
                for table in tables:
                    row_counts[table] = random.randint(0, 100_000)  # noqa: S311

        result = []
        for table_name in tables:
            # Generate a random date within the last 60 days
            days_ago = random.randint(0, 60)  # noqa: S311
            latest_partition = (datetime.today() - timedelta(days=days_ago)).strftime(
                "%Y-%m-%d"
            )
            result.append(
                {
                    "dataset_name": table_name,
                    "owners": owners_map.get(table_name, []),
                    "latest_partition": latest_partition,
                    "estimated_row_count": row_counts.get(table_name),
                }
            )

        return self.response(200, result=result)
