import gzip
import json
import os

import pandas as pd
from sqlalchemy import String, DateTime

from panoramix import app, db, models, utils

config = app.config

DATA_FOLDER = os.path.join(config.get("BASE_DIR"), 'data')


def get_or_create_db(session):
    print("Creating database reference")
    DB = models.Database
    dbobj = session.query(DB).filter_by(database_name='main').first()
    if not dbobj:
        dbobj = DB(database_name="main")
    print(config.get("SQLALCHEMY_DATABASE_URI"))
    dbobj.sqlalchemy_uri = config.get("SQLALCHEMY_DATABASE_URI")
    session.add(dbobj)
    session.commit()
    return dbobj


def load_world_bank_health_n_pop():
    tbl = 'wb_health_population'
    with gzip.open(os.path.join(DATA_FOLDER, 'countries.json.gz')) as f:
        pdf = pd.read_json(f)
    pdf.year = pd.to_datetime(pdf.year)
    pdf.to_sql(
        tbl,
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'year': DateTime(),
            'country_code': String(3),
            'country_name': String(255),
            'region': String(255),
        },
        index=False)
    print("Creating table reference")
    TBL = models.SqlaTable
    obj = db.session.query(TBL).filter_by(table_name=tbl).first()
    if not obj:
        obj = TBL(table_name='wb_health_population')
    obj.description = utils.readfile(os.path.join(DATA_FOLDER, 'countries.md'))
    obj.main_dttm_col = 'year'
    obj.database = get_or_create_db(db.session)
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()


def load_birth_names():
    session = db.session
    with gzip.open(os.path.join(DATA_FOLDER, 'birth_names.json.gz')) as f:
        pdf = pd.read_json(f)
    pdf.ds = pd.to_datetime(pdf.ds, unit='ms')
    pdf.to_sql(
        'birth_names',
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'ds': DateTime,
            'gender': String(16),
            'state': String(10),
            'name': String(255),
        },
        index=False)
    l = []
    print("Done loading table!")
    print("-" * 80)

    print("Creating table reference")
    TBL = models.SqlaTable
    obj = db.session.query(TBL).filter_by(table_name='birth_names').first()
    if not obj:
        obj = TBL(table_name = 'birth_names')
    obj.main_dttm_col = 'ds'
    obj.database = get_or_create_db(db.session)
    models.Table
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    print("Creating some slices")
    def get_slice_json(**kwargs):
        defaults = {
            "compare_lag": "10",
            "compare_suffix": "o10Y",
            "datasource_id": "1",
            "datasource_name": "birth_names",
            "datasource_type": "table",
            "limit": "25",
            "flt_col_1": "gender",
            "flt_eq_1": "",
            "flt_op_1": "in",
            "granularity": "ds",
            "groupby": [],
            "metric": 'sum__num',
            "metrics": ["sum__num"],
            "row_limit": config.get("ROW_LIMIT"),
            "since": "100 years",
            "until": "now",
            "viz_type": "table",
            "where": "",
            "markup_type": "markdown",
        }
        d = defaults.copy()
        d.update(kwargs)
        return json.dumps(d, indent=4, sort_keys=True)
    Slice = models.Slice
    slices = []

    def merge_slice(slc):
        o = db.session.query(
            Slice).filter_by(slice_name=slc.slice_name).first()
        if o:
            db.session.delete(slc)
        db.session.add(slc)
        session.commit()
        slices.append(slc)

    merge_slice(
        Slice(
            slice_name="Girls",
            viz_type='table',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                groupby=['name'], flt_eq_1="girl", row_limit=50)))

    merge_slice(
        Slice(
            slice_name="Boys",
            viz_type='table',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                groupby=['name'], flt_eq_1="boy", row_limit=50)))

    merge_slice(
        Slice(
            slice_name="Participants",
            viz_type='big_number',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                viz_type="big_number", granularity="ds",
                compare_lag="5", compare_suffix="over 5Y")))

    merge_slice(
        Slice(
            slice_name="Genders",
            viz_type='pie',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                viz_type="pie", groupby=['gender'])))

    merge_slice(
        Slice(
            slice_name="Genders by State",
            viz_type='dist_bar',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                flt_eq_1="other", viz_type="dist_bar",
                metrics=['sum__sum_girls', 'sum__sum_boys'],
                groupby=['state'], flt_op_1='not in', flt_col_1='state')))

    merge_slice(
        Slice(
            slice_name="Trends",
            viz_type='line',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                viz_type="line", groupby=['name'],
                granularity='ds', rich_tooltip='y', show_legend='y')))

    code = """
    <div style="text-align:center">
        <h1>Birth Names Dashboard</h1>
        <p>The source dataset came from <a href="https://github.com/hadley/babynames">[here]</a></p>
        <img src="http://monblog.system-linux.net/image/tux/baby-tux_overlord59-tux.png">
    </div>
    """
    merge_slice(
        Slice(
            slice_name="Title",
            viz_type='markup',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                viz_type="markup", markup_type="html",
                code=code)))

    merge_slice(
        Slice(
            slice_name="Name Cloud",
            viz_type='word_cloud',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                viz_type="word_cloud", size_from="10",
                series='name', size_to="70", rotation="square",
                limit='100')))

    merge_slice(
        Slice(
            slice_name="Pivot Table",
            viz_type='pivot_table',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                viz_type="pivot_table", metrics=['sum__num'],
                groupby=['name'], columns=['state'])))

    print("Creating a dashboard")
    Dash = models.Dashboard
    dash = session.query(Dash).filter_by(dashboard_title="Births").first()

    if dash:
        db.session.delete(dash)
    js = """
[
    {
        "size_y": 4,
        "size_x": 2,
        "col": 8,
        "slice_id": "85",
        "row": 7
    },
    {
        "size_y": 4,
        "size_x": 2,
        "col": 10,
        "slice_id": "86",
        "row": 7
    },
    {
        "size_y": 2,
        "size_x": 2,
        "col": 1,
        "slice_id": "87",
        "row": 1
    },
    {
        "size_y": 2,
        "size_x": 2,
        "col": 3,
        "slice_id": "88",
        "row": 1
    },
    {
        "size_y": 3,
        "size_x": 7,
        "col": 5,
        "slice_id": "89",
        "row": 4
    },
    {
        "size_y": 4,
        "size_x": 7,
        "col": 1,
        "slice_id": "90",
        "row": 7
    },
    {
        "size_y": 3,
        "size_x": 3,
        "col": 9,
        "slice_id": "91",
        "row": 1
    },
    {
        "size_y": 3,
        "size_x": 4,
        "col": 5,
        "slice_id": "92",
        "row": 1
    },
    {
        "size_y": 4,
        "size_x": 4,
        "col": 1,
        "slice_id": "93",
        "row": 3
    }
]
        """
    l = json.loads(js)
    for i, pos in enumerate(l):
        pos['slice_id'] = str(slices[i].id)
    dash = Dash(
        dashboard_title="Births",
        position_json=json.dumps(l, indent=4),
    )
    for s in slices:
        dash.slices.append(s)
    session.commit()
