import gzip
import json
import os
import textwrap

import pandas as pd
from sqlalchemy import String, DateTime

from panoramix import app, db, models, utils

# Shortcuts
DB = models.Database
Slice = models.Slice
TBL = models.SqlaTable
Dash = models.Dashboard

config = app.config

DATA_FOLDER = os.path.join(config.get("BASE_DIR"), 'data')


def get_or_create_db(session):
    print("Creating database reference")
    dbobj = session.query(DB).filter_by(database_name='main').first()
    if not dbobj:
        dbobj = DB(database_name="main")
    print(config.get("SQLALCHEMY_DATABASE_URI"))
    dbobj.sqlalchemy_uri = config.get("SQLALCHEMY_DATABASE_URI")
    session.add(dbobj)
    session.commit()
    return dbobj


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


def load_world_bank_health_n_pop():
    tbl_name = 'wb_health_population'
    with gzip.open(os.path.join(DATA_FOLDER, 'countries.json.gz')) as f:
        pdf = pd.read_json(f)
    pdf.columns = [col.replace('.', '_') for col in pdf.columns]
    pdf.year = pd.to_datetime(pdf.year)
    pdf.to_sql(
        tbl_name,
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

    print("Creating table [wb_health_population] reference")
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = utils.readfile(os.path.join(DATA_FOLDER, 'countries.md'))
    tbl.main_dttm_col = 'year'
    tbl.is_featured = True
    tbl.database = get_or_create_db(db.session)
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()

    defaults = {
        "compare_lag": "10",
        "compare_suffix": "o10Y",
        "datasource_id": "1",
        "datasource_name": "birth_names",
        "datasource_type": "table",
        "limit": "25",
        "granularity": "year",
        "groupby": [],
        "metric": 'sum__SP_POP_TOTL',
        "metrics": ["sum__SP_POP_TOTL"],
        "row_limit": config.get("ROW_LIMIT"),
        "since": "2014-01-01",
        "until": "2014-01-01",
        "where": "",
        "markup_type": "markdown",
        "country_fieldtype": "cca3",
        "secondary_metric": "sum__SP_POP_TOTL",
        "entity": "country_code",
        "show_bubbles": "y",
    }

    print("Creating slices")
    slices = [
        Slice(
            slice_name="Region Filter",
            viz_type='filter_box',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type='filter_box',
                groupby=['region'],
                )),
        Slice(
            slice_name="World's Population",
            viz_type='big_number',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                since='2000',
                viz_type='big_number',
                compare_lag="10",
                metric='sum__SP_POP_TOTL',
                compare_suffix="over 10Y")),
        Slice(
            slice_name="Most Populated Countries",
            viz_type='table',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type='table',
                metrics=["sum__SP_POP_TOTL"],
                groupby=['country_name'])),
        Slice(
            slice_name="Growth Rate",
            viz_type='line',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type='line',
                since="1960-01-01",
                metrics=["sum__SP_POP_TOTL"],
                num_period_compare="10",
                groupby=['country_name'])),
        Slice(
            slice_name="% Rural",
            viz_type='world_map',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type='world_map',
                metric= "sum__SP_RUR_TOTL_ZS",
                num_period_compare="10",)),
        Slice(
            slice_name="Life Expexctancy VS Rural %",
            viz_type='bubble',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type='bubble',
                since= "2011-01-01",
                until= "2011-01-01",
                series="region",
                limit="0",
                entity="country_name",
                x="sum__SP_RUR_TOTL_ZS",
                y="sum__SP_DYN_LE00_IN",
                size="sum__SP_POP_TOTL",
                max_bubble_size="50",
                flt_col_1="country_code",
                flt_op_1= "not in",
                flt_eq_1="TCA,MNP,DMA,MHL,MCO,SXM,CYM,TUV,IMY,KNA,ASM,ADO,AMA,PLW",
                num_period_compare="10",)),
        Slice(
            slice_name="Rural Breakdown",
            viz_type='sunburst',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type='sunburst',
                groupby=["region", "country_name"],
                secondary_metric="sum__SP_RUR_TOTL",
                since= "2011-01-01",
                until= "2011-01-01",)),
        Slice(
            slice_name="World's Pop Growth",
            viz_type='area',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                since="1960-01-01",
                until="now",
                viz_type='area',
                groupby=["region"],)),
    ]
    for slc in slices:
        merge_slice(slc)

    print("Creating a World's Health Bank dashboard")
    dash_name = "World's Health Bank Dashboard"
    dash = db.session.query(Dash).filter_by(dashboard_title=dash_name).first()

    if dash:
        db.session.delete(dash)
    js = """\
[
    {
        "size_y": 1,
        "size_x": 3,
        "col": 1,
        "slice_id": "269",
        "row": 1
    },
    {
        "size_y": 3,
        "size_x": 3,
        "col": 1,
        "slice_id": "270",
        "row": 2
    },
    {
        "size_y": 7,
        "size_x": 3,
        "col": 10,
        "slice_id": "271",
        "row": 1
    },
    {
        "size_y": 3,
        "size_x": 6,
        "col": 1,
        "slice_id": "272",
        "row": 5
    },
    {
        "size_y": 4,
        "size_x": 6,
        "col": 4,
        "slice_id": "273",
        "row": 1
    },
    {
        "size_y": 4,
        "size_x": 6,
        "col": 7,
        "slice_id": "274",
        "row": 8
    },
    {
        "size_y": 3,
        "size_x": 3,
        "col": 7,
        "slice_id": "275",
        "row": 5
    },
    {
        "size_y": 4,
        "size_x": 6,
        "col": 1,
        "slice_id": "276",
        "row": 8
    }
]
    """
    l = json.loads(js)
    for i, pos in enumerate(l):
        pos['slice_id'] = str(slices[i].id)
    dash = Dash(
        dashboard_title=dash_name,
        position_json=json.dumps(l, indent=4),
        slug="world_health",
    )
    for s in slices:
        dash.slices.append(s)
    db.session.commit()


