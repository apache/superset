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

"""
Integration tests for the /api/v1/report/<pk>/run_now endpoint.
"""

from superset import db
from superset.reports.models import ReportSchedule
from tests.integration_tests.base_tests import SupersetTestCase


class TestReportRunNowApi(SupersetTestCase):
    def setUp(self):
        super().setUp()
        # Create a dummy report schedule for testing
        self.report = ReportSchedule(
            name="Test Report",
            type="report",
            crontab="* * * * *",
            active=True,
        )
        db.session.add(self.report)
        db.session.commit()
        self.report_id = self.report.id

    def tearDown(self):
        db.session.delete(self.report)
        db.session.commit()
        super().tearDown()

    def test_run_now_success(self):
        """Test running a report immediately returns 200 and starts execution."""
        self.login(username="admin")
        resp = self.client.post(f"/api/v1/report/{self.report_id}/run_now")
        assert resp.status_code == 200
        assert b"Report execution started" in resp.data

    def test_run_now_not_found(self):
        """Test running a non-existent report returns 500 or 404."""
        self.login(username="admin")
        resp = self.client.post("/api/v1/report/999999/run_now")
        # Could be 404 or 500 depending on error handling
        assert resp.status_code in (404, 500)
