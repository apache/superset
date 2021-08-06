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
import json

import pandas as pd
from sqlalchemy import String, Text

from superset import db
from superset.utils import core as utils

from .helpers import get_example_data, get_table_connector_registry


def load_paris_iris_geojson(only_metadata: bool = False, force: bool = False) -> None:
    tbl_name = "paris_iris_mapping"
    database = utils.get_example_database()
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        data = get_example_data("paris_iris.json.gz")
        df = pd.read_json(data)
        df["features"] = df.features.map(json.dumps)

        df.to_sql(
            tbl_name,
            database.get_sqla_engine(),
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

    print("Creating table {} reference".format(tbl_name))
    table = get_table_connector_registry()
    tbl = db.session.query(table).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = table(table_name=tbl_name)
    tbl.description = "Map of Paris"
    tbl.database = database
    tbl.filter_select_enabled = True
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
