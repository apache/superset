import datetime
import os

import pandas as pd
from sqlalchemy import BigInteger, Date, String

from superset import db
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
        'metric': 'avg__2004',
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
