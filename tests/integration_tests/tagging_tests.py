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


import pytest

from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.core import FavStar
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import SavedQuery
from superset.tags.models import TaggedObject
from superset.utils.core import DatasourceType
from superset.utils.database import get_main_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.fixtures.tags import (
    with_tagging_system_feature,  # noqa: F401
)


class TestTagging(SupersetTestCase):
    def query_tagged_object_table(self):
        query = db.session.query(TaggedObject).all()
        return query

    def clear_tagged_object_table(self):
        db.session.query(TaggedObject).delete()
        db.session.commit()

    @pytest.mark.usefixtures("with_tagging_system_feature")
    def test_dataset_tagging(self):
        """
        Test to make sure that when a new dataset is created,
        a corresponding tag in the tagged_objects table
        is created
        """

        # Remove all existing rows in the tagged_object table
        self.clear_tagged_object_table()

        # Test to make sure nothing is in the tagged_object table
        assert [] == self.query_tagged_object_table()

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
        assert 1 == len(tags)
        assert "ObjectType.dataset" == str(tags[0].object_type)
        assert test_dataset.id == tags[0].object_id

        # Cleanup the db
        db.session.delete(test_dataset)
        db.session.commit()

        # Test to make sure the tag is deleted when the associated object is deleted
        assert [] == self.query_tagged_object_table()

    @pytest.mark.usefixtures("with_tagging_system_feature")
    def test_chart_tagging(self):
        """
        Test to make sure that when a new chart is created,
        a corresponding tag in the tagged_objects table
        is created
        """

        # Remove all existing rows in the tagged_object table
        self.clear_tagged_object_table()

        # Test to make sure nothing is in the tagged_object table
        assert [] == self.query_tagged_object_table()

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
        assert 1 == len(tags)
        assert "ObjectType.chart" == str(tags[0].object_type)
        assert test_chart.id == tags[0].object_id

        # Cleanup the db
        db.session.delete(test_chart)
        db.session.commit()

        # Test to make sure the tag is deleted when the associated object is deleted
        assert [] == self.query_tagged_object_table()

    @pytest.mark.usefixtures("with_tagging_system_feature")
    def test_dashboard_tagging(self):
        """
        Test to make sure that when a new dashboard is created,
        a corresponding tag in the tagged_objects table
        is created
        """

        # Remove all existing rows in the tagged_object table
        self.clear_tagged_object_table()

        # Test to make sure nothing is in the tagged_object table
        assert [] == self.query_tagged_object_table()

        # Create a dashboard and add it to the db
        test_dashboard = Dashboard()
        test_dashboard.dashboard_title = "test_dashboard"
        test_dashboard.slug = "test_slug"
        test_dashboard.published = True

        db.session.add(test_dashboard)
        db.session.commit()

        # Test to make sure that a dashboard tag was added to the tagged_object table
        tags = self.query_tagged_object_table()
        assert 1 == len(tags)
        assert "ObjectType.dashboard" == str(tags[0].object_type)
        assert test_dashboard.id == tags[0].object_id

        # Cleanup the db
        db.session.delete(test_dashboard)
        db.session.commit()

        # Test to make sure the tag is deleted when the associated object is deleted
        assert [] == self.query_tagged_object_table()

    @pytest.mark.usefixtures("with_tagging_system_feature")
    def test_saved_query_tagging(self):
        """
        Test to make sure that when a new saved query is
        created, a corresponding tag in the tagged_objects
        table is created
        """

        # Remove all existing rows in the tagged_object table
        self.clear_tagged_object_table()

        # Test to make sure nothing is in the tagged_object table
        assert [] == self.query_tagged_object_table()

        # Create a saved query and add it to the db
        test_saved_query = SavedQuery(id=1, label="test saved query")
        db.session.add(test_saved_query)
        db.session.commit()

        # Test to make sure that a saved query tag was added to the tagged_object table
        tags = self.query_tagged_object_table()

        assert 2 == len(tags)

        assert "ObjectType.query" == str(tags[0].object_type)
        assert "owner:None" == str(tags[0].tag.name)
        assert "TagType.owner" == str(tags[0].tag.type)
        assert test_saved_query.id == tags[0].object_id

        assert "ObjectType.query" == str(tags[1].object_type)
        assert "type:query" == str(tags[1].tag.name)
        assert "TagType.type" == str(tags[1].tag.type)
        assert test_saved_query.id == tags[1].object_id

        # Cleanup the db
        db.session.delete(test_saved_query)
        db.session.commit()

        # Test to make sure the tag is deleted when the associated object is deleted
        assert [] == self.query_tagged_object_table()

    @pytest.mark.usefixtures("with_tagging_system_feature")
    def test_favorite_tagging(self):
        """
        Test to make sure that when a new favorite object is
        created, a corresponding tag in the tagged_objects
        table is created
        """

        # Remove all existing rows in the tagged_object table
        self.clear_tagged_object_table()

        # Test to make sure nothing is in the tagged_object table
        assert [] == self.query_tagged_object_table()

        # Create a favorited object and add it to the db
        test_saved_query = FavStar(user_id=1, class_name="slice", obj_id=1)
        db.session.add(test_saved_query)
        db.session.commit()

        # Test to make sure that a favorited object tag was added to the tagged_object table  # noqa: E501
        tags = self.query_tagged_object_table()
        assert 1 == len(tags)
        assert "ObjectType.chart" == str(tags[0].object_type)
        assert test_saved_query.obj_id == tags[0].object_id

        # Cleanup the db
        db.session.delete(test_saved_query)
        db.session.commit()

        # Test to make sure the tag is deleted when the associated object is deleted
        assert [] == self.query_tagged_object_table()

    @with_feature_flags(TAGGING_SYSTEM=False)
    def test_tagging_system(self):
        """
        Test to make sure that when the TAGGING_SYSTEM
        feature flag is false, that no tags are created
        """

        # Remove all existing rows in the tagged_object table
        self.clear_tagged_object_table()

        # Test to make sure nothing is in the tagged_object table
        assert [] == self.query_tagged_object_table()

        # Create a dataset and add it to the db
        test_dataset = SqlaTable(
            table_name="foo",
            schema=None,
            owners=[],
            database=get_main_database(),
            sql=None,
            extra='{"certification": 1}',
        )

        # Create a chart and add it to the db
        test_chart = Slice(
            slice_name="test_chart",
            datasource_type=DatasourceType.TABLE,
            viz_type="bubble",
            datasource_id=1,
            id=1,
        )

        # Create a dashboard and add it to the db
        test_dashboard = Dashboard()
        test_dashboard.dashboard_title = "test_dashboard"
        test_dashboard.slug = "test_slug"
        test_dashboard.published = True

        # Create a saved query and add it to the db
        test_saved_query = SavedQuery(id=1, label="test saved query")

        # Create a favorited object and add it to the db
        test_favorited_object = FavStar(user_id=1, class_name="slice", obj_id=1)

        db.session.add(test_dataset)
        db.session.add(test_chart)
        db.session.add(test_dashboard)
        db.session.add(test_saved_query)
        db.session.add(test_favorited_object)
        db.session.commit()

        # Test to make sure that no tags were added to the tagged_object table
        tags = self.query_tagged_object_table()
        assert 0 == len(tags)

        # Cleanup the db
        db.session.delete(test_dataset)
        db.session.delete(test_chart)
        db.session.delete(test_dashboard)
        db.session.delete(test_saved_query)
        db.session.delete(test_favorited_object)
        db.session.commit()

        # Test to make sure all the tags are deleted when the associated objects are deleted  # noqa: E501
        assert [] == self.query_tagged_object_table()
