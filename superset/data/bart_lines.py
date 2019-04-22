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
import polyline
from sqlalchemy import String, Text

from superset import db
from .helpers import (
    TBL,
    get_example_data,
    get_sample_data_db,
    get_sample_data_schema,
    make_df_columns_compatible,
    make_dtype_columns_compatible,
)


def load_bart_lines():
    sample_db = get_sample_data_db()
    schema = get_sample_data_schema()
    tbl_name = 'bart_lines'
    content = get_example_data('bart-lines.json.gz')
    df = pd.read_json(content, encoding='latin-1')
    df['path_json'] = df.path.map(json.dumps)
    df['polyline'] = df.path.map(polyline.encode)
    del df['path']
    df = make_df_columns_compatible(df, sample_db.db_engine_spec)
    dtypes = make_dtype_columns_compatible({
            'color': String(255),
            'name': String(255),
            'polyline': Text,
            'path_json': Text,
        }, sample_db.db_engine_spec)

    df.to_sql(
        name=tbl_name,
        con=sample_db.get_sqla_engine(),
        schema=schema,
        if_exists='replace',
        chunksize=500,
        dtype=dtypes,
        index=False)
    print('Creating table {} reference'.format(tbl_name))
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name, database=sample_db,
                                          schema=schema).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name, database=sample_db, schema=schema)
    tbl.description = 'BART lines'
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
