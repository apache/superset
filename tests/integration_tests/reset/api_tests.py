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
"""Tests for reset api methods"""
import json

from tests.integration_tests.base_tests import SupersetTestCase


class TestResetApi(SupersetTestCase):
    resource_name = "reset"

    def test_post_reset(self):
        """
        Reset API: Test reset all resources
        """
        uri = f"api/v1/{self.resource_name}/"
        response = self.client.post(uri, data=json.dumps({"all": True}))
        self.assert200(response)
        data = json.loads(response.data.decode("utf-8"))
        self.assertEqual("OK", data["message"])
