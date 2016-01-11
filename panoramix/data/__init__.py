from datetime import datetime
import csv
import gzip
import json
import os

from flask.ext.appbuilder import Base
import pandas as pd
from sqlalchemy import Column, String, DateTime, Table, Integer

from panoramix import app, db, models

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
    """
    Details on how the data was loaded from
    http://data.worldbank.org/data-catalog/health-nutrition-and-population-statistics
    DIR = ""
    df_country = pd.read_csv(DIR + '/HNP_Country.csv')
    df_country.columns = ['country_code'] + list(df_country.columns[1:])
    df_country = df_country[['country_code', 'Region']]
    df_country.columns = ['country_code', 'region']

    df = pd.read_csv(DIR + '/HNP_Data.csv')
    del df['Unnamed: 60']
    df.columns = ['country_name', 'country_code'] + list(df.columns[2:])
    ndf = df.merge(df_country, how='inner')

    dims = ('country_name', 'country_code', 'region')
    vv = [str(i) for i in range(1960, 2015)]
    mdf = pd.melt(ndf, id_vars=dims + ('Indicator Code',), value_vars=vv)
    mdf['year'] = mdf.variable + '-01-01'
    dims = dims + ('year',)

    pdf = mdf.pivot_table(values='value', columns='Indicator Code', index=dims)
    pdf = pdf.reset_index()
    pdf.to_csv(DIR + '/countries.csv')
    pdf.to_json(DIR + '/countries.json', orient='records')
    """
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
    obj.main_dttm_col = 'year'
    obj.database = get_or_create_db(db.session)
    models.Table
    db.session.add(obj)
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
    db.session.add(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    print("Creating some slices")
    def get_slice_json(slice_name, **kwargs):
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
            "slice_name": slice_name,
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

    slice_name = "Girls"
    slc = db.session.query(Slice).filter_by(slice_name=slice_name).first()
    if not slc:
        slc = Slice(
            slice_name=slice_name,
            viz_type='table',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                slice_name, groupby=['name'], flt_eq_1="girl", row_limit=50))
        session.add(slc)
    slices.append(slc)

    slice_name = "Boys"
    slc = session.query(Slice).filter_by(slice_name=slice_name).first()
    if not slc:
        slc = Slice(
            slice_name=slice_name,
            viz_type='table',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                slice_name, groupby=['name'], flt_eq_1="boy", row_limit=50))
        session.add(slc)
    slices.append(slc)

    slice_name = "Participants"
    slc = session.query(Slice).filter_by(slice_name=slice_name).first()
    if not slc:
        slc = Slice(
            slice_name=slice_name,
            viz_type='big_number',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                slice_name, viz_type="big_number", granularity="ds",
                compare_lag="5", compare_suffix="over 5Y"))
        session.add(slc)
    slices.append(slc)

    slice_name = "Genders"
    slc = session.query(Slice).filter_by(slice_name=slice_name).first()
    if not slc:
        slc = Slice(
            slice_name=slice_name,
            viz_type='pie',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                slice_name, viz_type="pie", groupby=['gender']))
        session.add(slc)
    slices.append(slc)

    slice_name = "Gender by State"
    slc = session.query(Slice).filter_by(slice_name=slice_name).first()
    if not slc:
        slc = Slice(
            slice_name=slice_name,
            viz_type='dist_bar',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                slice_name, flt_eq_1="other", viz_type="dist_bar",
                metrics=['sum__sum_girls', 'sum__sum_boys'],
                groupby=['state'], flt_op_1='not in', flt_col_1='state'))
        session.add(slc)
    slices.append(slc)

    slice_name = "Trends"
    slc = session.query(Slice).filter_by(slice_name=slice_name).first()
    if not slc:
        slc = Slice(
            slice_name=slice_name,
            viz_type='line',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                slice_name, viz_type="line", groupby=['name'],
                granularity='ds', rich_tooltip='y', show_legend='y'))
        session.add(slc)
    slices.append(slc)

    slice_name = "Title"
    slc = session.query(Slice).filter_by(slice_name=slice_name).first()
    code = """
### Birth Names Dashboard
The source dataset came from [here](https://github.com/hadley/babynames)

![img](http://monblog.system-linux.net/image/tux/baby-tux_overlord59-tux.png)
    """
    if not slc:
        slc = Slice(
            slice_name=slice_name,
            viz_type='markup',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                slice_name, viz_type="markup", markup_type="markdown",
                code=code))
        session.add(slc)
    slices.append(slc)

    slice_name = "Name Cloud"
    slc = session.query(Slice).filter_by(slice_name=slice_name).first()
    if not slc:
        slc = Slice(
            slice_name=slice_name,
            viz_type='word_cloud',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                slice_name, viz_type="word_cloud", size_from="10",
                series='name', size_to="70", rotation="square",
                limit='100'))
        session.add(slc)
    slices.append(slc)

    slice_name = "Pivot Table"
    slc = session.query(Slice).filter_by(slice_name=slice_name).first()
    if not slc:
        slc = Slice(
            slice_name=slice_name,
            viz_type='pivot_table',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                slice_name, viz_type="pivot_table", metrics=['sum__num'],
                groupby=['name'], columns=['state']))
        session.add(slc)
    slices.append(slc)

    print("Creating a dashboard")
    Dash = models.Dashboard
    dash = session.query(Dash).filter_by(dashboard_title="Births").first()
    if not dash:
        dash = Dash(
            dashboard_title="Births",
            position_json="""
            [
                {
                    "size_y": 4,
                    "size_x": 2,
                    "col": 3,
                    "slice_id": "1",
                    "row": 3
                },
                {
                    "size_y": 4,
                    "size_x": 2,
                    "col": 1,
                    "slice_id": "2",
                    "row": 3
                },
                {
                    "size_y": 2,
                    "size_x": 2,
                    "col": 1,
                    "slice_id": "3",
                    "row": 1
                },
                {
                    "size_y": 2,
                    "size_x": 2,
                    "col": 3,
                    "slice_id": "4",
                    "row": 1
                },
                {
                    "size_y": 3,
                    "size_x": 7,
                    "col": 5,
                    "slice_id": "5",
                    "row": 4
                },
                {
                    "size_y": 5,
                    "size_x": 11,
                    "col": 1,
                    "slice_id": "6",
                    "row": 7
                },
                {
                    "size_y": 3,
                    "size_x": 3,
                    "col": 9,
                    "slice_id": "7",
                    "row": 1
                },
                {
                    "size_y": 3,
                    "size_x": 4,
                    "col": 5,
                    "slice_id": "8",
                    "row": 1
                }
            ]
            """
        )
        session.add(dash)
    for s in slices:
        dash.slices.append(s)
    session.commit()
