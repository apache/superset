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
from sqlalchemy import DateTime, String

from superset import db
from superset.models.slice import Slice
from superset.utils import core as utils

from .helpers import config, get_example_data, get_slice_json, merge_slice, TBL


def load_random_time_series_data(
    only_metadata: bool = False, force: bool = False
) -> None:
    """Loading random time series data from a zip file in the repo"""
    tbl_name = "random_time_series"
    database = utils.get_example_database()
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        data = get_example_data("random_time_series.json.gz")
        pdf = pd.read_json(data)
        if database.backend == "presto":
            pdf.ds = pd.to_datetime(pdf.ds, unit="s")
            pdf.ds = pdf.ds.dt.strftime("%Y-%m-%d %H:%M%:%S")
        else:
            pdf.ds = pd.to_datetime(pdf.ds, unit="s")

        pdf.to_sql(
            tbl_name,
            database.get_sqla_engine(),
            if_exists="replace",
            chunksize=500,
            dtype={"ds": DateTime if database.backend != "presto" else String(255)},
            index=False,
        )
        print("Done loading table!")
        print("-" * 80)

    print(f"Creating table [{tbl_name}] reference")
    obj = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not obj:
        obj = TBL(table_name=tbl_name)
    obj.main_dttm_col = "ds"
    obj.database = database
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        "granularity_sqla": "day",
        "row_limit": config["ROW_LIMIT"],
        "since": "2019-01-01",
        "until": "2019-02-01",
        "metric": "count",
        "viz_type": "cal_heatmap",
        "domain_granularity": "month",
        "subdomain_granularity": "day",
    }

    print("Creating a slice")
    slc = Slice(
        slice_name="Calendar Heatmap",
        viz_type="cal_heatmap",
        datasource_type="table",
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
