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
import gzip
import os
import textwrap

import pandas as pd
from sqlalchemy import Float, String

from superset import db
from superset.connectors.sqla.models import SqlMetric
from superset.utils import core as utils
from .helpers import DATA_FOLDER, merge_slice, misc_dash_slices, Slice, TBL


def load_energy():
    """Loads an energy related dataset to use with sankey and graphs"""
    tbl_name = 'energy_usage'
    with gzip.open(os.path.join(DATA_FOLDER, 'energy.json.gz')) as f:
        pdf = pd.read_json(f)
    pdf.to_sql(
        tbl_name,
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'source': String(255),
            'target': String(255),
            'value': Float(),
        },
        index=False)

    print('Creating table [wb_health_population] reference')
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = 'Energy consumption'
    tbl.database = utils.get_or_create_main_db()

    if not any(col.metric_name == 'sum__value' for col in tbl.metrics):
        tbl.metrics.append(SqlMetric(
            metric_name='sum__value',
            expression='SUM(value)',
        ))

    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()

    slc = Slice(
        slice_name='Energy Sankey',
        viz_type='sankey',
        datasource_type='table',
        datasource_id=tbl.id,
        params=textwrap.dedent("""\
        {
            "collapsed_fieldsets": "",
            "groupby": [
                "source",
                "target"
            ],
            "having": "",
            "metric": "sum__value",
            "row_limit": "5000",
            "slice_name": "Energy Sankey",
            "viz_type": "sankey",
            "where": ""
        }
        """),
    )
    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)

    slc = Slice(
        slice_name='Energy Force Layout',
        viz_type='directed_force',
        datasource_type='table',
        datasource_id=tbl.id,
        params=textwrap.dedent("""\
        {
            "charge": "-500",
            "collapsed_fieldsets": "",
            "groupby": [
                "source",
                "target"
            ],
            "having": "",
            "link_length": "200",
            "metric": "sum__value",
            "row_limit": "5000",
            "slice_name": "Force",
            "viz_type": "directed_force",
            "where": ""
        }
        """),
    )
    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)

    slc = Slice(
        slice_name='Heatmap',
        viz_type='heatmap',
        datasource_type='table',
        datasource_id=tbl.id,
        params=textwrap.dedent("""\
        {
            "all_columns_x": "source",
            "all_columns_y": "target",
            "canvas_image_rendering": "pixelated",
            "collapsed_fieldsets": "",
            "having": "",
            "linear_color_scheme": "blue_white_yellow",
            "metric": "sum__value",
            "normalize_across": "heatmap",
            "slice_name": "Heatmap",
            "viz_type": "heatmap",
            "where": "",
            "xscale_interval": "1",
            "yscale_interval": "1"
        }
        """),
    )
    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)
