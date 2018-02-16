"""Loads datasets, dashboards and slices in a new superset instance"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import datetime
import gzip
import json
import os
import random
import textwrap

import pandas as pd
from sqlalchemy import BigInteger, Date, DateTime, Float, String, Text
import geohash
import polyline

from superset import app, db, utils
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models import core as models
from superset.security import get_or_create_main_db

# Shortcuts
DB = models.Database
Slice = models.Slice
Dash = models.Dashboard

TBL = ConnectorRegistry.sources['table']

config = app.config

DATA_FOLDER = os.path.join(config.get("BASE_DIR"), 'data')

misc_dash_slices = []  # slices assembled in a "Misc Chart" dashboard


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


def load_energy():
    """Loads an energy related dataset to use with sankey and graphs"""
    tbl_name = 'energy_usage'
    with gzip.open(os.path.join(DATA_FOLDER, 'energy.json.gz')) as f:
        pdf = pd.read_json(f)
    pdf.to_sql(
        tbl_name,
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'source': String(255),
            'target': String(255),
            'value': Float(),
        },
        index=False)

    print("Creating table [wb_health_population] reference")
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = "Energy consumption"
    tbl.database = get_or_create_main_db()
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()

    slc = Slice(
        slice_name="Energy Sankey",
        viz_type='sankey',
        datasource_type='table',
        datasource_id=tbl.id,
        params=textwrap.dedent("""\
        {
            "collapsed_fieldsets": "",
            "groupby": [
                "source",
                "target"
            ],
            "having": "",
            "metric": "sum__value",
            "row_limit": "5000",
            "slice_name": "Energy Sankey",
            "viz_type": "sankey",
            "where": ""
        }
        """),
    )
    misc_dash_slices.append(slc.slice_name)
    merge_slice(slc)

    slc = Slice(
        slice_name="Energy Force Layout",
        viz_type='directed_force',
        datasource_type='table',
        datasource_id=tbl.id,
        params=textwrap.dedent("""\
        {
            "charge": "-500",
            "collapsed_fieldsets": "",
            "groupby": [
                "source",
                "target"
            ],
            "having": "",
            "link_length": "200",
            "metric": "sum__value",
            "row_limit": "5000",
            "slice_name": "Force",
            "viz_type": "directed_force",
            "where": ""
        }
        """),
    )
    misc_dash_slices.append(slc.slice_name)
    merge_slice(slc)

    slc = Slice(
        slice_name="Heatmap",
        viz_type='heatmap',
        datasource_type='table',
        datasource_id=tbl.id,
        params=textwrap.dedent("""\
        {
            "all_columns_x": "source",
            "all_columns_y": "target",
            "canvas_image_rendering": "pixelated",
            "collapsed_fieldsets": "",
            "having": "",
            "linear_color_scheme": "blue_white_yellow",
            "metric": "sum__value",
            "normalize_across": "heatmap",
            "slice_name": "Heatmap",
            "viz_type": "heatmap",
            "where": "",
            "xscale_interval": "1",
            "yscale_interval": "1"
        }
        """),
    )
    misc_dash_slices.append(slc.slice_name)
    merge_slice(slc)


def load_world_bank_health_n_pop():
    """Loads the world bank health dataset, slices and a dashboard"""
    tbl_name = 'wb_health_population'
    with gzip.open(os.path.join(DATA_FOLDER, 'countries.json.gz')) as f:
        pdf = pd.read_json(f)
    pdf.columns = [col.replace('.', '_') for col in pdf.columns]
    pdf.year = pd.to_datetime(pdf.year)
    pdf.to_sql(
        tbl_name,
        db.engine,
        if_exists='replace',
        chunksize=50,
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
    tbl.database = get_or_create_main_db()
    tbl.filter_select_enabled = True
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()

    defaults = {
        "compare_lag": "10",
        "compare_suffix": "o10Y",
        "limit": "25",
        "granularity": "year",
        "groupby": [],
        "metric": 'sum__SP_POP_TOTL',
        "metrics": ["sum__SP_POP_TOTL"],
        "row_limit": config.get("ROW_LIMIT"),
        "since": "2014-01-01",
        "until": "2014-01-02",
        "where": "",
        "markup_type": "markdown",
        "country_fieldtype": "cca3",
        "secondary_metric": "sum__SP_POP_TOTL",
        "entity": "country_code",
        "show_bubbles": True,
    }

    print("Creating slices")
    slices = [
        Slice(
            slice_name="Region Filter",
            viz_type='filter_box',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type='filter_box',
                groupby=['region', 'country_name'])),
        Slice(
            slice_name="World's Population",
            viz_type='big_number',
            datasource_type='table',
            datasource_id=tbl.id,
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
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type='table',
                metrics=["sum__SP_POP_TOTL"],
                groupby=['country_name'])),
        Slice(
            slice_name="Growth Rate",
            viz_type='line',
            datasource_type='table',
            datasource_id=tbl.id,
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
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type='world_map',
                metric="sum__SP_RUR_TOTL_ZS",
                num_period_compare="10")),
        Slice(
            slice_name="Life Expectancy VS Rural %",
            viz_type='bubble',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type='bubble',
                since="2011-01-01",
                until="2011-01-02",
                series="region",
                limit=0,
                entity="country_name",
                x="sum__SP_RUR_TOTL_ZS",
                y="sum__SP_DYN_LE00_IN",
                size="sum__SP_POP_TOTL",
                max_bubble_size="50",
                filters=[{
                    "col": "country_code",
                    "val": [
                        "TCA", "MNP", "DMA", "MHL", "MCO", "SXM", "CYM",
                        "TUV", "IMY", "KNA", "ASM", "ADO", "AMA", "PLW",
                    ],
                    "op": "not in"}],
                )),
        Slice(
            slice_name="Rural Breakdown",
            viz_type='sunburst',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type='sunburst',
                groupby=["region", "country_name"],
                secondary_metric="sum__SP_RUR_TOTL",
                since="2011-01-01",
                until="2011-01-01",)),
        Slice(
            slice_name="World's Pop Growth",
            viz_type='area',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                since="1960-01-01",
                until="now",
                viz_type='area',
                groupby=["region"],)),
        Slice(
            slice_name="Box plot",
            viz_type='box_plot',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                since="1960-01-01",
                until="now",
                whisker_options="Min/max (no outliers)",
                viz_type='box_plot',
                groupby=["region"],)),
        Slice(
            slice_name="Treemap",
            viz_type='treemap',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                since="1960-01-01",
                until="now",
                viz_type='treemap',
                metrics=["sum__SP_POP_TOTL"],
                groupby=["region", "country_code"],)),
        Slice(
            slice_name="Parallel Coordinates",
            viz_type='para',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                since="2011-01-01",
                until="2011-01-01",
                viz_type='para',
                limit=100,
                metrics=[
                    "sum__SP_POP_TOTL",
                    'sum__SP_RUR_TOTL_ZS',
                    'sum__SH_DYN_AIDS'],
                secondary_metric='sum__SP_POP_TOTL',
                series="country_name",)),
    ]
    misc_dash_slices.append(slices[-1].slice_name)
    for slc in slices:
        merge_slice(slc)

    print("Creating a World's Health Bank dashboard")
    dash_name = "World's Bank Data"
    slug = "world_health"
    dash = db.session.query(Dash).filter_by(slug=slug).first()

    if not dash:
        dash = Dash()
    js = textwrap.dedent("""\
    [
      {
          "slice_id": "567",
          "size_x": 8,
          "size_y": 8,
          "v": 1,
          "col": 1,
          "row": 0
      },
      {
          "slice_id": "568",
          "size_x": 8,
          "size_y": 8,
          "v": 1,
          "col": 1,
          "row": 8
      },
      {
          "slice_id": "569",
          "size_x": 12,
          "size_y": 28,
          "v": 1,
          "col": 37,
          "row": 0
      },
      {
          "slice_id": "570",
          "size_x": 24,
          "size_y": 12,
          "v": 1,
          "col": 1,
          "row": 16
      },
      {
          "slice_id": "571",
          "size_x": 28,
          "size_y": 16,
          "v": 1,
          "col": 9,
          "row": 0
      },
      {
          "slice_id": "572",
          "size_x": 32,
          "size_y": 16,
          "v": 1,
          "col": 17,
          "row": 28
      },
      {
          "slice_id": "573",
          "size_x": 12,
          "size_y": 12,
          "v": 1,
          "col": 25,
          "row": 16
      },
      {
          "slice_id": "574",
          "size_x": 16,
          "size_y": 16,
          "v": 1,
          "col": 1,
          "row": 28
      },
      {
          "slice_id": "575",
          "size_x": 16,
          "size_y": 16,
          "v": 1,
          "col": 33,
          "row": 44
      },
      {
          "slice_id": "576",
          "size_x": 32,
          "size_y": 16,
          "v": 1,
          "col": 1,
          "row": 44
      }
    ]
    """)
    l = json.loads(js)
    for i, pos in enumerate(l):
        pos['slice_id'] = str(slices[i].id)

    dash.dashboard_title = dash_name
    dash.position_json = json.dumps(l, indent=4)
    dash.slug = slug

    dash.slices = slices[:-1]
    db.session.merge(dash)
    db.session.commit()


def load_css_templates():
    """Loads 2 css templates to demonstrate the feature"""
    print('Creating default CSS templates')
    CSS = models.CssTemplate  # noqa

    obj = db.session.query(CSS).filter_by(template_name='Flat').first()
    if not obj:
        obj = CSS(template_name="Flat")
    css = textwrap.dedent("""\
    .gridster div.widget {
        transition: background-color 0.5s ease;
        background-color: #FAFAFA;
        border: 1px solid #CCC;
        box-shadow: none;
        border-radius: 0px;
    }
    .gridster div.widget:hover {
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
    .gridster div.widget {
        transition: background-color 0.5s ease;
        background-color: #EEE;
        border: 2px solid #444;
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
    .gridster div.widget:hover {
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
    """Loading birth name dataset from a zip file in the repo"""
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

    print("Creating table [birth_names] reference")
    obj = db.session.query(TBL).filter_by(table_name='birth_names').first()
    if not obj:
        obj = TBL(table_name='birth_names')
    obj.main_dttm_col = 'ds'
    obj.database = get_or_create_main_db()
    obj.filter_select_enabled = True
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    defaults = {
        "compare_lag": "10",
        "compare_suffix": "o10Y",
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
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                groupby=['name'],
                filters=[{
                    'col': 'gender',
                    'op': 'in',
                    'val': ['girl'],
                }],
                row_limit=50)),
        Slice(
            slice_name="Boys",
            viz_type='table',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                groupby=['name'],
                filters=[{
                    'col': 'gender',
                    'op': 'in',
                    'val': ['boy'],
                }],
                row_limit=50)),
        Slice(
            slice_name="Participants",
            viz_type='big_number',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="big_number", granularity="ds",
                compare_lag="5", compare_suffix="over 5Y")),
        Slice(
            slice_name="Genders",
            viz_type='pie',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="pie", groupby=['gender'])),
        Slice(
            slice_name="Genders by State",
            viz_type='dist_bar',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                filters=[{
                    'col': 'state',
                    'op': 'not in',
                    'val': ['other'],
                }],
                viz_type="dist_bar",
                metrics=['sum__sum_girls', 'sum__sum_boys'],
                groupby=['state'])),
        Slice(
            slice_name="Trends",
            viz_type='line',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="line", groupby=['name'],
                granularity='ds', rich_tooltip=True, show_legend=True)),
        Slice(
            slice_name="Average and Sum Trends",
            viz_type='dual_line',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="dual_line", metric='avg__num', metric_2='sum__num',
                granularity='ds')),
        Slice(
            slice_name="Title",
            viz_type='markup',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="markup", markup_type="html",
                code="""\
<div style="text-align:center">
    <h1>Birth Names Dashboard</h1>
    <p>
        The source dataset came from
        <a href="https://github.com/hadley/babynames" target="_blank">[here]</a>
    </p>
    <img src="/static/assets/images/babytux.jpg">
</div>
""")),
        Slice(
            slice_name="Name Cloud",
            viz_type='word_cloud',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="word_cloud", size_from="10",
                series='name', size_to="70", rotation="square",
                limit='100')),
        Slice(
            slice_name="Pivot Table",
            viz_type='pivot_table',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="pivot_table", metrics=['sum__num'],
                groupby=['name'], columns=['state'])),
        Slice(
            slice_name="Number of Girls",
            viz_type='big_number_total',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="big_number_total", granularity="ds",
                filters=[{
                    'col': 'gender',
                    'op': 'in',
                    'val': ['girl'],
                }],
                subheader='total female participants')),
    ]
    for slc in slices:
        merge_slice(slc)

    print("Creating a dashboard")
    dash = db.session.query(Dash).filter_by(dashboard_title="Births").first()

    if not dash:
        dash = Dash()
    js = textwrap.dedent("""\
    [
      {
        "slice_id": "578",
        "size_x": 8,
        "size_y": 16,
        "v": 1,
        "col": 33,
        "row": 24
      },
      {
        "slice_id": "579",
        "size_x": 8,
        "size_y": 16,
        "v": 1,
        "col": 41,
        "row": 24
      },
      {
        "slice_id": "580",
        "size_x": 8,
        "size_y": 8,
        "v": 1,
        "col": 1,
        "row": 0
      },
      {
        "slice_id": "581",
        "size_x": 8,
        "size_y": 8,
        "v": 1,
        "col": 9,
        "row": 0
      },
      {
        "slice_id": "582",
        "size_x": 32,
        "size_y": 12,
        "v": 1,
        "col": 17,
        "row": 12
      },
      {
        "slice_id": "583",
        "size_x": 32,
        "size_y": 16,
        "v": 1,
        "col": 1,
        "row": 24
      },
      {
        "slice_id": "584",
        "size_x": 12,
        "size_y": 12,
        "v": 1,
        "col": 37,
        "row": 0
      },
      {
        "slice_id": "585",
        "size_x": 20,
        "size_y": 12,
        "v": 1,
        "col": 17,
        "row": 0
      },
      {
        "slice_id": "586",
        "size_x": 16,
        "size_y": 16,
        "v": 1,
        "col": 1,
        "row": 8
      },
      {
        "slice_id": "587",
        "size_x": 16,
        "size_y": 16,
        "v": 1,
        "col": 1,
        "row": 48
      }
    ]

        """)
    l = json.loads(js)
    for i, pos in enumerate(l):
        pos['slice_id'] = str(slices[i].id)
    dash.dashboard_title = "Births"
    dash.position_json = json.dumps(l, indent=4)
    dash.slug = "births"
    dash.slices = slices[:-1]
    db.session.merge(dash)
    db.session.commit()


