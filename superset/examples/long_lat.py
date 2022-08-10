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
import datetime
import random

import geohash
import pandas as pd
from sqlalchemy import DateTime, Float, inspect, String

import superset.utils.database as database_utils
from superset import db
from superset.models.slice import Slice
from superset.utils.core import DatasourceType

from .helpers import (
    get_example_data,
    get_slice_json,
    get_table_connector_registry,
    merge_slice,
    misc_dash_slices,
)


def load_long_lat_data(only_metadata: bool = False, force: bool = False) -> None:
    """Loading lat/long data from a csv file in the repo"""
    tbl_name = "long_lat"
    database = database_utils.get_example_database()
    engine = database.get_sqla_engine()
    schema = inspect(engine).default_schema_name
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        data = get_example_data("san_francisco.csv.gz", make_bytes=True)
        pdf = pd.read_csv(data, encoding="utf-8")
        start = datetime.datetime.now().replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        pdf["datetime"] = [
            start + datetime.timedelta(hours=i * 24 / (len(pdf) - 1))
            for i in range(len(pdf))
        ]
        pdf["occupancy"] = [random.randint(1, 6) for _ in range(len(pdf))]
        pdf["radius_miles"] = [random.uniform(1, 3) for _ in range(len(pdf))]
        pdf["geohash"] = pdf[["LAT", "LON"]].apply(lambda x: geohash.encode(*x), axis=1)
        pdf["delimited"] = pdf["LAT"].map(str).str.cat(pdf["LON"].map(str), sep=",")
        pdf.to_sql(
            tbl_name,
            engine,
            schema=schema,
            if_exists="replace",
            chunksize=500,
            dtype={
                "longitude": Float(),
                "latitude": Float(),
                "number": Float(),
                "street": String(100),
                "unit": String(10),
                "city": String(50),
                "district": String(50),
                "region": String(50),
                "postcode": Float(),
                "id": String(100),
                "datetime": DateTime(),
                "occupancy": Float(),
                "radius_miles": Float(),
                "geohash": String(12),
                "delimited": String(60),
            },
            index=False,
        )
        print("Done loading table!")
        print("-" * 80)

    print("Creating table reference")
    table = get_table_connector_registry()
    obj = db.session.query(table).filter_by(table_name=tbl_name).first()
    if not obj:
        obj = table(table_name=tbl_name, schema=schema)
    obj.main_dttm_col = "datetime"
    obj.database = database
    obj.filter_select_enabled = True
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        "granularity_sqla": "day",
        "since": "2014-01-01",
        "until": "now",
        "viz_type": "mapbox",
        "all_columns_x": "LON",
        "all_columns_y": "LAT",
        "mapbox_style": "mapbox://styles/mapbox/light-v9",
        "all_columns": ["occupancy"],
        "row_limit": 500000,
    }

    print("Creating a slice")
    slc = Slice(
        slice_name="Mapbox Long/Lat",
        viz_type="mapbox",
        datasource_type=DatasourceType.TABLE,
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)
