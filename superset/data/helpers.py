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
from io import BytesIO
import json
import os
import zlib

import requests

import pandas as pd

from sqlalchemy import func
from sqlalchemy.sql.type_api import TypeEngine
from sqlalchemy.sql import column

from typing import Dict, Optional

from superset import app, conf, db
from superset.connectors.connector_registry import ConnectorRegistry
from superset.db_engine_specs import BaseEngineSpec
from superset.models import core as models
from superset.utils import core as utils

BASE_URL = 'https://github.com/apache-superset/examples-data/blob/master/'

# Shortcuts
DB = models.Database
Slice = models.Slice
Dash = models.Dashboard

TBL = ConnectorRegistry.sources['table']

config = app.config

DATA_FOLDER = os.path.join(config.get('BASE_DIR'), 'data')

misc_dash_slices = set()  # slices assembled in a 'Misc Chart' dashboard

SQLA_FUNCS = {
    'avg': func.AVG,
    'max': func.MAX,
    'sum': func.SUM,
}

def update_slice_ids(layout_dict, slices):
    charts = [
        component for component in layout_dict.values()
        if isinstance(component, dict) and component['type'] == 'CHART'
    ]
    sorted_charts = sorted(charts, key=lambda k: k['meta']['chartId'])
    for i, chart_component in enumerate(sorted_charts):
        if i < len(slices):
            chart_component['meta']['chartId'] = int(slices[i].id)


def merge_slice(slc):
    o = db.session.query(Slice).filter_by(slice_name=slc.slice_name).first()
    if o:
        db.session.delete(o)
    db.session.add(slc)
    db.session.commit()


def get_slice_json(defaults, **kwargs):
    d = defaults.copy()
    d.update(kwargs)
    return json.dumps(d, indent=4, sort_keys=True)


def get_example_data(filepath, is_gzip=True, make_bytes=False):
    content = requests.get(f'{BASE_URL}{filepath}?raw=true').content
    if is_gzip:
        content = zlib.decompress(content, zlib.MAX_WBITS|16)
    if make_bytes:
        content = BytesIO(content)
    return content


def make_dtype_columns_compatible(dtypes: Dict[str, TypeEngine],
                                  db_engine_spec: BaseEngineSpec) \
        -> Dict[str, TypeEngine]:
    return {str(db_engine_spec.make_label_compatible(col)): dtype
            for col, dtype in dtypes.items()}


def make_df_columns_compatible(df: pd.DataFrame,
                               db_engine_spec: BaseEngineSpec) -> pd.DataFrame:
    cols = {col: str(db_engine_spec.make_label_compatible(col)) for col in df.columns}
    return df.rename(columns=cols)


def get_compiled_column_name(colname: str, db: models.Database) -> str:
    """ Compile a SQL column name using dialect-specific quoting rules.
    If colname is `MyMixedCaseColumn`, the function would return `"MyMixedCaseColumn"` on
    Postgres. Similarly the column `lowercase_col` would return `lowercase_col`.

    :param colname: column name
    :param db: Database instance with an engine and dialect
    :return: compiled column name
    """
    col = column(db.db_engine_spec.make_label_compatible(colname))
    return str(col.compile(db.get_sqla_engine()))


def get_aggr_expression(metric_name: str, db: models.Database) -> str:
    """ Compile a SQL expression using dialect-specific quoting rules.
    Assumes that the first three letters in metric name define the aggretation
    function, followed by two underscores and the reference column. Example:
    `avg__MyMixedCaseColumn` would be rendered to `AVG("MyMixedCaseColumn")` on
    Postgres. Similarly the column `avg_lowercase_col` would return `AVG(lowercase_col)`.

    :param metric_name: The alias of the metric
    :param db: Database instance with an engine and dialect
    :return: compiled aggregate expression
    """
    aggregate_func = metric_name[:3]
    col = db.db_engine_spec.make_label_compatible(metric_name[5:])
    sqla_expr = SQLA_FUNCS[aggregate_func.lower()](column(col))
    return str(sqla_expr.compile(db.get_sqla_engine()))


def get_sample_data_db() -> models.Database:
    """ Get sample data database if defined, otherwise use main database.

    :return: Database instance
    """
    db_name = conf.get('SAMPLE_DATA_DB_DATASOURCE_NAME')
    if db_name:
        return (
            db.session.query(models.Database)
            .filter_by(database_name=db_name)
            .first()
        )
    else:
        return utils.get_or_create_main_db()


def get_sample_data_schema() -> Optional[str]:
    """ Get sample data schema if defined.

    :return: schema name if defined, otherwise None
    """
    from superset import conf
    return conf.get('SAMPLE_DATA_DB_SCHEMA_NAME')
