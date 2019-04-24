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
"""Loads datasets, dashboards and slices in a new superset instance"""
# pylint: disable=C,R,W
import pandas as pd
from sqlalchemy import Float, String

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


def load_energy():
    """Loads an energy related dataset to use with sankey and graphs"""
    sample_db = get_sample_data_db()
    schema = get_sample_data_schema()
    cm = sample_db.db_engine_spec.make_label_compatible
    tbl_name = 'energy_usage'
    data = get_example_data('energy.json.gz')
    pdf = pd.read_json(data)
    pdf = make_df_columns_compatible(pdf, sample_db.db_engine_spec)
    dtypes = make_dtype_columns_compatible({
        'source': String(255),
        'target': String(255),
        'value': Float(),
    }, sample_db.db_engine_spec)
    sample_db.db_engine_spec.df_to_sql(pdf,
                                       name=tbl_name,
                                       con=sample_db.get_sqla_engine(),
                                       schema=schema,
                                       if_exists='replace',
                                       chunksize=500,
                                       dtype=dtypes,
                                       index=False,
                                       )

    print('Creating table [wb_health_population] reference')
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name, database=sample_db,
                                          schema=schema).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name, database=sample_db, schema=schema)
    tbl.description = 'Energy consumption'

    if not any(col.metric_name == 'sum__value' for col in tbl.metrics):
        metric_name = 'sum__value'
        expression = get_expression(metric_name, sample_db)
        tbl.metrics.append(SqlMetric(
            metric_name=metric_name,
            expression=expression,
        ))

    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
    
    slice_data = {
        'collapsed_fieldsets': '',
        'groupby': [
            cm('source'),
            cm('target'),
        ],
        'having': '',
        'metric': 'sum__value',
        'row_limit': '5000',
        'slice_name': 'Energy Sankey',
        'viz_type': 'sankey',
        'where': ''
    }

    slc = Slice(
        slice_name='Energy Sankey',
        viz_type='sankey',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data)
    )
    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)

    slice_data = {
        'charge': '-500',
        'collapsed_fieldsets': '',
        'groupby': [
            cm('source'),
            cm('target'),
        ],
        'having': '',
        'link_length': '200',
        'metric': 'sum__value',
        'row_limit': '5000',
        'slice_name': 'Force',
        'viz_type': 'directed_force',
        'where': ''
    }
    slc = Slice(
        slice_name='Energy Force Layout',
        viz_type='directed_force',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)

    slice_data = {
        'all_columns_x': cm('source'),
        'all_columns_y': cm('target'),
        'canvas_image_rendering': 'pixelated',
        'collapsed_fieldsets': '',
        'having': '',
        'linear_color_scheme': 'blue_white_yellow',
        'metric': 'sum__value',
        'normalize_across': 'heatmap',
        'slice_name': 'Heatmap',
        'viz_type': 'heatmap',
        'where': '',
        'xscale_interval': '1',
        'yscale_interval': '1'
    }
    slc = Slice(
        slice_name='Heatmap',
        viz_type='heatmap',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)
