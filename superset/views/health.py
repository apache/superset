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
from flask import Blueprint, current_app as app, jsonify

from superset import talisman
from superset.stats_logger import BaseStatsLogger
from superset.superset_typing import FlaskResponse

health_blueprint = Blueprint("health", __name__)


@health_blueprint.route("/health")
@health_blueprint.route("/healthcheck")
@health_blueprint.route("/ping")
@talisman(force_https=False)
def health() -> FlaskResponse:
    stats_logger: BaseStatsLogger = app.config["STATS_LOGGER"]
    stats_logger.incr("health")
    return "OK"


@health_blueprint.route("/version")
@talisman(force_https=False)
def version() -> FlaskResponse:
    """
    Return version information for the running Superset instance.

    When ``EXPOSE_VERSION_INFO`` is True (default) this returns the full
    version metadata, including the Git SHA and branch name when available.
    When it is False, only the human-readable version string is returned and
    build-specific details (Git SHA, full SHA, build number, branch name) are
    omitted so they are not exposed to unauthenticated callers.
    """
    if not app.config.get("EXPOSE_VERSION_INFO", True):
        return jsonify({"version_string": app.config.get("VERSION_STRING", "unknown")})

    from superset.utils.version import get_version_metadata

    return jsonify(get_version_metadata())
