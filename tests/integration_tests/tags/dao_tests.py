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
import time
from unittest.mock import patch
import pytest
from superset.dao.exceptions import DAOCreateFailedError
from superset.tags.dao import TagDAO
from superset.tags.exceptions import InvalidTagNameError
from superset.tags.models import ObjectTypes, Tag

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
    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @pytest.mark.usefixtures("with_tagging_system_feature")
    def test_create_tag(self):
        # test that a tag cannot be added if it has ':' in it
        try:
            TagDAO.create_custom_tagged_objects(
                object_type=ObjectTypes.dashboard,
                object_id=1,
                properties={"tags": ["invalid:example tag 1"]},
            )
        except Exception as e:
            assert type(e) is DAOCreateFailedError

        # test that a tag can be added if it has a valid name
        try:
            TagDAO.create_custom_tagged_objects(
                object_type=ObjectTypes.dashboard,
                object_id=1,
                properties={"tags": ["example tag 1"]},
            )
        except Exception as e:
            # should not be an exception
            assert e is None

        # check if tag exists
        assert db.session.query(Tag).filter(Tag.name == "example tag 1").first()
