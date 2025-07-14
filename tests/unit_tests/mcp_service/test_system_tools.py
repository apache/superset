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
Unit tests for MCP system tools (get_superset_instance_info)
"""
import logging
from unittest.mock import Mock, patch
import pytest
from flask import Flask, g
from flask_login import AnonymousUserMixin
from superset.mcp_service.pydantic_schemas.system_schemas import InstanceInfo, InstanceSummary
from superset.mcp_service.tools.system import get_superset_instance_info

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class TestSystemTools:
    """Test system-related MCP tools"""

    @patch('superset.extensions.db')
    def test_get_superset_instance_info_success(self, mock_db):
        mock_app = Mock()
        mock_app.app_context.return_value.__enter__ = Mock()
        mock_app.app_context.return_value.__exit__ = Mock()
        mock_session = Mock()
        mock_db.session = mock_session
        mock_session.query.return_value.join.return_value.distinct.return_value.count.return_value = 5
        mock_session.query.return_value.count.return_value = 10
        app = Flask(__name__)
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        with app.app_context():
            g.user = AnonymousUserMixin()
            with patch('superset.mcp_service.tools.system.get_superset_instance_info.MCPDAOWrapper.count', side_effect=[
                10,  # total_dashboards
                10,  # total_charts
                10,  # total_datasets
                10,  # total_databases
                10,  # total_users
                10,  # total_tags
                2,   # recent_dashboards
                2,   # recent_charts
                2,   # recent_datasets
                2,   # recently_modified_dashboards
                2,   # recently_modified_charts
                2,   # recently_modified_datasets
                5,   # published_dashboards
                3,   # certified_dashboards
            ]):
                result = get_superset_instance_info()
                del g.user
                assert isinstance(result, InstanceInfo)
                assert isinstance(result.instance_summary, InstanceSummary)
                assert result.instance_summary.total_dashboards == 10
                assert result.instance_summary.total_charts == 10
                assert result.instance_summary.total_datasets == 10
                assert result.instance_summary.total_databases == 10
                assert result.instance_summary.total_users == 10
                assert result.instance_summary.total_tags == 10
                assert result.instance_summary.avg_charts_per_dashboard == 1.0

    @patch('superset.extensions.db')
    def test_get_superset_instance_info_failure(self, mock_db):
        mock_app = Mock()
        mock_app.app_context.return_value.__enter__ = Mock()
        mock_app.app_context.return_value.__exit__ = Mock()
        mock_session = Mock()
        mock_db.session = mock_session
        mock_session.query.side_effect = Exception("Database connection failed")
        app = Flask(__name__)
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        with app.app_context():
            g.user = AnonymousUserMixin()
            with pytest.raises(Exception) as excinfo:
                get_superset_instance_info()
            assert "Database connection failed" in str(excinfo.value) 