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
from superset import db
from superset.models.core import Log
from superset.models.tags import (
    get_tag,
    ObjectTypes,
    TaggedObject,
    TagTypes,
)
from superset.tasks.cache import (
    DashboardTagsStrategy,
    DummyStrategy,
    TopNDashboardsStrategy,
)
from .base_tests import SupersetTestCase


class CacheWarmUpTests(SupersetTestCase):

    def __init__(self, *args, **kwargs):
        super(CacheWarmUpTests, self).__init__(*args, **kwargs)

    def test_dummy_strategy(self):
        strategy = DummyStrategy()
        result = sorted(strategy.get_urls())
        expected = [
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=1',
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=17',
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=18',
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=19',
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=30',
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=31',
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=8',
        ]
        self.assertEqual(result, expected)

    def test_top_n_dashboards_strategy(self):
        # create a top visited dashboard
        db.session.query(Log).delete()
        self.login(username='admin')
        for _ in range(10):
            self.client.get('/superset/dashboard/3/')

        strategy = TopNDashboardsStrategy(1)
        result = sorted(strategy.get_urls())
        expected = [
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=31',
        ]
        self.assertEqual(result, expected)

    def test_dashboard_tags(self):
        strategy = DashboardTagsStrategy(['tag1'])

        result = sorted(strategy.get_urls())
        expected = []
        self.assertEqual(result, expected)

        # tag dashboard 3 with `tag1`
        tag1 = get_tag('tag1', db.session, TagTypes.custom)
        object_id = 3
        tagged_object = TaggedObject(
            tag_id=tag1.id,
            object_id=object_id,
            object_type=ObjectTypes.dashboard,
        )
        db.session.add(tagged_object)
        db.session.commit()

        result = sorted(strategy.get_urls())
        expected = [
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=31',
        ]
        self.assertEqual(result, expected)

        strategy = DashboardTagsStrategy(['tag2'])

        result = sorted(strategy.get_urls())
        expected = []
        self.assertEqual(result, expected)

        # tag chart 30 with `tag2`
        tag2 = get_tag('tag2', db.session, TagTypes.custom)
        object_id = 30
        tagged_object = TaggedObject(
            tag_id=tag2.id,
            object_id=object_id,
            object_type=ObjectTypes.chart,
        )
        db.session.add(tagged_object)
        db.session.commit()

        result = sorted(strategy.get_urls())
        expected = [
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=30',
        ]
        self.assertEqual(result, expected)

        strategy = DashboardTagsStrategy(['tag1', 'tag2'])

        result = sorted(strategy.get_urls())
        expected = [
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=30',
            'http://0.0.0.0:8081/superset/warm_up_cache/?slice_id=31',
        ]
        self.assertEqual(result, expected)