def load_css_templates():
    print('Creating default CSS templates')
    CSS = models.CssTemplate

    obj = db.session.query(CSS).filter_by(template_name='Flat').first()
    if not obj:
        obj = CSS(template_name="Flat")
    css = textwrap.dedent("""\
    .gridster li.widget {
        transition: background-color 0.5s ease;
        background-color: #FAFAFA;
        border: 1px solid #CCC;
        overflow: hidden;
        box-shadow: none;
        border-radius: 0px;
    }
    .gridster li.widget:hover {
        border: 1px solid #000;
        background-color: #EAEAEA;
    }
    .navbar {
        transition: opacity 0.5s ease;
        opacity: 0.05;
    }
    .navbar:hover {
        opacity: 1;
    }
    .chart-header .header{
        font-weight: normal;
        font-size: 12px;
    }
    /*
    var bnbColors = [
        //rausch    hackb      kazan      babu      lima        beach     tirol
        '#ff5a5f', '#7b0051', '#007A87', '#00d1c1', '#8ce071', '#ffb400', '#b4a76c',
        '#ff8083', '#cc0086', '#00a1b3', '#00ffeb', '#bbedab', '#ffd266', '#cbc29a',
        '#ff3339', '#ff1ab1', '#005c66', '#00b3a5', '#55d12e', '#b37e00', '#988b4e',
     ];
    */
    """)
    obj.css = css
    db.session.merge(obj)
    db.session.commit()

    obj = (
        db.session.query(CSS).filter_by(template_name='Courier Black').first())
    if not obj:
        obj = CSS(template_name="Courier Black")
    css = textwrap.dedent("""\
    .gridster li.widget {
        transition: background-color 0.5s ease;
        background-color: #EEE;
        border: 2px solid #444;
        overflow: hidden;
        border-radius: 15px;
        box-shadow: none;
    }
    h2 {
        color: white;
        font-size: 52px;
    }
    .navbar {
        box-shadow: none;
    }
    .gridster li.widget:hover {
        border: 2px solid #000;
        background-color: #EAEAEA;
    }
    .navbar {
        transition: opacity 0.5s ease;
        opacity: 0.05;
    }
    .navbar:hover {
        opacity: 1;
    }
    .chart-header .header{
        font-weight: normal;
        font-size: 12px;
    }
    .nvd3 text {
        font-size: 12px;
        font-family: inherit;
    }
    body{
        background: #000;
        font-family: Courier, Monaco, monospace;;
    }
    /*
    var bnbColors = [
        //rausch    hackb      kazan      babu      lima        beach     tirol
        '#ff5a5f', '#7b0051', '#007A87', '#00d1c1', '#8ce071', '#ffb400', '#b4a76c',
        '#ff8083', '#cc0086', '#00a1b3', '#00ffeb', '#bbedab', '#ffd266', '#cbc29a',
        '#ff3339', '#ff1ab1', '#005c66', '#00b3a5', '#55d12e', '#b37e00', '#988b4e',
     ];
    */
    """)
    obj.css = css
    db.session.merge(obj)
    db.session.commit()


