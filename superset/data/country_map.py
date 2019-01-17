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
import os

import pandas as pd
from sqlalchemy import BigInteger, Date, String

from superset import db
from superset.connectors.sqla.models import SqlMetric
from superset.utils import core as utils
from .helpers import (
    DATA_FOLDER,
    get_slice_json,
    merge_slice,
    misc_dash_slices,
    Slice,
    TBL,
)


def load_country_map_data():
    """Loading data for map with country map"""
    csv_path = os.path.join(DATA_FOLDER, 'birth_france_data_for_country_map.csv')
    data = pd.read_csv(csv_path, encoding='utf-8')
    data['dttm'] = datetime.datetime.now().date()
    data.to_sql(  # pylint: disable=no-member
        'birth_france_by_region',
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
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
        },
        index=False)
    print('Done loading table!')
    print('-' * 80)
    print('Creating table reference')
    obj = db.session.query(TBL).filter_by(table_name='birth_france_by_region').first()
    if not obj:
        obj = TBL(table_name='birth_france_by_region')
    obj.main_dttm_col = 'dttm'
    obj.database = utils.get_or_create_main_db()
    if not any(col.metric_name == 'avg__2004' for col in obj.metrics):
        obj.metrics.append(SqlMetric(
            metric_name='avg__2004',
            expression='AVG(2004)',
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
        'entity': 'DEPT_ID',
        'metric': {
            'expressionType': 'SIMPLE',
            'column': {
                'type': 'INT',
                'column_name': '2004',
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
