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
WebDriver pool configuration defaults for Superset MCP service
"""

from typing import Any, Dict

# Default WebDriver pool configuration
DEFAULT_WEBDRIVER_POOL_CONFIG = {
    # Maximum number of WebDriver instances to keep in the pool
    "MAX_POOL_SIZE": 5,
    # Maximum age of a WebDriver instance (in seconds)
    # After this time, the driver will be destroyed and recreated
    "MAX_AGE_SECONDS": 3600,  # 1 hour
    # Maximum number of times a WebDriver can be reused
    # After this many uses, the driver will be destroyed and recreated
    "MAX_USAGE_COUNT": 50,
    # How long a WebDriver can sit idle before being destroyed (in seconds)
    "IDLE_TIMEOUT_SECONDS": 300,  # 5 minutes
    # How often to perform health checks on WebDriver instances (in seconds)
    "HEALTH_CHECK_INTERVAL": 60,  # 1 minute
}


def configure_webdriver_pool(app_config: Dict[str, Any]) -> None:
    """
    Configure WebDriver pool settings in Superset app config.

    This function adds WebDriver pool configuration to the Superset app config
    if it doesn't already exist, using sensible defaults.

    Args:
        app_config: The Superset application configuration dictionary
    """
    if "WEBDRIVER_POOL" not in app_config:
        app_config["WEBDRIVER_POOL"] = DEFAULT_WEBDRIVER_POOL_CONFIG.copy()
    else:
        # Merge with defaults for any missing keys
        for key, default_value in DEFAULT_WEBDRIVER_POOL_CONFIG.items():
            if key not in app_config["WEBDRIVER_POOL"]:
                app_config["WEBDRIVER_POOL"][key] = default_value


def get_pool_stats_endpoint() -> Any:
    """
    Create a Flask endpoint to view WebDriver pool statistics.

    This function can be called to register a debugging endpoint
    that shows the current state of the WebDriver pool.

    Returns:
        Flask route function for pool statistics
    """

    def pool_stats() -> Any:
        try:
            from flask import jsonify

            from superset.mcp_service.screenshot.webdriver_pool import (
                get_webdriver_pool,
            )

            pool = get_webdriver_pool()
            stats = pool.get_stats()

            return jsonify({"webdriver_pool": stats, "status": "healthy"})
        except Exception as e:
            from flask import jsonify

            return jsonify({"error": str(e), "status": "error"}), 500

    return pool_stats


# Performance tuning recommendations based on use case
PERFORMANCE_CONFIGS = {
    "low_traffic": {
        "MAX_POOL_SIZE": 2,
        "MAX_AGE_SECONDS": 1800,  # 30 minutes
        "MAX_USAGE_COUNT": 25,
        "IDLE_TIMEOUT_SECONDS": 180,  # 3 minutes
        "HEALTH_CHECK_INTERVAL": 120,  # 2 minutes
    },
    "medium_traffic": {
        "MAX_POOL_SIZE": 5,
        "MAX_AGE_SECONDS": 3600,  # 1 hour
        "MAX_USAGE_COUNT": 50,
        "IDLE_TIMEOUT_SECONDS": 300,  # 5 minutes
        "HEALTH_CHECK_INTERVAL": 60,  # 1 minute
    },
    "high_traffic": {
        "MAX_POOL_SIZE": 10,
        "MAX_AGE_SECONDS": 7200,  # 2 hours
        "MAX_USAGE_COUNT": 100,
        "IDLE_TIMEOUT_SECONDS": 600,  # 10 minutes
        "HEALTH_CHECK_INTERVAL": 30,  # 30 seconds
    },
    "development": {
        "MAX_POOL_SIZE": 2,
        "MAX_AGE_SECONDS": 900,  # 15 minutes
        "MAX_USAGE_COUNT": 10,
        "IDLE_TIMEOUT_SECONDS": 120,  # 2 minutes
        "HEALTH_CHECK_INTERVAL": 30,  # 30 seconds
    },
}


def configure_for_environment(
    app_config: Dict[str, Any], environment: str = "medium_traffic"
) -> None:
    """
    Configure WebDriver pool for specific environment/traffic levels.

    Args:
        app_config: The Superset application configuration dictionary
        environment: Environment type (low_traffic, medium_traffic,
            high_traffic, development)
    """
    if environment in PERFORMANCE_CONFIGS:
        app_config["WEBDRIVER_POOL"] = PERFORMANCE_CONFIGS[environment].copy()
    else:
        # Fallback to default
        configure_webdriver_pool(app_config)