def load_unicode_test_data():
    """Loading unicode test dataset from a csv file in the repo"""
    df = pd.read_csv(os.path.join(DATA_FOLDER, 'unicode_utf8_unixnl_test.csv'),
                     encoding="utf-8")
    # generate date/numeric data
    df['date'] = datetime.datetime.now().date()
    df['value'] = [random.randint(1, 100) for _ in range(len(df))]
    df.to_sql(  # pylint: disable=no-member
        'unicode_test',
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'phrase': String(500),
            'short_phrase': String(10),
            'with_missing': String(100),
            'date': Date(),
            'value': Float(),
        },
        index=False)
    print("Done loading table!")
    print("-" * 80)

    print("Creating table [unicode_test] reference")
    obj = db.session.query(TBL).filter_by(table_name='unicode_test').first()
    if not obj:
        obj = TBL(table_name='unicode_test')
    obj.main_dttm_col = 'date'
    obj.database = get_or_create_main_db()
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        "granularity": "date",
        "groupby": [],
        "metric": 'sum__value',
        "row_limit": config.get("ROW_LIMIT"),
        "since": "100 years ago",
        "until": "now",
        "where": "",
        "viz_type": "word_cloud",
        "size_from": "10",
        "series": "short_phrase",
        "size_to": "70",
        "rotation": "square",
        "limit": "100",
    }

    print("Creating a slice")
    slc = Slice(
        slice_name="Unicode Cloud",
        viz_type='word_cloud',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)

    print("Creating a dashboard")
    dash = (
        db.session.query(Dash)
        .filter_by(dashboard_title="Unicode Test")
        .first()
    )

    if not dash:
        dash = Dash()
    pos = {
        "size_y": 16,
        "size_x": 16,
        "col": 1,
        "row": 1,
        "slice_id": slc.id,
    }
    dash.dashboard_title = "Unicode Test"
    dash.position_json = json.dumps([pos], indent=4)
    dash.slug = "unicode-test"
    dash.slices = [slc]
    db.session.merge(dash)
    db.session.commit()


