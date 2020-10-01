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
# isort:skip_file
"""Unit tests for Superset cache warmup"""

import json
from unittest.mock import MagicMock
from sqlalchemy import String, Date, Float

import pytest
import pandas as pd

from superset.models.slice import Slice
from superset.utils.core import get_example_database

from superset import db

from superset.models.core import Log
from superset.models.tags import get_tag, ObjectTypes, TaggedObject, TagTypes
from superset.tasks.cache import (
    DashboardTagsStrategy,
    get_form_data,
    TopNDashboardsStrategy,
)

from .base_tests import SupersetTestCase
from .dashboard_utils import (
    create_dashboard,
    create_slice,
    create_table_for_dashboard,
    add_datetime_value_to_data,
)

URL_PREFIX = "http://0.0.0.0:8081"

mock_positions = {
    "DASHBOARD_VERSION_KEY": "v2",
    "DASHBOARD_CHART_TYPE-1": {
        "type": "CHART",
        "id": "DASHBOARD_CHART_TYPE-1",
        "children": [],
        "meta": {"width": 4, "height": 50, "chartId": 1},
    },
    "DASHBOARD_CHART_TYPE-2": {
        "type": "CHART",
        "id": "DASHBOARD_CHART_TYPE-2",
        "children": [],
        "meta": {"width": 4, "height": 50, "chartId": 2},
    },
}


