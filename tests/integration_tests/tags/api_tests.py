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
"""Unit tests for Superset"""
from datetime import datetime, timedelta
import json
import random
import string

import pytest
import prison
from sqlalchemy.sql import func
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import SavedQuery

import tests.integration_tests.test_app
from superset import db, security_manager
from superset.common.db_query_status import QueryStatus
from superset.models.core import Database
from superset.utils.database import get_example_database, get_main_database
from superset.tags.models import ObjectTypes, Tag, TagTypes, TaggedObject
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)
from tests.integration_tests.fixtures.tags import with_tagging_system_feature
from tests.integration_tests.base_tests import SupersetTestCase

TAGS_FIXTURE_COUNT = 10

TAGS_LIST_COLUMNS = [
    "id",
    "name",
    "type",
    "changed_by.first_name",
    "changed_by.last_name",
    "changed_on_delta_humanized",
    "created_by.first_name",
    "created_by.last_name",
]


class TestTagApi(SupersetTestCase):
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
            tags = []
            for cx in range(TAGS_FIXTURE_COUNT):
                tags.append(
                    self.insert_tag(
                        name=f"example_tag_{cx}",
                        tag_type="custom",
                    )
                )
            yield

            # rollback changes
            for tag in tags:
                db.session.delete(tag)
                db.session.commit()

    def test_get_tag(self):
        """
        Query API: Test get query
        """
        tag = self.insert_tag(
            name="test get tag",
            tag_type="custom",
        )
        self.login(username="admin")
        uri = f"api/v1/tag/{tag.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        expected_result = {
            "changed_by": None,
            "changed_on_delta_humanized": "now",
            "created_by": None,
            "id": tag.id,
            "name": "test get tag",
            "type": TagTypes.custom.value,
        }
        data = json.loads(rv.data.decode("utf-8"))
        for key, value in expected_result.items():
            self.assertEqual(value, data["result"][key])
        # rollback changes
        db.session.delete(tag)
        db.session.commit()

    def test_get_tag_not_found(self):
        """
        Query API: Test get query not found
        """
        tag = self.insert_tag(name="test tag", tag_type="custom")
        max_id = db.session.query(func.max(Tag.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/tag/{max_id + 1}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)
        # cleanup
        db.session.delete(tag)
        db.session.commit()

    @pytest.mark.usefixtures("create_tags")
    def test_get_list_tag(self):
        """
        Query API: Test get list query
        """
        self.login(username="admin")
        uri = "api/v1/tag/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == TAGS_FIXTURE_COUNT
        # check expected columns
        assert data["list_columns"] == TAGS_LIST_COLUMNS

    # test add tagged objects
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_add_tagged_objects(self):
        self.login(username="admin")
        # clean up tags and tagged objects
        tags = db.session.query(Tag)
        for tag in tags:
            db.session.delete(tag)
            db.session.commit()
        tagged_objects = db.session.query(TaggedObject)
        for tagged_object in tagged_objects:
            db.session.delete(tagged_object)
            db.session.commit()
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "World Bank's Data")
            .first()
        )
        dashboard_id = dashboard.id
        dashboard_type = ObjectTypes.dashboard.value
        uri = f"api/v1/tag/{dashboard_type}/{dashboard_id}/"
        example_tag_names = ["example_tag_1", "example_tag_2"]
        data = {"properties": {"tags": example_tag_names}}
        rv = self.client.post(uri, json=data, follow_redirects=True)
        # successful request
        self.assertEqual(rv.status_code, 201)
        # check that tags were created in database
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tag_names))
        self.assertEqual(tags.count(), 2)
        # check that tagged objects were created
        tag_ids = [tags[0].id, tags[1].id]
        tagged_objects = db.session.query(TaggedObject).filter(
            TaggedObject.tag_id.in_(tag_ids),
            TaggedObject.object_id == dashboard_id,
            TaggedObject.object_type == ObjectTypes.dashboard,
        )
        assert tagged_objects.count() == 2
        # clean up tags and tagged objects
        for tagged_object in tagged_objects:
            db.session.delete(tagged_object)
            db.session.commit()
        for tag in tags:
            db.session.delete(tag)
            db.session.commit()

    # test delete tagged object
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("create_tags")
    def test_delete_tagged_objects(self):
        self.login(username="admin")
        dashboard_id = 1
        dashboard_type = ObjectTypes.dashboard
        tag_names = ["example_tag_1", "example_tag_2"]
        tags = db.session.query(Tag).filter(Tag.name.in_(tag_names))
        assert tags.count() == 2
        self.insert_tagged_object(
            tag_id=tags.first().id, object_id=dashboard_id, object_type=dashboard_type
        )
        self.insert_tagged_object(
            tag_id=tags[1].id, object_id=dashboard_id, object_type=dashboard_type
        )
        tagged_object = (
            db.session.query(TaggedObject)
            .filter(
                TaggedObject.tag_id == tags.first().id,
                TaggedObject.object_id == dashboard_id,
                TaggedObject.object_type == dashboard_type.name,
            )
            .first()
        )
        other_tagged_object = (
            db.session.query(TaggedObject)
            .filter(
                TaggedObject.tag_id == tags[1].id,
                TaggedObject.object_id == dashboard_id,
                TaggedObject.object_type == dashboard_type.name,
            )
            .first()
        )
        assert tagged_object is not None
        uri = f"api/v1/tag/{dashboard_type.value}/{dashboard_id}/{tags.first().name}"
        rv = self.client.delete(uri, follow_redirects=True)
        # successful request
        self.assertEqual(rv.status_code, 200)
        # ensure that tagged object no longer exists
        tagged_object = (
            db.session.query(TaggedObject)
            .filter(
                TaggedObject.tag_id == tags.first().id,
                TaggedObject.object_id == dashboard_id,
                TaggedObject.object_type == dashboard_type.name,
            )
            .first()
        )
        assert not tagged_object
        # ensure the other tagged objects still exist
        other_tagged_object = (
            db.session.query(TaggedObject)
            .filter(
                TaggedObject.object_id == dashboard_id,
                TaggedObject.object_type == dashboard_type.name,
                TaggedObject.tag_id == tags[1].id,
            )
            .first()
        )
        assert other_tagged_object is not None
        # clean up tagged object
        db.session.delete(other_tagged_object)

    # test get objects
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("create_tags")
    def test_get_objects_by_tag(self):
        self.login(username="admin")
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "World Bank's Data")
            .first()
        )
        dashboard_id = dashboard.id
        dashboard_type = ObjectTypes.dashboard
        tag_names = ["example_tag_1", "example_tag_2"]
        tags = db.session.query(Tag).filter(Tag.name.in_(tag_names))
        for tag in tags:
            self.insert_tagged_object(
                tag_id=tag.id, object_id=dashboard_id, object_type=dashboard_type
            )
        tagged_objects = db.session.query(TaggedObject).filter(
            TaggedObject.tag_id.in_([tag.id for tag in tags]),
            TaggedObject.object_id == dashboard_id,
            TaggedObject.object_type == dashboard_type.name,
        )
        self.assertEqual(tagged_objects.count(), 2)
        uri = f'api/v1/tag/get_objects/?tags={",".join(tag_names)}'
        rv = self.client.get(uri)
        # successful request
        self.assertEqual(rv.status_code, 200)
        fetched_objects = rv.json["result"]
        self.assertEqual(len(fetched_objects), 1)
        self.assertEqual(fetched_objects[0]["id"], dashboard_id)
        # clean up tagged object
        tagged_objects.delete()

    # test get all objects
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("create_tags")
    def test_get_all_objects(self):
        self.login(username="admin")
        # tag the dashboard with id 1
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "World Bank's Data")
            .first()
        )
        dashboard_id = dashboard.id
        dashboard_type = ObjectTypes.dashboard
        tag_names = ["example_tag_1", "example_tag_2"]
        tags = db.session.query(Tag).filter(Tag.name.in_(tag_names))
        for tag in tags:
            self.insert_tagged_object(
                tag_id=tag.id, object_id=dashboard_id, object_type=dashboard_type
            )
        tagged_objects = db.session.query(TaggedObject).filter(
            TaggedObject.tag_id.in_([tag.id for tag in tags]),
            TaggedObject.object_id == dashboard_id,
            TaggedObject.object_type == dashboard_type.name,
        )
        self.assertEqual(tagged_objects.count(), 2)
        self.assertEqual(tagged_objects.first().object_id, dashboard_id)
        uri = "api/v1/tag/get_objects/"
        rv = self.client.get(uri)
        # successful request
        self.assertEqual(rv.status_code, 200)
        fetched_objects = rv.json["result"]
        # check that the dashboard object was fetched
        assert dashboard_id in [obj["id"] for obj in fetched_objects]
        # clean up tagged object
        tagged_objects.delete()

    # test delete tags
    @pytest.mark.usefixtures("create_tags")
    def test_delete_tags(self):
        self.login(username="admin")
        # check that tags exist in the database
        example_tag_names = ["example_tag_1", "example_tag_2", "example_tag_3"]
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tag_names))
        self.assertEqual(tags.count(), 3)
        # delete the first tag
        uri = f"api/v1/tag/?q={prison.dumps(example_tag_names[:1])}"
        rv = self.client.delete(uri, follow_redirects=True)
        # successful request
        self.assertEqual(rv.status_code, 200)
        # check that tag does not exist in the database
        tag = db.session.query(Tag).filter(Tag.name == example_tag_names[0]).first()
        assert tag is None
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tag_names))
        self.assertEqual(tags.count(), 2)
        # delete multiple tags
        uri = f"api/v1/tag/?q={prison.dumps(example_tag_names[1:])}"
        rv = self.client.delete(uri, follow_redirects=True)
        # successful request
        self.assertEqual(rv.status_code, 200)
        # check that tags are all gone
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tag_names))
        self.assertEqual(tags.count(), 0)