def load_random_time_series_data():
    """Loading random time series data from a zip file in the repo"""
    with gzip.open(os.path.join(DATA_FOLDER, 'random_time_series.json.gz')) as f:
        pdf = pd.read_json(f)
    pdf.ds = pd.to_datetime(pdf.ds, unit='s')
    pdf.to_sql(
        'random_time_series',
        db.engine,
        if_exists='replace',
        chunksize=500,
        dtype={
            'ds': DateTime,
        },
        index=False)
    print("Done loading table!")
    print("-" * 80)

    print("Creating table [random_time_series] reference")
    obj = db.session.query(TBL).filter_by(table_name='random_time_series').first()
    if not obj:
        obj = TBL(table_name='random_time_series')
    obj.main_dttm_col = 'ds'
    obj.database = get_or_create_main_db()
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        "granularity": "day",
        "row_limit": config.get("ROW_LIMIT"),
        "since": "1 year ago",
        "until": "now",
        "metric": "count",
        "where": "",
        "viz_type": "cal_heatmap",
        "domain_granularity": "month",
        "subdomain_granularity": "day",
    }

    print("Creating a slice")
    slc = Slice(
        slice_name="Calendar Heatmap",
        viz_type='cal_heatmap',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)


def load_country_map_data():
    """Loading data for map with country map"""
    csv_path = os.path.join(DATA_FOLDER, 'birth_france_data_for_country_map.csv')
    data = pd.read_csv(csv_path, encoding="utf-8")
    data['date'] = datetime.datetime.now().date()
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
            'date': Date(),
        },
        index=False)
    print("Done loading table!")
    print("-" * 80)
    print("Creating table reference")
    obj = db.session.query(TBL).filter_by(table_name='birth_france_by_region').first()
    if not obj:
        obj = TBL(table_name='birth_france_by_region')
    obj.main_dttm_col = 'date'
    obj.database = get_or_create_main_db()
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        "granularity": "",
        "since": "",
        "until": "",
        "where": "",
        "viz_type": "country_map",
        "entity": "DEPT_ID",
        "metric": "avg__2004",
        "row_limit": 500000,
    }

    print("Creating a slice")
    slc = Slice(
        slice_name="Birth in France by department in 2016",
        viz_type='country_map',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    misc_dash_slices.append(slc.slice_name)
    merge_slice(slc)


def load_long_lat_data():
    """Loading lat/long data from a csv file in the repo"""
    with gzip.open(os.path.join(DATA_FOLDER, 'san_francisco.csv.gz')) as f:
        pdf = pd.read_csv(f, encoding="utf-8")
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
    print("Done loading table!")
    print("-" * 80)

    print("Creating table reference")
    obj = db.session.query(TBL).filter_by(table_name='long_lat').first()
    if not obj:
        obj = TBL(table_name='long_lat')
    obj.main_dttm_col = 'datetime'
    obj.database = get_or_create_main_db()
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        "granularity": "day",
        "since": "2014-01-01",
        "until": "now",
        "where": "",
        "viz_type": "mapbox",
        "all_columns_x": "LON",
        "all_columns_y": "LAT",
        "mapbox_style": "mapbox://styles/mapbox/light-v9",
        "all_columns": ["occupancy"],
        "row_limit": 500000,
    }

    print("Creating a slice")
    slc = Slice(
        slice_name="Mapbox Long/Lat",
        viz_type='mapbox',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    misc_dash_slices.append(slc.slice_name)
    merge_slice(slc)


def load_multiformat_time_series_data():

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
            "ds": Date,
            'ds2': DateTime,
            "epoch_s": BigInteger,
            "epoch_ms": BigInteger,
            "string0": String(100),
            "string1": String(100),
            "string2": String(100),
            "string3": String(100),
        },
        index=False)
    print("Done loading table!")
    print("-" * 80)
    print("Creating table [multiformat_time_series] reference")
    obj = db.session.query(TBL).filter_by(table_name='multiformat_time_series').first()
    if not obj:
        obj = TBL(table_name='multiformat_time_series')
    obj.main_dttm_col = 'ds'
    obj.database = get_or_create_main_db()
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

    print("Creating some slices")
    for i, col in enumerate(tbl.columns):
        slice_data = {
            "metric": 'count',
            "granularity_sqla": col.column_name,
            "granularity": "day",
            "row_limit": config.get("ROW_LIMIT"),
            "since": "1 year ago",
            "until": "now",
            "where": "",
            "viz_type": "cal_heatmap",
            "domain_granularity": "month",
            "subdomain_granularity": "day",
        }

        slc = Slice(
            slice_name="Calendar Heatmap multiformat " + str(i),
            viz_type='cal_heatmap',
            datasource_type='table',
            datasource_id=tbl.id,
            params=get_slice_json(slice_data),
        )
        merge_slice(slc)
    misc_dash_slices.append(slc.slice_name)


