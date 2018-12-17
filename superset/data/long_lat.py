import datetime
import gzip
import os
import random

import geohash
import pandas as pd
from sqlalchemy import DateTime, Float, String

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


def load_long_lat_data():
    """Loading lat/long data from a csv file in the repo"""
    with gzip.open(os.path.join(DATA_FOLDER, 'san_francisco.csv.gz')) as f:
        pdf = pd.read_csv(f, encoding='utf-8')
    start = datetime.datetime.now().replace(
        hour=0, minute=0, second=0, microsecond=0)
    pdf['datetime'] = [
        start + datetime.timedelta(hours=i * 24 / (len(pdf) - 1))
        for i in range(len(pdf))
    ]
    pdf['occupancy'] = [random.randint(1, 6) for _ in range(len(pdf))]
    pdf['radius_miles'] = [random.uniform(1, 3) for _ in range(len(pdf))]
    pdf['geohash'] = pdf[['LAT', 'LON']].apply(
        lambda x: geohash.encode(*x), axis=1)
    pdf['delimited'] = pdf['LAT'].map(str).str.cat(pdf['LON'].map(str), sep=',')
    pdf.to_sql(  # pylint: disable=no-member
        'long_lat',
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'longitude': Float(),
            'latitude': Float(),
            'number': Float(),
            'street': String(100),
            'unit': String(10),
            'city': String(50),
            'district': String(50),
            'region': String(50),
            'postcode': Float(),
            'id': String(100),
            'datetime': DateTime(),
            'occupancy': Float(),
            'radius_miles': Float(),
            'geohash': String(12),
            'delimited': String(60),
        },
        index=False)
    print('Done loading table!')
    print('-' * 80)

    print('Creating table reference')
    obj = db.session.query(TBL).filter_by(table_name='long_lat').first()
    if not obj:
        obj = TBL(table_name='long_lat')
    obj.main_dttm_col = 'datetime'
    obj.database = utils.get_or_create_main_db()
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        'granularity_sqla': 'day',
        'since': '2014-01-01',
        'until': 'now',
        'where': '',
        'viz_type': 'mapbox',
        'all_columns_x': 'LON',
        'all_columns_y': 'LAT',
        'mapbox_style': 'mapbox://styles/mapbox/light-v9',
        'all_columns': ['occupancy'],
        'row_limit': 500000,
    }

    print('Creating a slice')
    slc = Slice(
        slice_name='Mapbox Long/Lat',
        viz_type='mapbox',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)
