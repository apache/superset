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
"""Unit tests for DashboardFilterStateRestApi."""

import inspect

from superset.commands.dashboard.filter_state.create import CreateFilterStateCommand
from superset.commands.dashboard.filter_state.delete import DeleteFilterStateCommand
from superset.commands.dashboard.filter_state.get import GetFilterStateCommand
from superset.commands.dashboard.filter_state.update import UpdateFilterStateCommand
from superset.dashboards.filter_state.api import DashboardFilterStateRestApi
from superset.temporary_cache.api import TemporaryCacheRestApi


def test_dashboard_filter_state_rest_api_inheritance():
    """Ensure DashboardFilterStateRestApi correctly subclasses TemporaryCacheRestApi."""
    assert issubclass(DashboardFilterStateRestApi, TemporaryCacheRestApi)
    assert (
        DashboardFilterStateRestApi.class_permission_name
        == "DashboardFilterStateRestApi"
    )
    assert DashboardFilterStateRestApi.resource_name == "dashboard"
    assert DashboardFilterStateRestApi.openapi_spec_tag == "Dashboard Filter State"


def test_dashboard_filter_state_command_factories():
    """Ensure factory methods return the expected command classes."""
    api = DashboardFilterStateRestApi()
    assert api.get_create_command() is CreateFilterStateCommand
    assert api.get_update_command() is UpdateFilterStateCommand
    assert api.get_get_command() is GetFilterStateCommand
    assert api.get_delete_command() is DeleteFilterStateCommand


def test_post_put_methods_have_no_has_access_api_or_api_decorator():
    """
    Ensure post and put methods are not decorated with @has_access_api or @api.

    Because DashboardFilterStateRestApi is a temporary cache API, permission
    verification is handled dynamically at the command level via
    CheckAccessDataCommand. @has_access_api causes 401 Unauthorized for regular
    users due to missing FAB permissions. The @api wrapper would catch and convert
    uncaught auth errors into 500s.
    """
    source_post = inspect.getsource(DashboardFilterStateRestApi.post)
    source_put = inspect.getsource(DashboardFilterStateRestApi.put)

    assert "has_access_api" not in source_post
    assert "has_access_api" not in source_put

    assert not any(line.strip().startswith("@api") for line in source_post.splitlines())
    assert not any(line.strip().startswith("@api") for line in source_put.splitlines())