def load_misc_dashboard():
    """Loading a dashboard featuring misc charts"""

    print("Creating the dashboard")
    db.session.expunge_all()
    DASH_SLUG = "misc_charts"
    dash = db.session.query(Dash).filter_by(slug=DASH_SLUG).first()

    if not dash:
        dash = Dash()
    js = textwrap.dedent("""\
    [
      {
        "slice_id": "564",
        "size_x": 24,
        "size_y": 16,
        "v": 1,
        "col": 1,
        "row": 28
      },
      {
        "slice_id": "565",
        "size_x": 24,
        "size_y": 20,
        "v": 1,
        "col": 1,
        "row": 8
      },
      {
        "slice_id": "566",
        "size_x": 24,
        "size_y": 16,
        "v": 1,
        "col": 25,
        "row": 8
      },
      {
        "slice_id": "577",
        "size_x": 16,
        "size_y": 8,
        "v": 1,
        "col": 33,
        "row": 0
      },
      {
        "slice_id": "590",
        "size_x": 24,
        "size_y": 20,
        "v": 1,
        "col": 25,
        "row": 24
      },
      {
        "slice_id": "591",
        "size_x": 32,
        "size_y": 8,
        "v": 1,
        "col": 1,
        "row": 0
      }
    ]
    """)
    l = json.loads(js)
    slices = (
        db.session
        .query(Slice)
        .filter(Slice.slice_name.in_(misc_dash_slices))
        .all()
    )
    slices = sorted(slices, key=lambda x: x.id)
    for i, pos in enumerate(l):
        pos['slice_id'] = str(slices[i].id)
    dash.dashboard_title = "Misc Charts"
    dash.position_json = json.dumps(l, indent=4)
    dash.slug = DASH_SLUG
    dash.slices = slices
    db.session.merge(dash)
    db.session.commit()


