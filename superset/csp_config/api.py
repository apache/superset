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
# pylint: disable=too-many-lines
import logging
from typing import List

from flask import current_app, request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import BaseApi, safe
from flask_appbuilder.security.decorators import permission_name, protect

from superset.extensions import event_logger

logger = logging.getLogger(__name__)


class CspConfigRestApi(BaseApi):
    resource_name = "csp_config"
    allow_browser_login = True

    @expose("/", methods=("GET",))
    @event_logger.log_this
    @protect()
    @safe
    @permission_name("list")
    def get_talisman_config(self) -> Response:
        """
        Get Talisman configuration from Flask server.
        """
        try:
            config = current_app.config
            result = {
                "talisman_config": config.get("TALISMAN_CONFIG", {}),
                "talisman_enabled": config.get("TALISMAN_ENABLED", False),
                "content_security_policy": config.get("TALISMAN_CONFIG", {}).get(
                    "content_security_policy", {}
                ),
                "talisman_overrides": config.get("TALISMAN_OVERRIDES", {}),
            }
            return self.response(200, result=result)
        except Exception as e:
            logger.exception("Failed to retrieve Talisman config")
            return self.response_500(message=str(e))

    @expose("/set_frame_src", methods=("POST",))
    @event_logger.log_this
    @protect()
    @safe
    @permission_name("list")
    def set_frame_src(self) -> Response:
        """
        Overwrite the frame-src list in Talisman overrides.
        """
        try:
            data = request.get_json()
            domains: List[str] = data.get("domains", []) if data else []
            config = current_app.config
            overrides = config.setdefault("TALISMAN_OVERRIDES", {})
            csp = overrides.setdefault("content_security_policy", {})

            if len(domains) == 0:
                csp["frame-src"] = []
                return self.response(
                    200,
                    result={
                        "message": "frame-src has been reset",
                        "frame_src": [],
                        "total_domains": 0,
                    },
                )

            if (
                not domains
                or not isinstance(domains, list)
                or not all(isinstance(d, str) for d in domains)
            ):
                return self.response_400(
                    message="'domains' must be a list of non-empty strings"
                )

            # Remove duplicates and set frame-src
            csp["frame-src"] = list(set(domains))

            result = {
                "message": "frame-src successfully updated",
                "frame_src": csp["frame-src"],
                "total_domains": len(csp["frame-src"]),
            }
            return self.response(200, result=result)

        except Exception as e:
            logger.exception("Failed to set frame-src domains")
            return self.response_500(message=str(e))
