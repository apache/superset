# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

import logging

from superset import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import DatasourceType

from .helpers import (
    get_slice_json,
    get_table_connector_registry,
    merge_slice,
    update_slice_ids,
)

logger = logging.getLogger(__name__)

COLOR_RED = {"r": 205, "g": 0, "b": 3, "a": 0.82}
POSITION_JSON = """\
{
    "CHART-3afd9d70": {
        "meta": {
            "chartId": 66,
            "sliceName": "Deck.gl Scatterplot",
            "width": 6,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-3afd9d70",
        "children": []
    },
    "CHART-2ee7fa5e": {
        "meta": {
            "chartId": 67,
            "sliceName": "Deck.gl Screen grid",
            "width": 6,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-2ee7fa5e",
        "children": []
    },
    "CHART-201f7715": {
        "meta": {
            "chartId": 68,
            "sliceName": "Deck.gl Hexagons",
            "width": 6,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-201f7715",
        "children": []
    },
    "CHART-d02f6c40": {
        "meta": {
            "chartId": 69,
            "sliceName": "Deck.gl Grid",
            "width": 6,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-d02f6c40",
        "children": []
    },
    "CHART-2673431d": {
        "meta": {
            "chartId": 70,
            "sliceName": "Deck.gl Polygons",
            "width": 6,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-2673431d",
        "children": []
    },
    "CHART-85265a60": {
        "meta": {
            "chartId": 71,
            "sliceName": "Deck.gl Arcs",
            "width": 6,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-85265a60",
        "children": []
    },
    "CHART-2b87513c": {
        "meta": {
            "chartId": 72,
            "sliceName": "Deck.gl Path",
            "width": 6,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-2b87513c",
        "children": []
    },
    "GRID_ID": {
        "type": "GRID",
        "id": "GRID_ID",
        "children": [
            "ROW-a7b16cb5",
            "ROW-72c218a5",
            "ROW-957ba55b",
            "ROW-af041bdd"
        ]
    },
    "HEADER_ID": {
        "meta": {
            "text": "deck.gl Demo"
        },
        "type": "HEADER",
        "id": "HEADER_ID"
    },
    "ROOT_ID": {
        "type": "ROOT",
        "id": "ROOT_ID",
        "children": [
            "GRID_ID"
        ]
    },
    "ROW-72c218a5": {
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW",
        "id": "ROW-72c218a5",
        "children": [
            "CHART-d02f6c40",
            "CHART-201f7715"
        ]
    },
    "ROW-957ba55b": {
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW",
        "id": "ROW-957ba55b",
        "children": [
            "CHART-2673431d",
            "CHART-85265a60"
        ]
    },
    "ROW-a7b16cb5": {
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW",
        "id": "ROW-a7b16cb5",
        "children": [
            "CHART-3afd9d70",
            "CHART-2ee7fa5e"
        ]
    },
    "ROW-af041bdd": {
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW",
        "id": "ROW-af041bdd",
        "children": [
            "CHART-2b87513c"
        ]
    },
    "DASHBOARD_VERSION_KEY": "v2"
}"""


