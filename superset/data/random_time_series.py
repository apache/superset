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
from sqlalchemy import DateTime

from superset import db
from .helpers import (
    config,
    get_example_data,
    get_sample_data_db,
    get_sample_data_schema,
    get_slice_json,
    make_df_columns_compatible,
    make_dtype_columns_compatible,
    merge_slice,
    Slice,
    TBL,
)


def load_random_time_series_data():
    """Loading random time series data from a zip file in the repo"""
    sample_db = get_sample_data_db()
    schema = get_sample_data_schema()
    mlc = sample_db.db_engine_spec.make_label_compatible
    tbl_name = 'random_time_series'
    data = get_example_data('random_time_series.json.gz')
    pdf = pd.read_json(data)
    pdf.ds = pd.to_datetime(pdf.ds, unit='s')
    pdf = make_df_columns_compatible(pdf, sample_db.db_engine_spec)
    dtypes = make_dtype_columns_compatible({
        'ds': DateTime(),
    }, sample_db.db_engine_spec)
    sample_db.db_engine_spec.df_to_sql(pdf,
                                       name=tbl_name,
                                       con=sample_db.get_sqla_engine(),
                                       schema=schema,
                                       if_exists='replace',
                                       chunksize=500,
                                       dtype=dtypes,
                                       index=False)
    print('Done loading table!')
    print('-' * 80)

    print('Creating table [random_time_series] reference')
    obj = db.session.query(TBL).filter_by(table_name=tbl_name, database=sample_db,
                                          schema=schema).first()
    if not obj:
        obj = TBL(table_name=tbl_name, database=sample_db, schema=schema)
    obj.main_dttm_col = mlc('ds')
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        'granularity_sqla': 'day',
        'row_limit': config.get('ROW_LIMIT'),
        'since': '1 year ago',
        'until': 'now',
        'metric': 'count',
        'where': '',
        'viz_type': 'cal_heatmap',
        'domain_granularity': 'month',
        'subdomain_granularity': 'day',
    }

    print('Creating a slice')
    slc = Slice(
        slice_name='Calendar Heatmap',
        viz_type='cal_heatmap',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
