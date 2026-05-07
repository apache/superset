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
"""Unit tests for Superset"""

from datetime import datetime
from unittest.mock import patch
from urllib import parse

import prison
import pytest
from freezegun import freeze_time
from markupsafe import Markup
from sqlalchemy import and_
from sqlalchemy.sql import func

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.daos.tag import TagDAO
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.tags.models import (
    ObjectType,
    Tag,
    TaggedObject,
    TagType,
    user_favorite_tag_table,
)
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, ALPHA_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)
from tests.integration_tests.insert_chart_mixin import InsertChartMixin

TAGS_FIXTURE_COUNT = 10

TAGS_LIST_COLUMNS = [
    "id",
    "name",
    "type",
    "description",
    "changed_by.first_name",
    "changed_by.last_name",
    "changed_on_delta_humanized",
    "created_on_delta_humanized",
    "created_by.first_name",
    "created_by.last_name",
]


class TestTagApi(InsertChartMixin, SupersetTestCase):
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
        object_type: ObjectType,
    ) -> TaggedObject:
        tag = db.session.query(Tag).filter(Tag.id == tag_id).first()
        tagged_object = TaggedObject(
            tag=tag, object_id=object_id, object_type=object_type.name
        )
        db.session.add(tagged_object)
        db.session.commit()
        return tagged_object

    @pytest.fixture
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
        with freeze_time(datetime.now()):
            tag = self.insert_tag(
                name="test get tag",
                tag_type="custom",
            )
            self.login(ADMIN_USERNAME)
            uri = f"api/v1/tag/{tag.id}"
            rv = self.client.get(uri)
        assert rv.status_code == 200
        expected_result = {
            "changed_by": None,
            "changed_on_delta_humanized": "now",
            "created_by": None,
            "id": tag.id,
            "name": "test get tag",
            "type": TagType.custom.value,
        }
        data = json.loads(rv.data.decode("utf-8"))
        for key, value in expected_result.items():
            assert value == data["result"][key]
        # rollback changes
        db.session.delete(tag)
        db.session.commit()

    def test_get_tag_user_fields(self):
        """
        Query API: Test get tag only returns first_name and last_name for
        created_by and changed_by fields
        """
        self.login(ADMIN_USERNAME)
        # Create tag via API to ensure created_by is set
        uri = "api/v1/tag/"
        rv = self.client.post(
            uri,
            json={"name": "test_user_fields_tag", "objects_to_tag": []},
        )
        assert rv.status_code == 201

        # Get the created tag
        tag = db.session.query(Tag).filter(Tag.name == "test_user_fields_tag").first()
        assert tag is not None

        # Fetch the tag via GET API
        uri = f"api/v1/tag/{tag.id}"
        rv = self.client.get(uri)
        assert rv.status_code == 200

        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]

        # Verify created_by only contains first_name and last_name
        assert result["created_by"] is not None
        assert set(result["created_by"].keys()) == {"first_name", "last_name"}
        assert result["created_by"]["first_name"] is not None
        assert result["created_by"]["last_name"] is not None

        # Verify changed_by only contains first_name and last_name (or is None)
        if result["changed_by"] is not None:
            assert set(result["changed_by"].keys()) == {"first_name", "last_name"}

        # Cleanup
        db.session.delete(tag)
        db.session.commit()

    def test_get_tag_not_found(self):
        """
        Query API: Test get query not found
        """
        tag = self.insert_tag(name="test tag", tag_type="custom")
        max_id = db.session.query(func.max(Tag.id)).scalar()
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/tag/{max_id + 1}"
        rv = self.client.get(uri)
        assert rv.status_code == 404
        # cleanup
        db.session.delete(tag)
        db.session.commit()

    @pytest.mark.usefixtures("create_tags")
    def test_get_list_tag(self):
        """
        Query API: Test get list query
        """
        self.login(ADMIN_USERNAME)
        uri = "api/v1/tag/"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == TAGS_FIXTURE_COUNT
        # check expected columns
        assert data["list_columns"] == TAGS_LIST_COLUMNS

    def test_get_list_tag_filtered(self):
        """
        Query API: Test get list query applying filters for
        type == "custom" and type != "custom"
        """
        tags = [
            {"name": "Test custom Tag", "type": "custom"},
            {"name": "type:dashboard", "type": "type"},
            {"name": "owner:1", "type": "owner"},
            {"name": "Another Tag", "type": "custom"},
            {"name": "favorited_by:1", "type": "favorited_by"},
        ]

        for tag in tags:
            self.insert_tag(
                name=tag["name"],
                tag_type=tag["type"],
            )
        self.login(ADMIN_USERNAME)

        # Only user-created tags
        query = {
            "filters": [
                {
                    "col": "type",
                    "opr": "custom_tag",
                    "value": True,
                }
            ],
        }
        uri = f"api/v1/tag/?{parse.urlencode({'q': prison.dumps(query)})}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 2

        # Only system tags
        query["filters"][0]["value"] = False
        uri = f"api/v1/tag/?{parse.urlencode({'q': prison.dumps(query)})}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 3

    # test add tagged objects
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_add_tagged_objects(self):
        self.login(ADMIN_USERNAME)
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
        dashboard_type = ObjectType.dashboard.value
        uri = f"api/v1/tag/{dashboard_type}/{dashboard_id}/"
        example_tag_names = ["example_tag_1", "example_tag_2"]
        data = {"properties": {"tags": example_tag_names}}
        rv = self.client.post(uri, json=data, follow_redirects=True)
        # successful request
        assert rv.status_code == 201
        # check that tags were created in database
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tag_names))
        assert tags.count() == 2
        # check that tagged objects were created
        tag_ids = [tags[0].id, tags[1].id]
        tagged_objects = db.session.query(TaggedObject).filter(
            TaggedObject.tag_id.in_(tag_ids),
            TaggedObject.object_id == dashboard_id,
            TaggedObject.object_type == ObjectType.dashboard,
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
        self.login(ADMIN_USERNAME)
        dashboard_id = 1
        dashboard_type = ObjectType.dashboard
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
        assert rv.status_code == 200
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
        self.login(ADMIN_USERNAME)
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "World Bank's Data")
            .first()
        )
        dashboard_id = dashboard.id
        dashboard_type = ObjectType.dashboard
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
        assert tagged_objects.count() == 2
        uri = f"api/v1/tag/get_objects/?tags={','.join(tag_names)}"
        rv = self.client.get(uri)
        # successful request
        assert rv.status_code == 200
        fetched_objects = rv.json["result"]
        assert len(fetched_objects) == 1
        assert fetched_objects[0]["id"] == dashboard_id
        # clean up tagged object
        tagged_objects.delete()

    # test get all objects
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @pytest.mark.usefixtures("create_tags")
    def test_get_all_objects(self):
        self.login(ADMIN_USERNAME)
        # tag the dashboard with id 1
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "World Bank's Data")
            .first()
        )
        dashboard_id = dashboard.id
        dashboard_type = ObjectType.dashboard
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
        assert tagged_objects.count() == 2
        assert tagged_objects.first().object_id == dashboard_id
        uri = "api/v1/tag/get_objects/"
        rv = self.client.get(uri)
        # successful request
        assert rv.status_code == 200
        fetched_objects = rv.json["result"]
        # check that the dashboard object was fetched
        assert dashboard_id in [obj["id"] for obj in fetched_objects]
        # clean up tagged object
        tagged_objects.delete()

    def test_get_tagged_objects_restricted(self):
        """
        Test that the get_objects endpoint returns only assets
        the user has access to.
        """
        owner = self.get_user(ADMIN_USERNAME)

        # Create a tag
        tag = self.insert_tag(
            name="test_tagged_objects_visibility",
            tag_type="custom",
        )

        # Create a chart
        chart_first_dataset = self.insert_chart("first_chart", [owner.id], 1)
        first_tag_relation = self.insert_tagged_object(
            tag_id=tag.id,
            object_id=chart_first_dataset.id,
            object_type=ObjectType.chart,
        )

        # Create another chart and add it to a dashboard
        chart_second_dataset = self.insert_chart("second_chart", [owner.id], 2)
        second_tag_relation = self.insert_tagged_object(
            tag_id=tag.id,
            object_id=chart_second_dataset.id,
            object_type=ObjectType.chart,
        )
        dashboard = self.insert_dashboard(
            "test_dashboard",
            "test_dashboard",
            [owner.id],
            slices=[chart_second_dataset],
            published=True,
        )
        dashboard_tag_relation = self.insert_tagged_object(
            tag_id=tag.id,
            object_id=dashboard.id,
            object_type=ObjectType.dashboard,
        )

        # Create a user without access to these items
        user = self.create_user_with_roles(
            "test_restricted_user",
            ["testing_new_role"],
            should_create_roles=True,
        )
        self.login("test_restricted_user")

        uri = f"api/v1/tag/get_objects/?tagIds={tag.id}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        assert rv.json["result"] == []

        # grant access to dataset ID 1
        first_dataset = db.session.query(SqlaTable).filter(SqlaTable.id == 1).first()
        self.grant_role_access_to_table(first_dataset, "testing_new_role")

        rv = self.client.get(uri)
        assert rv.status_code == 200
        result = rv.json["result"]
        assert len(result) == 1
        assert result[0]["id"] == chart_first_dataset.id

        # grant access to dataset ID 2
        second_dataset = db.session.query(SqlaTable).filter(SqlaTable.id == 2).first()
        self.grant_role_access_to_table(second_dataset, "testing_new_role")

        rv = self.client.get(uri)
        assert rv.status_code == 200
        result = rv.json["result"]
        assert len(result) == 3
        assert sorted([res["id"] for res in result]) == sorted(
            [chart_first_dataset.id, chart_second_dataset.id, dashboard.id]
        )

        # Clean up
        db.session.delete(dashboard_tag_relation)
        db.session.delete(dashboard)
        db.session.delete(second_tag_relation)
        db.session.delete(chart_second_dataset)
        db.session.delete(first_tag_relation)
        db.session.delete(chart_first_dataset)
        db.session.delete(tag)
        self.revoke_role_access_to_table("testing_new_role", first_dataset)
        self.revoke_role_access_to_table("testing_new_role", second_dataset)
        db.session.delete(user.roles[0])
        db.session.delete(user)
        db.session.commit()

    # test delete tags
    @pytest.mark.usefixtures("create_tags")
    def test_delete_tags(self):
        self.login(ADMIN_USERNAME)
        # check that tags exist in the database
        example_tag_names = ["example_tag_1", "example_tag_2", "example_tag_3"]
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tag_names))
        assert tags.count() == 3
        # delete the first tag
        uri = f"api/v1/tag/?q={prison.dumps(example_tag_names[:1])}"
        rv = self.client.delete(uri, follow_redirects=True)
        # successful request
        assert rv.status_code == 200
        # check that tag does not exist in the database
        tag = db.session.query(Tag).filter(Tag.name == example_tag_names[0]).first()
        assert tag is None
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tag_names))
        assert tags.count() == 2
        # delete multiple tags
        uri = f"api/v1/tag/?q={prison.dumps(example_tag_names[1:])}"
        rv = self.client.delete(uri, follow_redirects=True)
        # successful request
        assert rv.status_code == 200
        # check that tags are all gone
        tags = db.session.query(Tag).filter(Tag.name.in_(example_tag_names))
        assert tags.count() == 0

    @pytest.mark.usefixtures("create_tags")
    def test_delete_favorite_tag(self):
        self.login(ADMIN_USERNAME)
        user_id = self.get_user(username="admin").get_id()
        tag = db.session.query(Tag).first()
        uri = f"api/v1/tag/{tag.id}/favorites/"
        tag = db.session.query(Tag).first()
        rv = self.client.post(uri, follow_redirects=True)

        assert rv.status_code == 200

        association_row = (
            db.session.query(user_favorite_tag_table)
            .filter(
                and_(
                    user_favorite_tag_table.c.tag_id == tag.id,
                    user_favorite_tag_table.c.user_id == user_id,
                )
            )
            .one_or_none()
        )

        assert association_row is not None

        uri = f"api/v1/tag/{tag.id}/favorites/"
        rv = self.client.delete(uri, follow_redirects=True)

        assert rv.status_code == 200
        association_row = (
            db.session.query(user_favorite_tag_table)
            .filter(
                and_(
                    user_favorite_tag_table.c.tag_id == tag.id,
                    user_favorite_tag_table.c.user_id == user_id,
                )
            )
            .one_or_none()
        )

        assert association_row is None

    @pytest.mark.usefixtures("create_tags")
    def test_add_tag_not_found(self):
        self.login(ADMIN_USERNAME)
        uri = "api/v1/tag/123/favorites/"  # noqa: F541
        rv = self.client.post(uri, follow_redirects=True)

        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_tags")
    def test_delete_favorite_tag_not_found(self):
        """
        Tag API: Test trying to remove an unexisting tag from the list
        of user favorites returns 404.
        """
        self.login(ADMIN_USERNAME)

        # Fetch all existing tag IDs
        existing_ids = [tag_id for (tag_id,) in db.session.query(Tag.id).all()]

        # Get an ID not in use
        non_existent_id = max(existing_ids, default=0) + 1

        uri = f"api/v1/tag/{non_existent_id}/favorites/"  # noqa: F541
        rv = self.client.delete(uri, follow_redirects=True)

        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_tags")
    @patch("superset.daos.tag.g")
    def test_add_tag_user_not_found(self, flask_g):
        self.login(ADMIN_USERNAME)
        flask_g.user = None
        uri = "api/v1/tag/123/favorites/"  # noqa: F541
        rv = self.client.post(uri, follow_redirects=True)

        assert rv.status_code == 422

    @pytest.mark.usefixtures("create_tags")
    @patch("superset.daos.tag.g")
    def test_delete_favorite_tag_user_not_found(self, flask_g):
        self.login(ADMIN_USERNAME)
        flask_g.user = None
        uri = "api/v1/tag/123/favorites/"  # noqa: F541
        rv = self.client.delete(uri, follow_redirects=True)

        assert rv.status_code == 422

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_post_tag(self):
        self.login(ADMIN_USERNAME)
        uri = "api/v1/tag/"  # noqa: F541
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "World Bank's Data")
            .first()
        )
        rv = self.client.post(
            uri,
            json={"name": "my_tag", "objects_to_tag": [["dashboard", dashboard.id]]},
        )

        assert rv.status_code == 201
        self.get_user(username="admin").get_id()  # noqa: F841
        tag = (
            db.session.query(Tag)
            .filter(Tag.name == "my_tag", Tag.type == TagType.custom)
            .one_or_none()
        )
        assert tag is not None

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_post_tag_no_name_400(self):
        self.login(ADMIN_USERNAME)
        uri = "api/v1/tag/"  # noqa: F541
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "World Bank's Data")
            .first()
        )
        rv = self.client.post(
            uri,
            json={"name": "", "objects_to_tag": [["dashboard", dashboard.id]]},
        )

        assert rv.status_code == 400

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("create_tags")
    def test_put_tag(self):
        self.login(ADMIN_USERNAME)

        tag_to_update = db.session.query(Tag).first()
        uri = f"api/v1/tag/{tag_to_update.id}"
        rv = self.client.put(
            uri, json={"name": "new_name", "description": "new description"}
        )

        assert rv.status_code == 200

        tag = (
            db.session.query(Tag)
            .filter(Tag.name == "new_name", Tag.description == "new description")
            .one_or_none()
        )
        assert tag is not None

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("create_tags")
    def test_failed_put_tag(self):
        self.login(ADMIN_USERNAME)

        tag_to_update = db.session.query(Tag).first()
        uri = f"api/v1/tag/{tag_to_update.id}"
        rv = self.client.put(uri, json={"foo": "bar"})

        assert rv.status_code == 400

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_post_bulk_tag(self):
        self.login(ADMIN_USERNAME)
        uri = "api/v1/tag/bulk_create"
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "World Bank's Data")
            .first()
        )
        chart = db.session.query(Slice).first()
        tags = ["tag1", "tag2", "tag3"]
        rv = self.client.post(
            uri,
            json={
                "tags": [
                    {
                        "name": "tag1",
                        "objects_to_tag": [
                            ["dashboard", dashboard.id],
                            ["chart", chart.id],
                        ],
                    },
                    {
                        "name": "tag2",
                        "objects_to_tag": [["dashboard", dashboard.id]],
                    },
                    {
                        "name": "tag3",
                        "objects_to_tag": [["chart", chart.id]],
                    },
                ]
            },
        )

        assert rv.status_code == 200

        result = TagDAO.get_tagged_objects_by_tag_names(tags, ["dashboard"])
        assert len(result) == 1

        result = TagDAO.get_tagged_objects_by_tag_names(tags, ["chart"])
        assert len(result) == 1

        tagged_objects = (
            db.session.query(TaggedObject)
            .join(Tag)
            .filter(
                TaggedObject.object_id == dashboard.id,
                TaggedObject.object_type == ObjectType.dashboard,
                Tag.type == TagType.custom,
            )
        )
        assert tagged_objects.count() == 2

        tagged_objects = (
            db.session.query(TaggedObject)
            .join(Tag)
            .filter(
                TaggedObject.object_id == chart.id,
                TaggedObject.object_type == ObjectType.chart,
                Tag.type == TagType.custom,
            )
        )
        assert tagged_objects.count() == 2

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_post_bulk_tag_skipped_tags_perm(self):
        alpha = self.get_user("alpha")
        self.insert_dashboard("titletag", "slugtag", [alpha.id])
        self.login(ALPHA_USERNAME)
        uri = "api/v1/tag/bulk_create"
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "World Bank's Data")
            .first()
        )
        alpha_dash = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "titletag")
            .first()
        )
        chart = db.session.query(Slice).first()
        rv = self.client.post(
            uri,
            json={
                "tags": [
                    {
                        "name": "tag1",
                        "objects_to_tag": [
                            ["dashboard", alpha_dash.id],
                        ],
                    },
                    {
                        "name": "tag2",
                        "objects_to_tag": [["dashboard", dashboard.id]],
                    },
                    {
                        "name": "tag3",
                        "objects_to_tag": [["chart", chart.id]],
                    },
                ]
            },
        )

        assert rv.status_code == 200
        result = rv.json["result"]
        assert len(result["objects_tagged"]) == 2
        assert len(result["objects_skipped"]) == 1

    def test_create_tag_mysql_compatibility(self) -> None:
        """
        Test creating a tag via API to ensure MySQL compatibility.

        This test verifies the fix for issue #32484 where tag creation
        failed with MySQL due to Markup objects being used instead of strings.
        """

        self.login(ADMIN_USERNAME)

        tag_name = "mysql-fix-verification-20251111"
        uri = "api/v1/tag/"

        # Create a tag via the API (tags can only be created with objects_to_tag)
        # So we'll create a simple tag and verify it in the database
        data = {
            "name": tag_name,
            "description": "Test tag for MySQL compatibility verification",
            "objects_to_tag": [],  # Empty list is acceptable
        }

        rv = self.client.post(uri, json=data)

        # Should succeed without SQL errors (201 for created or 200 for success)
        assert rv.status_code in [200, 201], (
            f"Tag creation should succeed, got {rv.status_code}"
        )

        # Query the database to verify the tag was created correctly
        created_tag = db.session.query(Tag).filter_by(name=tag_name).first()
        assert created_tag is not None, "Tag should exist in database"

        # Critical check: ensure the tag name is a plain string, not Markup
        assert isinstance(created_tag.name, str), "Tag name should be a plain string"
        assert not isinstance(created_tag.name, Markup), (
            "Tag name should NOT be a Markup object"
        )
        assert created_tag.name.__class__ is str, "Tag name should be exactly str type"
        assert created_tag.name == tag_name, "Tag name should match the input"

        # Cleanup
        db.session.delete(created_tag)
        db.session.commit()
