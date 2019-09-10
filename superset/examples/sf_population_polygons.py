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
from sqlalchemy import BigInteger, Float, Text

from superset import db
from superset.utils import core as utils
from .helpers import get_example_data, TBL


def load_sf_population_polygons(only_metadata=False, force=False):
    tbl_name = "sf_population_polygons"
    database = utils.get_example_database()
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        data = get_example_data("sf_population.json.gz")
        df = pd.read_json(data)
        df["contour"] = df.contour.map(json.dumps)

        df.to_sql(
            tbl_name,
            database.get_sqla_engine(),
            if_exists="replace",
            chunksize=500,
            dtype={
                "zipcode": BigInteger,
                "population": BigInteger,
                "contour": Text,
                "area": Float,
            },
            index=False,
        )

    print("Creating table {} reference".format(tbl_name))
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = "Population density of San Francisco"
    tbl.database = database
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