def load_birth_names():
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
    obj = db.session.query(TBL).filter_by(table_name='birth_names').first()
    if not obj:
        obj = TBL(table_name = 'birth_names')
    obj.main_dttm_col = 'ds'
    obj.database = get_or_create_db(db.session)
    obj.is_featured = True
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    defaults = {
        "compare_lag": "10",
        "compare_suffix": "o10Y",
        "datasource_id": "1",
        "datasource_name": "birth_names",
        "datasource_type": "table",
        "flt_op_1": "in",
        "limit": "25",
        "granularity": "ds",
        "groupby": [],
        "metric": 'sum__num',
        "metrics": ["sum__num"],
        "row_limit": config.get("ROW_LIMIT"),
        "since": "100 years ago",
        "until": "now",
        "viz_type": "table",
        "where": "",
        "markup_type": "markdown",
    }

    print("Creating some slices")
    slices = [
        Slice(
            slice_name="Girls",
            viz_type='table',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                groupby=['name'],
                flt_col_1='gender',
                flt_eq_1="girl", row_limit=50)),
        Slice(
            slice_name="Boys",
            viz_type='table',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                groupby=['name'],
                flt_col_1='gender',
                flt_eq_1="boy",
                row_limit=50)),
        Slice(
            slice_name="Participants",
            viz_type='big_number',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type="big_number", granularity="ds",
                compare_lag="5", compare_suffix="over 5Y")),
        Slice(
            slice_name="Genders",
            viz_type='pie',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type="pie", groupby=['gender'])),
        Slice(
            slice_name="Genders by State",
            viz_type='dist_bar',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                flt_eq_1="other", viz_type="dist_bar",
                metrics=['sum__sum_girls', 'sum__sum_boys'],
                groupby=['state'], flt_op_1='not in', flt_col_1='state')),
        Slice(
            slice_name="Trends",
            viz_type='line',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type="line", groupby=['name'],
                granularity='ds', rich_tooltip='y', show_legend='y')),
        Slice(
            slice_name="Title",
            viz_type='markup',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type="markup", markup_type="html",
                code="""\
<div style="text-align:center">
    <h1>Birth Names Dashboard</h1>
    <p>
        The source dataset came from
        <a href="https://github.com/hadley/babynames">[here]</a>
    </p>
    <img src="http://monblog.system-linux.net/image/tux/baby-tux_overlord59-tux.png">
</div>
"""
                )),
        Slice(
            slice_name="Name Cloud",
            viz_type='word_cloud',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type="word_cloud", size_from="10",
                series='name', size_to="70", rotation="square",
                limit='100')),
        Slice(
            slice_name="Pivot Table",
            viz_type='pivot_table',
            datasource_type='table',
            table=tbl,
            params=get_slice_json(
                defaults,
                viz_type="pivot_table", metrics=['sum__num'],
                groupby=['name'], columns=['state'])),
    ]
    for slc in slices:
        merge_slice(slc)

    print("Creating a dashboard")
    dash = db.session.query(Dash).filter_by(dashboard_title="Births").first()

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
        slug="births",
    )
    for s in slices:
        dash.slices.append(s)
    db.session.commit()
