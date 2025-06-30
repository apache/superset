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

"""MCP Service API package"""
import logging
from flask import Blueprint
from flask_appbuilder import AppBuilder

logger = logging.getLogger(__name__)

# Create the main API blueprint
mcp_api = Blueprint("mcp_api", __name__, url_prefix="/api/mcp/v1")

# Import endpoints at module level to ensure routes are registered before blueprint registration
from superset.mcp_service.api.v1.endpoints import (  # noqa
    health,
    list_dashboards
)

def init_app(app: AppBuilder) -> None:
    """Initialize the MCP API with the Flask app"""
    logger.info("Initializing MCP API with Flask app")

    app.register_blueprint(mcp_api)