class TestCacheWarmUp(SupersetTestCase):
    def test_get_form_data_chart_only(self):
        chart_id = 1
        result = get_form_data(chart_id, None)
        expected = {"slice_id": chart_id}
        self.assertEqual(result, expected)

    def test_get_form_data_no_dashboard_metadata(self):
        chart_id = 1
        dashboard = MagicMock()
        dashboard.json_metadata = None
        dashboard.position_json = json.dumps(mock_positions)
        result = get_form_data(chart_id, dashboard)
        expected = {"slice_id": chart_id}
        self.assertEqual(result, expected)

    def test_get_form_data_immune_slice(self):
        chart_id = 1
        filter_box_id = 2
        dashboard = MagicMock()
        dashboard.position_json = json.dumps(mock_positions)
        dashboard.json_metadata = json.dumps(
            {
                "filter_scopes": {
                    str(filter_box_id): {
                        "name": {"scope": ["ROOT_ID"], "immune": [chart_id]}
                    }
                },
                "default_filters": json.dumps(
                    {str(filter_box_id): {"name": ["Alice", "Bob"]}}
                ),
            }
        )
        result = get_form_data(chart_id, dashboard)
        expected = {"slice_id": chart_id}
        self.assertEqual(result, expected)

    def test_get_form_data_no_default_filters(self):
        chart_id = 1
        dashboard = MagicMock()
        dashboard.json_metadata = json.dumps({})
        dashboard.position_json = json.dumps(mock_positions)
        result = get_form_data(chart_id, dashboard)
        expected = {"slice_id": chart_id}
        self.assertEqual(result, expected)

    def test_get_form_data_immune_fields(self):
        chart_id = 1
        filter_box_id = 2
        dashboard = MagicMock()
        dashboard.position_json = json.dumps(mock_positions)
        dashboard.json_metadata = json.dumps(
            {
                "default_filters": json.dumps(
                    {
                        str(filter_box_id): {
                            "name": ["Alice", "Bob"],
                            "__time_range": "100 years ago : today",
                        }
                    }
                ),
                "filter_scopes": {
                    str(filter_box_id): {
                        "__time_range": {"scope": ["ROOT_ID"], "immune": [chart_id]}
                    }
                },
            }
        )
        result = get_form_data(chart_id, dashboard)
        expected = {
            "slice_id": chart_id,
            "extra_filters": [{"col": "name", "op": "in", "val": ["Alice", "Bob"]}],
        }
        self.assertEqual(result, expected)

    def test_get_form_data_no_extra_filters(self):
        chart_id = 1
        filter_box_id = 2
        dashboard = MagicMock()
        dashboard.position_json = json.dumps(mock_positions)
        dashboard.json_metadata = json.dumps(
            {
                "default_filters": json.dumps(
                    {str(filter_box_id): {"__time_range": "100 years ago : today"}}
                ),
                "filter_scopes": {
                    str(filter_box_id): {
                        "__time_range": {"scope": ["ROOT_ID"], "immune": [chart_id]}
                    }
                },
            }
        )
        result = get_form_data(chart_id, dashboard)
        expected = {"slice_id": chart_id}
        self.assertEqual(result, expected)

    def test_get_form_data(self):
        chart_id = 1
        filter_box_id = 2
        dashboard = MagicMock()
        dashboard.position_json = json.dumps(mock_positions)
        dashboard.json_metadata = json.dumps(
            {
                "default_filters": json.dumps(
                    {
                        str(filter_box_id): {
                            "name": ["Alice", "Bob"],
                            "__time_range": "100 years ago : today",
                        }
                    }
                )
            }
        )
        result = get_form_data(chart_id, dashboard)
        expected = {
            "slice_id": chart_id,
            "extra_filters": [
                {"col": "name", "op": "in", "val": ["Alice", "Bob"]},
                {"col": "__time_range", "op": "==", "val": "100 years ago : today"},
            ],
        }
        self.assertEqual(result, expected)

    def test_top_n_dashboards_strategy(self):
        # create a top visited dashboard
        db.session.query(Log).delete()
        self.login(username="admin")
        dash = self.get_dash_by_slug("births")
        for _ in range(10):
            self.client.get(f"/superset/dashboard/{dash.id}/")

        strategy = TopNDashboardsStrategy(1)
        result = sorted(strategy.get_urls())
        expected = sorted([f"{URL_PREFIX}{slc.url}" for slc in dash.slices])
        self.assertEqual(result, expected)

    def reset_tag(self, tag):
        """Remove associated object from tag, used to reset tests"""
        if tag.objects:
            for o in tag.objects:
                db.session.delete(o)
            db.session.commit()

    @pytest.fixture()
    def load_unicode_dashboard(self):
        data = [
            "Под",
            "řšž",
            "視野無限廣",
            "微風",
            "中国智造",
            "æøå",
            "ëœéè",
            "いろはにほ",
            "다람쥐",
            "Чешће",
            "ŕľšťýď",
            "žšč",
            "éúüñóá",
            "كۆچەج",
        ]
        tbl_name = "unicode_test"

        # generate date/numeric data
        unicode_data_dict = add_datetime_value_to_data(data)
        df = pd.DataFrame.from_dict(unicode_data_dict)

        with self.create_app().app_context():
            database = get_example_database()
            schema = {
                "phrase": String(500),
                "dttm": Date(),
                "value": Float(),
            }
            obj = create_table_for_dashboard(df, tbl_name, database, schema)
            obj.fetch_metadata()

            tbl = obj
            slc = create_slice(tbl, None)
            o = db.session.query(Slice).filter_by(slice_name=slc.slice_name).first()
            if o:
                db.session.delete(o)
            db.session.add(slc)

            db.session.commit()
            create_dashboard("unicode-test", "Unicode Test", None, slc)

    @pytest.mark.usefixtures("load_unicode_dashboard")
    def test_dashboard_tags(self):
        tag1 = get_tag("tag1", db.session, TagTypes.custom)
        # delete first to make test idempotent
        self.reset_tag(tag1)

        strategy = DashboardTagsStrategy(["tag1"])
        result = sorted(strategy.get_urls())
        expected = []
        self.assertEqual(result, expected)

        # tag dashboard 'births' with `tag1`
        tag1 = get_tag("tag1", db.session, TagTypes.custom)
        dash = self.get_dash_by_slug("births")
        tag1_urls = sorted([f"{URL_PREFIX}{slc.url}" for slc in dash.slices])
        tagged_object = TaggedObject(
            tag_id=tag1.id, object_id=dash.id, object_type=ObjectTypes.dashboard
        )
        db.session.add(tagged_object)
        db.session.commit()

        self.assertEqual(sorted(strategy.get_urls()), tag1_urls)

        strategy = DashboardTagsStrategy(["tag2"])
        tag2 = get_tag("tag2", db.session, TagTypes.custom)
        self.reset_tag(tag2)

        result = sorted(strategy.get_urls())
        expected = []
        self.assertEqual(result, expected)

        # tag first slice
        dash = self.get_dash_by_slug("unicode-test")
        slc = dash.slices[0]
        tag2_urls = [f"{URL_PREFIX}{slc.url}"]
        object_id = slc.id
        tagged_object = TaggedObject(
            tag_id=tag2.id, object_id=object_id, object_type=ObjectTypes.chart
        )
        db.session.add(tagged_object)
        db.session.commit()

        result = sorted(strategy.get_urls())
        self.assertEqual(result, tag2_urls)

        strategy = DashboardTagsStrategy(["tag1", "tag2"])

        result = sorted(strategy.get_urls())
        expected = sorted(tag1_urls + tag2_urls)
        self.assertEqual(result, expected)


def _get_position():
    return """{
                    "CHART-Hkx6154FEm": {
                        "children": [],
                        "id": "CHART-Hkx6154FEm",
                        "meta": {
                            "chartId": 2225,
                            "height": 30,
                            "sliceName": "slice 1",
                            "width": 4
                        },
                        "type": "CHART"
                    },
                    "GRID_ID": {
                        "children": [
                            "ROW-SyT19EFEQ"
                        ],
                        "id": "GRID_ID",
                        "type": "GRID"
                    },
                    "ROOT_ID": {
                        "children": [
                            "GRID_ID"
                        ],
                        "id": "ROOT_ID",
                        "type": "ROOT"
                    },
                    "ROW-SyT19EFEQ": {
                        "children": [
                            "CHART-Hkx6154FEm"
                        ],
                        "id": "ROW-SyT19EFEQ",
                        "meta": {
                            "background": "BACKGROUND_TRANSPARENT"
                        },
                        "type": "ROW"
                    },
                    "DASHBOARD_VERSION_KEY": "v2"
                }
                    """
