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

from sqlalchemy import func

from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.core import FavStar
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.tags import Tag, TaggedObject
from superset.utils.core import DatasourceType
from superset.utils.database import get_main_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags


class TestTagging(SupersetTestCase):
    def query_tagged_object_table(self):
        query = (db.session.query(TaggedObject).all())
        return query

    @with_feature_flags(TAGGING_SYSTEM=False)
    def test_tag_view_disabled(self):
        self.login("admin")
        response = self.client.get("/tagview/tags/suggestions/")
        self.assertEqual(404, response.status_code)

    @with_feature_flags(TAGGING_SYSTEM=True)
    def test_tag_view_enabled(self):
        self.login("admin")
        response = self.client.get("/tagview/tags/suggestions/")
        self.assertNotEqual(404, response.status_code)

    @with_feature_flags(TAGGING_SYSTEM=True)
    def test_dataset_tagging(self):
        """
        Test to make sure that when a new dataset is created,
        a corresponding tag in the tagged_objects table
        is created
        """

        # Test to make sure nothing is in the tagged_object table
        self.assertEqual([], self.query_tagged_object_table())

        # Create a dataset and add it to the db
        test_dataset = SqlaTable(
            table_name="foo",
            schema=None,
            owners=[],
            database=get_main_database(),
            sql=None,
            extra='{"certification": 1}',
        )
        db.session.add(test_dataset)
        db.session.commit()

        # Test to make sure that a dataset tag was added to the tagged_object table
        tags = self.query_tagged_object_table()
        self.assertEqual(1, len(tags))
        self.assertEqual("ObjectTypes.dataset", str(tags[0].object_type))
        self.assertEqual(test_dataset.id, tags[0].object_id)

        # Cleanup the db
        db.session.delete(test_dataset)
        db.session.commit()

    @with_feature_flags(TAGGING_SYSTEM=True)
    def test_chart_tagging(self):
        """
        Test to make sure that when a new chart is created,
        a corresponding tag in the tagged_objects table
        is created
        """

        # Test to make sure nothing is in the tagged_object table
        self.assertEqual([], self.query_tagged_object_table())

        # Create a chart and add it to the db
        test_chart = Slice(
            slice_name="test_chart",
            datasource_type=DatasourceType.TABLE,
            viz_type="bubble",
            datasource_id=1,
            id=1,
        )
        db.session.add(test_chart)
        db.session.commit()

        # Test to make sure that a chart tag was added to the tagged_object table
        tags = self.query_tagged_object_table()
        self.assertEqual(1, len(tags))
        self.assertEqual("ObjectTypes.chart", str(tags[0].object_type))
        self.assertEqual(test_chart.id, tags[0].object_id)

        # Cleanup the db
        db.session.delete(test_chart)
        db.session.commit()

    @with_feature_flags(TAGGING_SYSTEM=True)
    def test_dashboard_tagging(self):
        """
        Test to make sure that when a new dashboard is created,
        a corresponding tag in the tagged_objects table
        is created
        """

        # Test to make sure nothing is in the tagged_object table
        self.assertEqual([], self.query_tagged_object_table())

        # Create a dashboard and add it to the db
        test_dashboard = Dashboard()
        test_dashboard.dashboard_title = "test_dashboard"
        test_dashboard.slug = "test_slug"
        test_dashboard.slices = []
        test_dashboard.published = True

        db.session.add(test_dashboard)
        db.session.commit()

        # Test to make sure that a dashboard tag was added to the tagged_object table
        tags = self.query_tagged_object_table()
        self.assertEqual(1, len(tags))
        self.assertEqual("ObjectTypes.dashboard", str(tags[0].object_type))
        self.assertEqual(test_dashboard.id, tags[0].object_id)

        # Cleanup the db
        db.session.delete(test_dashboard)
        db.session.commit()

    @with_feature_flags(TAGGING_SYSTEM=True)
    def test_saved_query_tagging(self):
        """
        Test to make sure that when a new saved query is
        created, a corresponding tag in the tagged_objects
        table is created
        """

        # Test to make sure nothing is in the tagged_object table
        self.assertEqual([], self.query_tagged_object_table())

        # Create a saved query and add it to the db
        test_saved_query = FavStar(user_id=1, class_name="slice", obj_id=1)
        db.session.add(test_saved_query)
        db.session.commit()

        # Test to make sure that a saved query tag was added to the tagged_object table
        tags = self.query_tagged_object_table()
        self.assertEqual(1, len(tags))
        self.assertEqual("ObjectTypes.chart", str(tags[0].object_type))
        self.assertEqual(test_saved_query.obj_id, tags[0].object_id)

        # Cleanup the db
        db.session.delete(test_saved_query)
        db.session.commit()
