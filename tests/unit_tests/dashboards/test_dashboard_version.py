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
"""Unit tests for dashboard versioning."""

from superset.commands.dashboard.exceptions import DashboardVersionNotFoundError


def test_dashboard_version_not_found_error_with_exception():
    """DashboardVersionNotFoundError accepts optional exception and formats message."""
    err = DashboardVersionNotFoundError(
        version_id="99", exception=ValueError("underlying")
    )
    assert "99" in str(err)
    assert err.status == 404
