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
from dataset_references.query_parsing import extract_tables
from superset_core.api import models, query
from superset_core.api.types.rest_api import RestApi


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

        session = models.get_session()
        database_model = models.get_database_model()
        database_query = session.query(database_model).filter_by(id=database_id)
        database = models.get_databases(database_query)[0]
        dialect = query.get_sqlglot_dialect(database)

        tables = extract_tables(sql, dialect=dialect)

        dataset_model = models.get_dataset_model()
        dataset_query = session.query(dataset_model)
        datasets = models.get_datasets(dataset_query)

        owners_map = {}

        # Retrieve all table owners from the database
        for dataset in datasets:
            table_name = dataset.table_name
            owners_map[table_name] = [
                f"{owner.first_name} {owner.last_name}" for owner in dataset.owners
            ]

        # # Get estimated row counts from PostgreSQL's pg_class and pg_namespace
        # # Only works for tables in the current database/schema
        # row_counts = {}
        # if tables:
        #     table_names = ", ".join(f"'{t}'" for t in tables)
        #     count_estimates = (
        #         models.get_database(1)
        #         .get_df(
        #             f"""
        #                 SELECT
        #                     relname AS table_name,
        #                     reltuples::BIGINT AS estimated_row_count
        #                 FROM pg_class
        #                 WHERE relname IN ({table_names})
        #             """
        #         )
        #     )
        #     for _, row in count_estimates.iterrows():
        #         table_name = row["table_name"]
        #         estimated_row_count = row["estimated_row_count"]
        #         row_counts[table_name] = estimated_row_count
        result = []
        for table_name in tables:
            # Generate a random date within the last 60 days
            days_ago = random.randint(0, 60)  # noqa: S311
            latest_partition = (datetime.today() - timedelta(days=days_ago)).strftime(
                "%Y-%m-%d"
            )
            # estimated_row_count = row_counts.get(table_name)
            estimated_row_count = random.randint(0, 100000)  # noqa: S311
            result.append(
                {
                    "dataset_name": table_name,
                    "owners": owners_map.get(table_name, []),
                    "latest_partition": latest_partition,
                    "estimated_row_count": estimated_row_count,
                }
            )

        return self.response(200, result=result)
