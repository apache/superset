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

from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags


class TestTagging(SupersetTestCase):
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
