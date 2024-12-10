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

import pandas as pd
from sqlalchemy import inspect, String, Text

import superset.utils.database as database_utils
from superset import db
from superset.sql_parse import Table
from superset.utils import json

from .helpers import get_example_url, get_table_connector_registry


def load_paris_iris_geojson(only_metadata: bool = False, force: bool = False) -> None:
    tbl_name = "paris_iris_mapping"
    database = database_utils.get_example_database()
    with database.get_sqla_engine() as engine:
        schema = inspect(engine).default_schema_name
        table_exists = database.has_table(Table(tbl_name, schema))

        if not only_metadata and (not table_exists or force):
            url = get_example_url("paris_iris.json.gz")
            df = pd.read_json(url, compression="gzip")
            df["features"] = df.features.map(json.dumps)

            df.to_sql(
                tbl_name,
                engine,
                schema=schema,
                if_exists="replace",
                chunksize=500,
                dtype={
                    "color": String(255),
                    "name": String(255),
                    "features": Text,
                    "type": Text,
                },
                index=False,
            )

    print(f"Creating table {tbl_name} reference")
    table = get_table_connector_registry()
    tbl = db.session.query(table).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = table(table_name=tbl_name, schema=schema)
        db.session.add(tbl)
    tbl.description = "Map of Paris"
    tbl.database = database
    tbl.filter_select_enabled = True
    tbl.fetch_metadata()
