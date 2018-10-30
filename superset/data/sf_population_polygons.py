import gzip
import json
import os

import pandas as pd
from sqlalchemy import BigInteger, Text

from superset import db
from superset.utils import core as utils
from .helpers import DATA_FOLDER, TBL


def load_sf_population_polygons():
    tbl_name = 'sf_population_polygons'

    with gzip.open(os.path.join(DATA_FOLDER, 'sf_population.json.gz')) as f:
        df = pd.read_json(f)
        df['contour'] = df.contour.map(json.dumps)

    df.to_sql(
        tbl_name,
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'zipcode': BigInteger,
            'population': BigInteger,
            'contour': Text,
            'area': BigInteger,
        },
        index=False)
    print('Creating table {} reference'.format(tbl_name))
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = 'Population density of San Francisco'
    tbl.database = utils.get_or_create_main_db()
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
