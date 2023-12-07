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

import pandas as pd
from sqlalchemy import BigInteger, Date, inspect, String
from sqlalchemy.sql import column

import superset.utils.database as database_utils
from superset import db
from superset.connectors.sqla.models import SqlMetric
from superset.models.slice import Slice
from superset.utils.core import DatasourceType

from .helpers import (
    get_example_url,
    get_slice_json,
    get_table_connector_registry,
    merge_slice,
    misc_dash_slices,
)


def load_country_map_data(only_metadata: bool = False, force: bool = False) -> None:
    """Loading data for map with country map"""
    tbl_name = "birth_france_by_region"
    database = database_utils.get_example_database()

    with database.get_sqla_engine_with_context() as engine:
        schema = inspect(engine).default_schema_name
        table_exists = database.has_table_by_name(tbl_name)

        if not only_metadata and (not table_exists or force):
            url = get_example_url("birth_france_data_for_country_map.csv")
            data = pd.read_csv(url, encoding="utf-8")
            data["dttm"] = datetime.datetime.now().date()
            data.to_sql(
                tbl_name,
                engine,
                schema=schema,
                if_exists="replace",
                chunksize=500,
                dtype={
                    "DEPT_ID": String(10),
                    "2003": BigInteger,
                    "2004": BigInteger,
                    "2005": BigInteger,
                    "2006": BigInteger,
                    "2007": BigInteger,
                    "2008": BigInteger,
                    "2009": BigInteger,
                    "2010": BigInteger,
                    "2011": BigInteger,
                    "2012": BigInteger,
                    "2013": BigInteger,
                    "2014": BigInteger,
                    "dttm": Date(),
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
        db.session.add(obj)
    obj.main_dttm_col = "dttm"
    obj.database = database
    obj.filter_select_enabled = True
    if not any(col.metric_name == "avg__2004" for col in obj.metrics):
        col = str(column("2004").compile(db.engine))
        obj.metrics.append(SqlMetric(metric_name="avg__2004", expression=f"AVG({col})"))
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        "granularity_sqla": "",
        "since": "",
        "until": "",
        "viz_type": "country_map",
        "entity": "DEPT_ID",
        "metric": {
            "expressionType": "SIMPLE",
            "column": {"type": "INT", "column_name": "2004"},
            "aggregate": "AVG",
            "label": "Boys",
            "optionName": "metric_112342",
        },
        "row_limit": 500000,
        "select_country": "france",
    }

    print("Creating a slice")
    slc = Slice(
        slice_name="Birth in France by department in 2016",
        viz_type="country_map",
        datasource_type=DatasourceType.TABLE,
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)
