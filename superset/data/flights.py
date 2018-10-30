import gzip
import os

import pandas as pd
from sqlalchemy import DateTime

from superset import db
from superset.utils import core as utils
from .helpers import DATA_FOLDER, TBL


def load_flights():
    """Loading random time series data from a zip file in the repo"""
    tbl_name = 'flights'
    with gzip.open(os.path.join(DATA_FOLDER, 'fligth_data.csv.gz')) as f:
        pdf = pd.read_csv(f, encoding='latin-1')

    # Loading airports info to join and get lat/long
    with gzip.open(os.path.join(DATA_FOLDER, 'airports.csv.gz')) as f:
        airports = pd.read_csv(f, encoding='latin-1')
    airports = airports.set_index('IATA_CODE')

    pdf['ds'] = pdf.YEAR.map(str) + '-0' + pdf.MONTH.map(str) + '-0' + pdf.DAY.map(str)
    pdf.ds = pd.to_datetime(pdf.ds)
    del pdf['YEAR']
    del pdf['MONTH']
    del pdf['DAY']

    pdf = pdf.join(airports, on='ORIGIN_AIRPORT', rsuffix='_ORIG')
    pdf = pdf.join(airports, on='DESTINATION_AIRPORT', rsuffix='_DEST')
    pdf.to_sql(
        tbl_name,
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'ds': DateTime,
        },
        index=False)
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = 'Random set of flights in the US'
    tbl.database = utils.get_or_create_main_db()
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
    print('Done loading table!')
