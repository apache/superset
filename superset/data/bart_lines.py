import gzip
import json
import os

import pandas as pd
import polyline
from sqlalchemy import String, Text

from superset import db
from superset.utils.core import get_or_create_main_db
from .helpers import DATA_FOLDER, TBL


def load_bart_lines():
    tbl_name = 'bart_lines'
    with gzip.open(os.path.join(DATA_FOLDER, 'bart-lines.json.gz')) as f:
        df = pd.read_json(f, encoding='latin-1')
        df['path_json'] = df.path.map(json.dumps)
        df['polyline'] = df.path.map(polyline.encode)
        del df['path']
    df.to_sql(
        tbl_name,
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'color': String(255),
            'name': String(255),
            'polyline': Text,
            'path_json': Text,
        },
        index=False)
    print('Creating table {} reference'.format(tbl_name))
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = 'BART lines'
    tbl.database = get_or_create_main_db()
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
