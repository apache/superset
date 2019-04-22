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
from sqlalchemy import BigInteger, Date, String

from superset import db
from superset.connectors.sqla.models import SqlMetric
from .helpers import (
    get_example_data,
    get_expression,
    get_sample_data_db,
    get_sample_data_schema,
    get_slice_json,
    make_df_columns_compatible,
    make_dtype_columns_compatible,
    merge_slice,
    misc_dash_slices,
    Slice,
    TBL,
)


def load_country_map_data():
    """Loading data for map with country map"""
    sample_db = get_sample_data_db()
    schema = get_sample_data_schema()
    c = sample_db.db_engine_spec.make_label_compatible
    tbl_name = 'birth_france_by_region'
    csv_bytes = get_example_data(
        'birth_france_data_for_country_map.csv', is_gzip=False, make_bytes=True)
    data = pd.read_csv(csv_bytes, encoding='utf-8')
    data['dttm'] = datetime.datetime.now().date()
    data = make_df_columns_compatible(data, sample_db.db_engine_spec)
    dtypes = make_dtype_columns_compatible({
            'DEPT_ID': String(10),
            '2003': BigInteger,
            '2004': BigInteger,
            '2005': BigInteger,
            '2006': BigInteger,
            '2007': BigInteger,
            '2008': BigInteger,
            '2009': BigInteger,
            '2010': BigInteger,
            '2011': BigInteger,
            '2012': BigInteger,
            '2013': BigInteger,
            '2014': BigInteger,
            'dttm': Date(),
        }, sample_db.db_engine_spec)
    data.to_sql(  # pylint: disable=no-member
        name=tbl_name,
        con=sample_db.get_sqla_engine(),
        schema=schema,
        if_exists='replace',
        chunksize=500,
        dtype=dtypes,
        index=False)
    print('Done loading table!')
    print('-' * 80)
    print('Creating table reference')
    obj = db.session.query(TBL).filter_by(table_name=tbl_name, database=sample_db,
                                          schema=schema).first()
    if not obj:
        obj = TBL(table_name=tbl_name, database=sample_db, schema=schema)
    obj.main_dttm_col = c('dttm')
    if not any(col.metric_name == 'avg__2004' for col in obj.metrics):
        metric_name = 'avg__2004'
        obj.metrics.append(SqlMetric(
            metric_name=metric_name,
            expression=get_expression(metric_name, sample_db),
        ))
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        'granularity_sqla': '',
        'since': '',
        'until': '',
        'where': '',
        'viz_type': 'country_map',
        'entity': c('DEPT_ID'),
        'metric': {
            'expressionType': 'SIMPLE',
            'column': {
                'type': 'INT',
                'column_name': c('2004'),
            },
            'aggregate': 'AVG',
            'label': 'Boys',
            'optionName': 'metric_112342',
        },
        'row_limit': 500000,
    }

    print('Creating a slice')
    slc = Slice(
        slice_name='Birth in France by department in 2016',
        viz_type='country_map',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)
