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
from flask import flash, request, Response
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access_api
from werkzeug.utils import redirect

from superset import db, event_logger
from superset.models import core as models
from superset.typing import FlaskResponse
from superset.views.base import BaseSupersetView


class R(BaseSupersetView):  # pylint: disable=invalid-name

    """used for short urls"""

    @event_logger.log_this
    @expose("/<int:url_id>")
    def index(self, url_id: int) -> FlaskResponse:  # pylint: disable=no-self-use
        url = db.session.query(models.Url).get(url_id)
        if url and url.url:
            explore_url = "//superset/explore/?"
            if url.url.startswith(explore_url):
                explore_url += f"r={url_id}"
                return redirect(explore_url[1:])

            return redirect(url.url[1:])

        flash("URL to nowhere...", "danger")
        return redirect("/")

    @event_logger.log_this
    @has_access_api
    @expose("/shortner/", methods=["POST"])
    def shortner(self) -> FlaskResponse:  # pylint: disable=no-self-use
        url = request.form.get("data")
        obj = models.Url(url=url)
        db.session.add(obj)
        db.session.commit()
        return Response(
            "{scheme}://{request.headers[Host]}/r/{obj.id}".format(
                scheme=request.scheme, request=request, obj=obj
            ),
            mimetype="text/plain",
        )
