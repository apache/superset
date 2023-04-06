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
import copy
import json
from operator import and_
import time
from unittest.mock import patch
import pytest
from superset.dao.exceptions import DAOCreateFailedError, DAOException
from superset.models.slice import Slice
from superset.models.sql_lab import SavedQuery
from superset.tags.dao import TagDAO
from superset.tags.exceptions import InvalidTagNameError
from superset.tags.models import ObjectTypes, Tag, TaggedObject
from tests.integration_tests.tags.api_tests import TAGS_FIXTURE_COUNT

import tests.integration_tests.test_app  # pylint: disable=unused-import
from superset import db, security_manager
from superset.dashboards.dao import DashboardDAO
from superset.models.dashboard import Dashboard
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)
from tests.integration_tests.fixtures.tags import with_tagging_system_feature


class TestTagsDAO(SupersetTestCase):
    def insert_tag(
        self,
        name: str,
        tag_type: str,
    ) -> Tag:
        tag_name = name.strip()
        tag = Tag(
            name=tag_name,
            type=tag_type,
        )
        db.session.add(tag)
        db.session.commit()
        return tag

    def insert_tagged_object(
        self,
        tag_id: int,
        object_id: int,
        object_type: ObjectTypes,
    ) -> TaggedObject:
        tag = db.session.query(Tag).filter(Tag.id == tag_id).first()
        tagged_object = TaggedObject(
            tag=tag, object_id=object_id, object_type=object_type.name
        )
        db.session.add(tagged_object)
        db.session.commit()
        return tagged_object

    @pytest.fixture()
    def create_tags(self):
        with self.create_app().app_context():
            # clear tags table
            tags = db.session.query(Tag)
            for tag in tags:
                db.session.delete(tag)
                db.session.commit()
            db.session.commit()
            tags = []
            for cx in range(TAGS_FIXTURE_COUNT):
                tags.append(
                    self.insert_tag(
                        name=f"example_tag_{cx}",
                        tag_type="custom",
                    )
                )
            yield tags

    @pytest.fixture()
    def create_tagged_objects(self):
        with self.create_app().app_context():
            # clear tags table
            tags = db.session.query(Tag)
            for tag in tags:
                db.session.delete(tag)
                db.session.commit()
            tags = []
            for cx in range(TAGS_FIXTURE_COUNT):
                tags.append(
                    self.insert_tag(
                        name=f"example_tag_{cx}",
                        tag_type="custom",
                    )
                )
            # clear tagged objects table
            tagged_objects = db.session.query(TaggedObject)
            for tagged_obj in tagged_objects:
                db.session.delete(tagged_obj)
                db.session.commit()
            tagged_objects = []
            dashboard_id = 1
            for tag in tags:
                tagged_objects.append(
                    self.insert_tagged_object(
                        object_id=dashboard_id,
                        object_type=ObjectTypes.dashboard,
                        tag_id=tag.id,
                    )
                )

            yield tagged_objects

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    # test create tag
    def test_create_tagged_objects(self):
        # test that a tag cannot be added if it has ':' in it
        with pytest.raises(DAOCreateFailedError):
            TagDAO.create_custom_tagged_objects(
                object_type=ObjectTypes.dashboard.name,
                object_id=1,
                tag_names=["invalid:example tag 1"],
            )

        # test that a tag can be added if it has a valid name
        TagDAO.create_custom_tagged_objects(
            object_type=ObjectTypes.dashboard.name,
            object_id=1,
            tag_names=["example tag 1"],
        )
        # check if tag exists
        assert db.session.query(Tag).filter(Tag.name == "example tag 1").first()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    @pytest.mark.usefixtures("create_tags")
    # test get objects from tag
    def test_get_objects_from_tag(self):
        # create tagged objects
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "World Bank's Data")
            .first()
        )
        dashboard_id = dashboard.id
        tag = db.session.query(Tag).filter_by(name="example_tag_1").one()
        self.insert_tagged_object(
            object_id=dashboard_id, object_type=ObjectTypes.dashboard, tag_id=tag.id
        )
        # get objects
        tagged_objects = TagDAO.get_tagged_objects_for_tags(
            ["example_tag_1", "example_tag_2"]
        )
        assert len(tagged_objects) == 1

        # test get objects from tag with type
        tagged_objects = TagDAO.get_tagged_objects_for_tags(
            ["example_tag_1", "example_tag_2"], obj_types=["dashboard", "chart"]
        )
        assert len(tagged_objects) == 1
        tagged_objects = TagDAO.get_tagged_objects_for_tags(
            ["example_tag_1", "example_tag_2"], obj_types=["chart"]
        )
        assert len(tagged_objects) == 0
        # test get all objects
        num_charts = (
            db.session.query(Slice)
            .join(
                TaggedObject,
                and_(
                    TaggedObject.object_id == Slice.id,
                    TaggedObject.object_type == ObjectTypes.chart,
                ),
            )
            .distinct(Slice.id)
            .count()
        )
        num_charts_and_dashboards = (
            db.session.query(Dashboard)
            .join(
                TaggedObject,
                and_(
                    TaggedObject.object_id == Dashboard.id,
                    TaggedObject.object_type == ObjectTypes.dashboard,
                ),
            )
            .distinct(Dashboard.id)
            .count()
            + num_charts
        )
        # gets all tagged objects of type dashboard and chart
        tagged_objects = TagDAO.get_tagged_objects_for_tags(
            obj_types=["dashboard", "chart"]
        )
        assert len(tagged_objects) == num_charts_and_dashboards
        # test objects are retrieved by type
        tagged_objects = TagDAO.get_tagged_objects_for_tags(obj_types=["chart"])
        assert len(tagged_objects) == num_charts

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    @pytest.mark.usefixtures("create_tagged_objects")
    def test_find_tagged_object(self):
        tag = db.session.query(Tag).filter(Tag.name == "example_tag_1").first()
        tagged_object = TagDAO.find_tagged_object(
            object_id=1, object_type=ObjectTypes.dashboard.name, tag_id=tag.id
        )
        assert tagged_object is not None

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    @pytest.mark.usefixtures("create_tagged_objects")
    def test_find_by_name(self):
        # test tag can be found
        tag = TagDAO.find_by_name("example_tag_1")
        assert tag is not None
        # tag that doesnt exist
        tag = TagDAO.find_by_name("invalid_tag_1")
        assert tag is None
        # tag was not created
        assert db.session.query(Tag).filter(Tag.name == "invalid_tag_1").first() is None

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    @pytest.mark.usefixtures("create_tagged_objects")
    def test_get_by_name(self):
        # test tag can be found
        tag = TagDAO.get_by_name("example_tag_1")
        assert tag is not None
        # tag that doesnt exist is added
        tag = TagDAO.get_by_name("invalid_tag_1")
        assert tag is not None
        # tag was created
        tag = db.session.query(Tag).filter(Tag.name == "invalid_tag_1").first()
        assert tag is not None

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    @pytest.mark.usefixtures("create_tags")
    def test_delete_tags(self):
        tag_names = ["example_tag_1", "example_tag_2"]
        for tag_name in tag_names:
            tag = db.session.query(Tag).filter(Tag.name == tag_name).first()
            assert tag is not None

        TagDAO.delete_tags(tag_names)

        for tag_name in tag_names:
            tag = db.session.query(Tag).filter(Tag.name == tag_name).first()
            assert tag is None

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    @pytest.mark.usefixtures("create_tagged_objects")
    def test_delete_tagged_object(self):
        tag = db.session.query(Tag).filter(Tag.name == "example_tag_1").first()
        tagged_object = (
            db.session.query(TaggedObject)
            .filter(
                TaggedObject.tag_id == tag.id,
                TaggedObject.object_id == 1,
                TaggedObject.object_type == ObjectTypes.dashboard.name,
            )
            .first()
        )
        assert tagged_object is not None
        TagDAO.delete_tagged_object(
            object_type=ObjectTypes.dashboard.name, object_id=1, tag_name=tag.name
        )
        tagged_object = (
            db.session.query(TaggedObject)
            .filter(
                TaggedObject.tag_id == tag.id,
                TaggedObject.object_id == 1,
                TaggedObject.object_type == ObjectTypes.dashboard.name,
            )
            .first()
        )
        assert tagged_object is None

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    def test_validate_tag_name(self):
        assert TagDAO.validate_tag_name("example_tag_name") is True
        assert TagDAO.validate_tag_name("invalid:tag_name") is False
        db.session.query(TaggedObject).delete()
        db.session.query(Tag).delete()
