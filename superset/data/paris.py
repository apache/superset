import gzip
import json
import os

import pandas as pd
from sqlalchemy import String, Text

from superset import db
from superset.utils import core as utils
from .helpers import DATA_FOLDER, TBL


def load_paris_iris_geojson():
    tbl_name = 'paris_iris_mapping'

    with gzip.open(os.path.join(DATA_FOLDER, 'paris_iris.json.gz')) as f:
        df = pd.read_json(f)
        df['features'] = df.features.map(json.dumps)

    df.to_sql(
        tbl_name,
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'color': String(255),
            'name': String(255),
            'features': Text,
            'type': Text,
        },
        index=False)
    print('Creating table {} reference'.format(tbl_name))
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = 'Map of Paris'
    tbl.database = utils.get_or_create_main_db()
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
