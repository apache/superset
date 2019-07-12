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
"""Unit tests for Superset cache warmup"""
import json
from unittest.mock import MagicMock

from superset import db
from superset.models.core import Log
from superset.models.tags import get_tag, ObjectTypes, TaggedObject, TagTypes
from superset.tasks.cache import (
    DashboardTagsStrategy,
    DummyStrategy,
    get_form_data,
    TopNDashboardsStrategy,
)
from .base_tests import SupersetTestCase


TEST_URL = "http://0.0.0.0:8081/superset/explore_json"


class CacheWarmUpTests(SupersetTestCase):
    def __init__(self, *args, **kwargs):
        super(CacheWarmUpTests, self).__init__(*args, **kwargs)

    def test_get_form_data_chart_only(self):
        chart_id = 1
        result = get_form_data(chart_id, None)
        expected = {"slice_id": chart_id}
        self.assertEqual(result, expected)

    def test_get_form_data_no_dashboard_metadata(self):
        chart_id = 1
        dashboard = MagicMock()
        dashboard.json_metadata = None
        result = get_form_data(chart_id, dashboard)
        expected = {"slice_id": chart_id}
        self.assertEqual(result, expected)

    def test_get_form_data_immune_slice(self):
        chart_id = 1
        filter_box_id = 2
        dashboard = MagicMock()
        dashboard.json_metadata = json.dumps(
            {
                "filter_immune_slices": [chart_id],
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
        result = get_form_data(chart_id, dashboard)
        expected = {"slice_id": chart_id}
        self.assertEqual(result, expected)

    def test_get_form_data_immune_fields(self):
        chart_id = 1
        filter_box_id = 2
        dashboard = MagicMock()
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
                "filter_immune_slice_fields": {chart_id: ["__time_range"]},
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
        dashboard.json_metadata = json.dumps(
            {
                "default_filters": json.dumps(
                    {str(filter_box_id): {"__time_range": "100 years ago : today"}}
                ),
                "filter_immune_slice_fields": {chart_id: ["__time_range"]},
            }
        )
        result = get_form_data(chart_id, dashboard)
        expected = {"slice_id": chart_id}
        self.assertEqual(result, expected)

    def test_get_form_data(self):
        chart_id = 1
        filter_box_id = 2
        dashboard = MagicMock()
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
                {"col": "__time_range", "op": "in", "val": "100 years ago : today"},
            ],
        }
        self.assertEqual(result, expected)

    def test_dummy_strategy(self):
        strategy = DummyStrategy()
        result = sorted(strategy.get_urls())
        expected = [
            f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+1%7D",
            f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+17%7D",
            f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+18%7D",
            f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+19%7D",
            f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+30%7D",
            f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+31%7D",
            f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+8%7D",
        ]
        self.assertEqual(result, expected)

    def test_top_n_dashboards_strategy(self):
        # create a top visited dashboard
        db.session.query(Log).delete()
        self.login(username="admin")
        for _ in range(10):
            self.client.get("/superset/dashboard/3/")

        strategy = TopNDashboardsStrategy(1)
        result = sorted(strategy.get_urls())
        expected = [f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+31%7D"]
        self.assertEqual(result, expected)

    def test_dashboard_tags(self):
        strategy = DashboardTagsStrategy(["tag1"])

        result = sorted(strategy.get_urls())
        expected = []
        self.assertEqual(result, expected)

        # tag dashboard 3 with `tag1`
        tag1 = get_tag("tag1", db.session, TagTypes.custom)
        object_id = 3
        tagged_object = TaggedObject(
            tag_id=tag1.id, object_id=object_id, object_type=ObjectTypes.dashboard
        )
        db.session.add(tagged_object)
        db.session.commit()

        result = sorted(strategy.get_urls())
        expected = [f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+31%7D"]
        self.assertEqual(result, expected)

        strategy = DashboardTagsStrategy(["tag2"])

        result = sorted(strategy.get_urls())
        expected = []
        self.assertEqual(result, expected)

        # tag chart 30 with `tag2`
        tag2 = get_tag("tag2", db.session, TagTypes.custom)
        object_id = 30
        tagged_object = TaggedObject(
            tag_id=tag2.id, object_id=object_id, object_type=ObjectTypes.chart
        )
        db.session.add(tagged_object)
        db.session.commit()

        result = sorted(strategy.get_urls())
        expected = [f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+30%7D"]
        self.assertEqual(result, expected)

        strategy = DashboardTagsStrategy(["tag1", "tag2"])

        result = sorted(strategy.get_urls())
        expected = [
            f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+30%7D",
            f"{TEST_URL}/?form_data=%7B%27slice_id%27%3A+31%7D",
        ]
        self.assertEqual(result, expected)
