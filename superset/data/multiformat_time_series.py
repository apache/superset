import gzip
import os

import pandas as pd
from sqlalchemy import BigInteger, Date, DateTime, String

from superset import db
from superset.utils import core as utils
from .helpers import (
    config,
    DATA_FOLDER,
    get_slice_json,
    merge_slice,
    misc_dash_slices,
    Slice,
    TBL,
)


def load_multiformat_time_series():
    """Loading time series data from a zip file in the repo"""
    with gzip.open(os.path.join(DATA_FOLDER, 'multiformat_time_series.json.gz')) as f:
        pdf = pd.read_json(f)
    pdf.ds = pd.to_datetime(pdf.ds, unit='s')
    pdf.ds2 = pd.to_datetime(pdf.ds2, unit='s')
    pdf.to_sql(
        'multiformat_time_series',
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'ds': Date,
            'ds2': DateTime,
            'epoch_s': BigInteger,
            'epoch_ms': BigInteger,
            'string0': String(100),
            'string1': String(100),
            'string2': String(100),
            'string3': String(100),
        },
        index=False)
    print('Done loading table!')
    print('-' * 80)
    print('Creating table [multiformat_time_series] reference')
    obj = db.session.query(TBL).filter_by(table_name='multiformat_time_series').first()
    if not obj:
        obj = TBL(table_name='multiformat_time_series')
    obj.main_dttm_col = 'ds'
    obj.database = utils.get_or_create_main_db()
    dttm_and_expr_dict = {
        'ds': [None, None],
        'ds2': [None, None],
        'epoch_s': ['epoch_s', None],
        'epoch_ms': ['epoch_ms', None],
        'string2': ['%Y%m%d-%H%M%S', None],
        'string1': ['%Y-%m-%d^%H:%M:%S', None],
        'string0': ['%Y-%m-%d %H:%M:%S.%f', None],
        'string3': ['%Y/%m/%d%H:%M:%S.%f', None],
    }
    for col in obj.columns:
        dttm_and_expr = dttm_and_expr_dict[col.column_name]
        col.python_date_format = dttm_and_expr[0]
        col.dbatabase_expr = dttm_and_expr[1]
        col.is_dttm = True
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    print('Creating Heatmap charts')
    for i, col in enumerate(tbl.columns):
        slice_data = {
            'metrics': ['count'],
            'granularity_sqla': col.column_name,
            'row_limit': config.get('ROW_LIMIT'),
            'since': '1 year ago',
            'until': 'now',
            'where': '',
            'viz_type': 'cal_heatmap',
            'domain_granularity': 'month',
            'subdomain_granularity': 'day',
        }

        slc = Slice(
            slice_name='Calendar Heatmap multiformat ' + str(i),
            viz_type='cal_heatmap',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(slice_data),
        )
        merge_slice(slc)
    misc_dash_slices.add(slc.slice_name)
