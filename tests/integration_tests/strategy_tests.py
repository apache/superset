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
import pytest

from superset import db

from superset.models.core import Log
from superset.models.tags import get_tag, ObjectTypes, TaggedObject, TagTypes
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from superset.tasks.cache import (
    DashboardTagsStrategy,
    TopNDashboardsStrategy,
)

from .base_tests import SupersetTestCase

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
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_top_n_dashboards_strategy(self):
        # create a top visited dashboard
        db.session.query(Log).delete()
        self.login(username="admin")
        dash = self.get_dash_by_slug("births")
        for _ in range(10):
            self.client.get(f"/superset/dashboard/{dash.id}/")

        strategy = TopNDashboardsStrategy(1)
        result = strategy.get_urls()
        expected = [f"{URL_PREFIX}{dash.url}"]
        self.assertEqual(result, expected)

    def reset_tag(self, tag):
        """Remove associated object from tag, used to reset tests"""
        if tag.objects:
            for o in tag.objects:
                db.session.delete(o)
            db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
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
        tag1_urls = [f"{URL_PREFIX}{dash.url}"]
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
