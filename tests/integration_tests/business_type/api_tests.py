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

import json

from tests.integration_tests.base_tests import SupersetTestCase

class TestBusinessTypeApi(SupersetTestCase):
    resource_name = "business_type"
    allow_browser_login = True

    def test_get_business_type(self):
        """
        business_type API: Test get, expect to get a greeting
        """
        self.login(username="admin")
        uri = f"api/v1/business_type/convert"
        rv = self.get_assert_metric(uri, "info")
        data = json.loads(rv.data.decode("utf-8"))
        print(str(data))
        assert rv.status_code == 200
        #assert set(data["permissions"]) == {"can_read", "can_write", "can_export"}

    def test_get_types_business_type(self):
        """
        business_type API: Test get types, expect to get a list of available business types
        """