def load_deck_dash():
    print("Loading deck.gl dashboard")
    slices = []
    tbl = db.session.query(TBL).filter_by(table_name='long_lat').first()
    slice_data = {
        "spatial": {
            "type": "latlong",
            "lonCol": "LON",
            "latCol": "LAT",
        },
        "color_picker": {
            "r": 205,
            "g": 0,
            "b": 3,
            "a": 0.82,
        },
        "datasource": "5__table",
        "filters": [],
        "granularity_sqla": "date",
        "groupby": [],
        "having": "",
        "mapbox_style": "mapbox://styles/mapbox/light-v9",
        "multiplier": 10,
        "point_radius_fixed": {"type": "metric", "value": "count"},
        "point_unit": "square_m",
        "row_limit": 5000,
        "since": None,
        "size": "count",
        "time_grain_sqla": "Time Column",
        "until": None,
        "viewport": {
            "bearing": -4.952916738791771,
            "latitude": 37.78926922909199,
            "longitude": -122.42613341901688,
            "pitch": 4.750411100577438,
            "zoom": 12.729132798697304,
        },
        "viz_type": "deck_scatter",
        "where": "",
    }

    print("Creating Scatterplot slice")
    slc = Slice(
        slice_name="Scatterplot",
        viz_type='deck_scatter',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    slice_data = {
        "point_unit": "square_m",
        "filters": [],
        "row_limit": 5000,
        "spatial": {
            "type": "latlong",
            "lonCol": "LON",
            "latCol": "LAT",
        },
        "mapbox_style": "mapbox://styles/mapbox/dark-v9",
        "granularity_sqla": "date",
        "size": "count",
        "viz_type": "deck_screengrid",
        "since": None,
        "point_radius": "Auto",
        "until": None,
        "color_picker": {
            "a": 1,
            "r": 14,
            "b": 0,
            "g": 255,
        },
        "grid_size": 20,
        "where": "",
        "having": "",
        "viewport": {
            "zoom": 14.161641703941438,
            "longitude": -122.41827069521386,
            "bearing": -4.952916738791771,
            "latitude": 37.76024135844065,
            "pitch": 4.750411100577438,
        },
        "point_radius_fixed": {"type": "fix", "value": 2000},
        "datasource": "5__table",
        "time_grain_sqla": "Time Column",
        "groupby": [],
    }
    print("Creating Screen Grid slice")
    slc = Slice(
        slice_name="Screen grid",
        viz_type='deck_screengrid',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    slice_data = {
        "spatial": {
            "type": "latlong",
            "lonCol": "LON",
            "latCol": "LAT",
        },
        "filters": [],
        "row_limit": 5000,
        "mapbox_style": "mapbox://styles/mapbox/streets-v9",
        "granularity_sqla": "date",
        "size": "count",
        "viz_type": "deck_hex",
        "since": None,
        "point_radius_unit": "Pixels",
        "point_radius": "Auto",
        "until": None,
        "color_picker": {
            "a": 1,
            "r": 14,
            "b": 0,
            "g": 255,
        },
        "grid_size": 40,
        "extruded": True,
        "having": "",
        "viewport": {
            "latitude": 37.789795085160335,
            "pitch": 54.08961642447763,
            "zoom": 13.835465702403654,
            "longitude": -122.40632230075536,
            "bearing": -2.3984797349335167,
        },
        "where": "",
        "point_radius_fixed": {"type": "fix", "value": 2000},
        "datasource": "5__table",
        "time_grain_sqla": "Time Column",
        "groupby": [],
    }
    print("Creating Hex slice")
    slc = Slice(
        slice_name="Hexagons",
        viz_type='deck_hex',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    slice_data = {
        "spatial": {
            "type": "latlong",
            "lonCol": "LON",
            "latCol": "LAT",
        },
        "filters": [],
        "row_limit": 5000,
        "mapbox_style": "mapbox://styles/mapbox/satellite-streets-v9",
        "granularity_sqla": "date",
        "size": "count",
        "viz_type": "deck_grid",
        "since": None,
        "point_radius_unit": "Pixels",
        "point_radius": "Auto",
        "until": None,
        "color_picker": {
            "a": 1,
            "r": 14,
            "b": 0,
            "g": 255,
        },
        "grid_size": 120,
        "extruded": True,
        "having": "",
        "viewport": {
            "longitude": -122.42066918995666,
            "bearing": 155.80099696026355,
            "zoom": 12.699690845482069,
            "latitude": 37.7942314882596,
            "pitch": 53.470800300695146,
        },
        "where": "",
        "point_radius_fixed": {"type": "fix", "value": 2000},
        "datasource": "5__table",
        "time_grain_sqla": "Time Column",
        "groupby": [],
    }
    print("Creating Grid slice")
    slc = Slice(
        slice_name="Grid",
        viz_type='deck_grid',
        datasource_type='table',
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    polygon_tbl = db.session.query(TBL) \
                    .filter_by(table_name='sf_population_polygons').first()
    slice_data = {
            "datasource": "11__table",
            "viz_type": "deck_polygon",
            "slice_id": 41,
            "granularity_sqla": None,
            "time_grain_sqla": None,
            "since": None,
            "until": None,
            "line_column": "contour",
            "line_type": "json",
            "mapbox_style": "mapbox://styles/mapbox/light-v9",
            "viewport": {
                "longitude": -122.43388541747726,
                "latitude": 37.752020331384834,
                "zoom": 11.133995608594631,
                "bearing": 37.89506450385642,
                "pitch": 60,
                "width": 667,
                "height": 906,
                "altitude": 1.5,
                "maxZoom": 20,
                "minZoom": 0,
                "maxPitch": 60,
                "minPitch": 0,
                "maxLatitude": 85.05113,
                "minLatitude": -85.05113
            },
            "reverse_long_lat": False,
            "fill_color_picker": {
                "r": 3,
                "g": 65,
                "b": 73,
                "a": 1
            },
            "stroke_color_picker": {
                "r": 0,
                "g": 122,
                "b": 135,
                "a": 1
            },
            "filled": True,
            "stroked": False,
            "extruded": True,
            "point_radius_scale": 100,
            "js_columns": [
                "population",
                "area"
            ],
            "js_datapoint_mutator": "(d) => {\n    d.elevation = d.extraProps.population/d.extraProps.area/10\n \
             d.fillColor = [d.extraProps.population/d.extraProps.area/60,140,0]\n \
             return d;\n}",
            "js_tooltip": "",
            "js_onclick_href": "",
            "where": "",
            "having": "",
            "filters": []
        }

    print("Creating Polygon slice")
    slc = Slice(
        slice_name="Polygons",
        viz_type='deck_polygon',
        datasource_type='table',
        datasource_id=polygon_tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    slice_data = {
            "datasource": "10__table",
            "viz_type": "deck_arc",
            "slice_id": 42,
            "granularity_sqla": "date",
            "time_grain_sqla": "Time Column",
            "since": None,
            "until": None,
            "start_spatial": {
                "type": "latlong",
                "latCol": "LATITUDE",
                "lonCol": "LONGITUDE"
            },
            "end_spatial": {
                "type": "latlong",
                "latCol": "LATITUDE_DEST",
                "lonCol": "LONGITUDE_DEST"
            },
            "row_limit": 5000,
            "mapbox_style": "mapbox://styles/mapbox/light-v9",
            "viewport": {
                "altitude": 1.5,
                "bearing": 8.546256357301871,
                "height": 642,
                "latitude": 44.596651438714254,
                "longitude": -91.84340711201104,
                "maxLatitude": 85.05113,
                "maxPitch": 60,
                "maxZoom": 20,
                "minLatitude": -85.05113,
                "minPitch": 0,
                "minZoom": 0,
                "pitch": 60,
                "width": 997,
                "zoom": 2.929837070560775
            },
            "color_picker": {
                "r": 0,
                "g": 122,
                "b": 135,
                "a": 1
            },
            "stroke_width": 1,
            "where": "",
            "having": "",
            "filters": []
        }

    print("Creating Arc slice")
    slc = Slice(
        slice_name="Arcs",
        viz_type='deck_arc',
        datasource_type='table',
        datasource_id=db.session.query(TBL).filter_by(table_name='flights').first().id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    slice_data = {
        "datasource": "12__table",
        "slice_id": 43,
        "viz_type": "deck_path",
        "time_grain_sqla": "Time Column",
        "since": None,
        "until": None,
        "line_column": "path_json",
        "line_type": "json",
        "row_limit": 5000,
        "mapbox_style": "mapbox://styles/mapbox/light-v9",
        "viewport": {
            "longitude": -122.18885402582598,
            "latitude": 37.73671752604488,
            "zoom": 9.51847667620428,
            "bearing": 0,
            "pitch": 0,
            "width": 669,
            "height": 1094,
            "altitude": 1.5,
            "maxZoom": 20,
            "minZoom": 0,
            "maxPitch": 60,
            "minPitch": 0,
            "maxLatitude": 85.05113,
            "minLatitude": -85.05113
        },
        "color_picker": {
            "r": 0,
            "g": 122,
            "b": 135,
            "a": 1
        },
        "line_width": 150,
        "reverse_long_lat": False,
        "js_columns": [
            "color"
        ],
        "js_datapoint_mutator": "d => {\n    return {\n        ...d,\n        color: \
            colors.hexToRGB(d.extraProps.color),\n    }\n}",
        "js_tooltip": "",
        "js_onclick_href": "",
        "where": "",
        "having": "",
        "filters": []
    }

    print("Creating Path slice")
    slc = Slice(
        slice_name="Path",
        viz_type='deck_path',
        datasource_type='table',
        datasource_id=db.session.query(TBL).filter_by(table_name='bart_lines').first().id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    print("Creating a dashboard")
    title = "deck.gl Demo"
    dash = db.session.query(Dash).filter_by(dashboard_title=title).first()

    if not dash:
        dash = Dash()
    js = textwrap.dedent("""\
    [
      {
        "slice_id": "600",
        "size_x": 24,
        "size_y": 16,
        "v": 1,
        "col": 1,
        "row": 0
      },
      {
        "slice_id": "601",
        "size_x": 24,
        "size_y": 16,
        "v": 1,
        "col": 25,
        "row": 0
      },
      {
        "slice_id": "602",
        "size_x": 24,
        "size_y": 16,
        "v": 1,
        "col": 25,
        "row": 16
      },
      {
        "slice_id": "603",
        "size_x": 24,
        "size_y": 16,
        "v": 1,
        "col": 1,
        "row": 16
      },
      {
        "slice_id": "604",
        "size_x": 24,
        "size_y": 16,
        "v": 1,
        "col": 1,
        "row": 16
      },
      {
        "slice_id": "605",
        "size_x": 24,
        "size_y": 16,
        "v": 1,
        "col": 25,
        "row": 16
      },
      {
        "slice_id": "606",
        "size_x": 24,
        "size_y": 16,
        "v": 1,
        "col": 1,
        "row": 20
      }
    ]
    """)
    l = json.loads(js)
    for i, pos in enumerate(l):
        pos['slice_id'] = str(slices[i].id)
    dash.dashboard_title = title
    dash.position_json = json.dumps(l, indent=4)
    dash.slug = "deck"
    dash.slices = slices
    db.session.merge(dash)
    db.session.commit()


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
    tbl.description = "Random set of flights in the US"
    tbl.database = get_or_create_main_db()
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
    print("Done loading table!")


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
    print("Creating table {} reference".format(tbl_name))
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = "Map of Paris"
    tbl.database = get_or_create_main_db()
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()


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
    print("Creating table {} reference".format(tbl_name))
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = "Population density of San Francisco"
    tbl.database = get_or_create_main_db()
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()


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
    print("Creating table {} reference".format(tbl_name))
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = "BART lines"
    tbl.database = get_or_create_main_db()
    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()
