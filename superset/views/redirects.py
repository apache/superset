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
import logging
from typing import Optional

from flask import flash
from flask_appbuilder import expose
from werkzeug.utils import redirect

from superset import db, event_logger
from superset.models import core as models
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView

logger = logging.getLogger(__name__)


class R(BaseSupersetView):  # pylint: disable=invalid-name

    """used for short urls"""

    @staticmethod
    def _validate_explore_url(url: str) -> Optional[str]:
        if url.startswith("//superset/explore/p/"):
            return url

        if url.startswith("//superset/explore"):
            return "/" + url[10:]  # Remove /superset from old Explore URLs

        if url.startswith("//explore"):
            return url

        return None

    @staticmethod
    def _validate_dashboard_url(url: str) -> Optional[str]:
        if url.startswith("//superset/dashboard/"):
            return url

        return None

    @event_logger.log_this
    @expose("/<int:url_id>")
    def index(self, url_id: int) -> FlaskResponse:
        url = db.session.query(models.Url).get(url_id)
        if url and url.url:
            explore_url = self._validate_explore_url(url.url)
            if explore_url:
                if explore_url.startswith("//explore/?"):
                    explore_url = f"//explore/?r={url_id}"
                return redirect(explore_url[1:])

            dashboard_url = self._validate_dashboard_url(url.url)
            if dashboard_url:
                return redirect(dashboard_url[1:])

            return redirect("/")

        flash("URL to nowhere...", "danger")
        return redirect("/")
