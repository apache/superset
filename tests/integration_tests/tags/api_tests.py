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

import tests.integration_tests.test_app
from superset import db, security_manager
from superset.common.db_query_status import QueryStatus
from superset.models.core import Database
from superset.utils.database import get_example_database, get_main_database
from superset.models.sql_lab import Tag

from tests.integration_tests.base_tests import SupersetTestCase

TAGS_FIXTURE_COUNT = 10

class TestTagApi(SupersetTestCase):
    def insert_tag(
        self,
        name: str,
        tag_type: str,
    ) -> Tag:
        tag = Tag(
            name=name,
            type=tag_type,
        )
        db.session.add(tag)
        db.session.commit()
        return tag

    @pytest.fixture()
    def create_tags(self):
        with self.create_app().app_context():
            tags = []
            for cx in range(TAGS_FIXTURE_COUNT):
                tags.append(
                    self.insert_tag(
                        name=f"example_tag_{cx}",
                        tag_type='custom',
                    )
                )

            yield tags

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
            tag_type='custom',
        )
        self.login(username="admin")
        uri = f"api/v1/tag/{tag.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        expected_result = {
            "id": tag.id,
            "name": "test get tag",
            "type": 'custom'
        }
        data = json.loads(rv.data.decode("utf-8"))
        for key, value in data["result"].items():
            self.assertEqual(value, expected_result[key])
        # rollback changes
        db.session.delete(tag)
        db.session.commit()

    def test_get_tag_not_found(self):
        """
        Query API: Test get query not found
        """
        tag = self.insert_tag(name="test tag", tag_type='custom')
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
        assert sorted(list(data["result"][0].keys())) == [
            "id",
            "name",
            "type",
        ]
