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
import json

import prison

from superset import db, security_manager


class ApiOwnersTestCaseMixin:
    """
    Implements shared tests for owners related field
    """

    resource_name: str = ""

    def test_get_related_owners(self):
        """
            API: Test get related owners
        """
        self.login(username="admin")
        uri = f"api/v1/{self.resource_name}/related/owners"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        users = db.session.query(security_manager.user_model).all()
        expected_users = [str(user) for user in users]
        self.assertEqual(response["count"], len(users))
        # This needs to be implemented like this, because ordering varies between
        # postgres and mysql
        response_users = [result["text"] for result in response["result"]]
        for expected_user in expected_users:
            self.assertIn(expected_user, response_users)

    def test_get_filter_related_owners(self):
        """
            API: Test get filter related owners
        """
        self.login(username="admin")
        argument = {"filter": "a"}
        uri = f"api/v1/{self.resource_name}/related/owners?q={prison.dumps(argument)}"

        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "count": 2,
            "result": [
                {"text": "admin user", "value": 1},
                {"text": "alpha user", "value": 5},
            ],
        }
        self.assertEqual(response, expected_response)

    def test_get_related_fail(self):
        """
            API: Test get related fail
        """
        self.login(username="admin")
        uri = f"api/v1/{self.resource_name}/related/owner"

        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)