def load_deck_dash() -> None:  # pylint: disable=too-many-statements
    logger.debug("Loading deck.gl dashboard")
    slices = []
    table = get_table_connector_registry()
    tbl = db.session.query(table).filter_by(table_name="long_lat").first()
    slice_data = {
        "spatial": {"type": "latlong", "lonCol": "LON", "latCol": "LAT"},
        "color_picker": COLOR_RED,
        "datasource": "5__table",
        "granularity_sqla": None,
        "groupby": [],
        "mapbox_style": "mapbox://styles/mapbox/light-v9",
        "multiplier": 10,
        "point_radius_fixed": {"type": "metric", "value": "count"},
        "point_unit": "square_m",
        "min_radius": 1,
        "max_radius": 250,
        "row_limit": 5000,
        "time_range": " : ",
        "size": "count",
        "time_grain_sqla": None,
        "viewport": {
            "bearing": -4.952916738791771,
            "latitude": 37.78926922909199,
            "longitude": -122.42613341901688,
            "pitch": 4.750411100577438,
            "zoom": 12.729132798697304,
        },
        "viz_type": "deck_scatter",
    }

    logger.debug("Creating Scatterplot slice")
    slc = Slice(
        slice_name="Deck.gl Scatterplot",
        viz_type="deck_scatter",
        datasource_type=DatasourceType.TABLE,
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    slice_data = {
        "point_unit": "square_m",
        "row_limit": 5000,
        "spatial": {"type": "latlong", "lonCol": "LON", "latCol": "LAT"},
        "mapbox_style": "mapbox://styles/mapbox/dark-v9",
        "granularity_sqla": None,
        "size": "count",
        "viz_type": "deck_screengrid",
        "time_range": "No filter",
        "point_radius": "Auto",
        "color_picker": {"a": 1, "r": 14, "b": 0, "g": 255},
        "grid_size": 20,
        "viewport": {
            "zoom": 14.161641703941438,
            "longitude": -122.41827069521386,
            "bearing": -4.952916738791771,
            "latitude": 37.76024135844065,
            "pitch": 4.750411100577438,
        },
        "point_radius_fixed": {"type": "fix", "value": 2000},
        "datasource": "5__table",
        "time_grain_sqla": None,
        "groupby": [],
    }
    logger.debug("Creating Screen Grid slice")
    slc = Slice(
        slice_name="Deck.gl Screen grid",
        viz_type="deck_screengrid",
        datasource_type=DatasourceType.TABLE,
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    slice_data = {
        "spatial": {"type": "latlong", "lonCol": "LON", "latCol": "LAT"},
        "row_limit": 5000,
        "mapbox_style": "mapbox://styles/mapbox/streets-v9",
        "granularity_sqla": None,
        "size": "count",
        "viz_type": "deck_hex",
        "time_range": "No filter",
        "point_radius_unit": "Pixels",
        "point_radius": "Auto",
        "color_picker": {"a": 1, "r": 14, "b": 0, "g": 255},
        "grid_size": 40,
        "extruded": True,
        "viewport": {
            "latitude": 37.789795085160335,
            "pitch": 54.08961642447763,
            "zoom": 13.835465702403654,
            "longitude": -122.40632230075536,
            "bearing": -2.3984797349335167,
        },
        "point_radius_fixed": {"type": "fix", "value": 2000},
        "datasource": "5__table",
        "time_grain_sqla": None,
        "groupby": [],
    }
    logger.debug("Creating Hex slice")
    slc = Slice(
        slice_name="Deck.gl Hexagons",
        viz_type="deck_hex",
        datasource_type=DatasourceType.TABLE,
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    slice_data = {
        "autozoom": False,
        "spatial": {"type": "latlong", "lonCol": "LON", "latCol": "LAT"},
        "row_limit": 5000,
        "mapbox_style": "mapbox://styles/mapbox/satellite-streets-v9",
        "granularity_sqla": None,
        "size": "count",
        "viz_type": "deck_grid",
        "point_radius_unit": "Pixels",
        "point_radius": "Auto",
        "time_range": "No filter",
        "color_picker": {"a": 1, "r": 14, "b": 0, "g": 255},
        "grid_size": 120,
        "extruded": True,
        "viewport": {
            "longitude": -122.42066918995666,
            "bearing": 155.80099696026355,
            "zoom": 12.699690845482069,
            "latitude": 37.7942314882596,
            "pitch": 53.470800300695146,
        },
        "point_radius_fixed": {"type": "fix", "value": 2000},
        "datasource": "5__table",
        "time_grain_sqla": None,
        "groupby": [],
    }
    logger.debug("Creating Grid slice")
    slc = Slice(
        slice_name="Deck.gl Grid",
        viz_type="deck_grid",
        datasource_type=DatasourceType.TABLE,
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    polygon_tbl = (
        db.session.query(table).filter_by(table_name="sf_population_polygons").first()
    )
    slice_data = {
        "datasource": "11__table",
        "viz_type": "deck_polygon",
        "slice_id": 41,
        "granularity_sqla": None,
        "time_grain_sqla": None,
        "time_range": " : ",
        "line_column": "contour",
        "metric": {
            "aggregate": "SUM",
            "column": {
                "column_name": "population",
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "id": 1332,
                "is_dttm": False,
                "optionName": "_col_population",
                "python_date_format": None,
                "type": "BIGINT",
                "verbose_name": None,
            },
            "expressionType": "SIMPLE",
            "hasCustomLabel": True,
            "label": "Population",
            "optionName": "metric_t2v4qbfiz1_w6qgpx4h2p",
            "sqlExpression": None,
        },
        "line_type": "json",
        "linear_color_scheme": "oranges",
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
            "minLatitude": -85.05113,
        },
        "reverse_long_lat": False,
        "fill_color_picker": {"r": 3, "g": 65, "b": 73, "a": 1},
        "stroke_color_picker": {"r": 0, "g": 122, "b": 135, "a": 1},
        "filled": True,
        "stroked": False,
        "extruded": True,
        "multiplier": 0.1,
        "line_width": 10,
        "line_width_unit": "meters",
        "point_radius_fixed": {
            "type": "metric",
            "value": {
                "aggregate": None,
                "column": None,
                "expressionType": "SQL",
                "hasCustomLabel": None,
                "label": "Density",
                "optionName": "metric_c5rvwrzoo86_293h6yrv2ic",
                "sqlExpression": "SUM(population)/SUM(area)",
            },
        },
        "js_columns": [],
        "js_data_mutator": "",
        "js_tooltip": "",
        "js_onclick_href": "",
        "legend_format": ".1s",
        "legend_position": "tr",
    }

    logger.debug("Creating Polygon slice")
    slc = Slice(
        slice_name="Deck.gl Polygons",
        viz_type="deck_polygon",
        datasource_type=DatasourceType.TABLE,
        datasource_id=polygon_tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    slice_data = {
        "datasource": "10__table",
        "viz_type": "deck_arc",
        "slice_id": 42,
        "granularity_sqla": None,
        "time_grain_sqla": None,
        "time_range": " : ",
        "start_spatial": {
            "type": "latlong",
            "latCol": "LATITUDE",
            "lonCol": "LONGITUDE",
        },
        "end_spatial": {
            "type": "latlong",
            "latCol": "LATITUDE_DEST",
            "lonCol": "LONGITUDE_DEST",
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
            "zoom": 2.929837070560775,
        },
        "color_picker": {"r": 0, "g": 122, "b": 135, "a": 1},
        "stroke_width": 1,
    }

    logger.debug("Creating Arc slice")
    slc = Slice(
        slice_name="Deck.gl Arcs",
        viz_type="deck_arc",
        datasource_type=DatasourceType.TABLE,
        datasource_id=db.session.query(table)
        .filter_by(table_name="flights")
        .first()
        .id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)

    slice_data = {
        "datasource": "12__table",
        "slice_id": 43,
        "viz_type": "deck_path",
        "time_grain_sqla": None,
        "time_range": " : ",
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
            "minLatitude": -85.05113,
        },
        "color_picker": {"r": 0, "g": 122, "b": 135, "a": 1},
        "line_width": 150,
        "reverse_long_lat": False,
        "js_columns": ["color"],
        "js_data_mutator": "data => data.map(d => ({\n"
        "    ...d,\n"
        "    color: colors.hexToRGB(d.extraProps.color)\n"
        "}));",
        "js_tooltip": "",
        "js_onclick_href": "",
    }

    logger.debug("Creating Path slice")
    slc = Slice(
        slice_name="Deck.gl Path",
        viz_type="deck_path",
        datasource_type=DatasourceType.TABLE,
        datasource_id=db.session.query(table)
        .filter_by(table_name="bart_lines")
        .first()
        .id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)
    slices.append(slc)
    slug = "deck"

    logger.debug("Creating a dashboard")
    title = "deck.gl Demo"
    dash = db.session.query(Dashboard).filter_by(slug=slug).first()

    if not dash:
        dash = Dashboard()
        db.session.add(dash)
    dash.published = True
    js = POSITION_JSON
    pos = json.loads(js)
    slices = update_slice_ids(pos)
    dash.position_json = json.dumps(pos, indent=4)
    dash.dashboard_title = title
    dash.slug = slug
    dash.slices = slices
