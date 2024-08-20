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

from flask_appbuilder import expose
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access, has_access_api
from werkzeug.exceptions import NotFound

from superset import db, is_feature_enabled
from superset.superset_typing import FlaskResponse
from superset.tags.models import Tag
from superset.utils import json
from superset.views.base import SupersetModelView

from .base import BaseSupersetView, json_success

logger = logging.getLogger(__name__)


class TagModelView(SupersetModelView):
    route_base = "/superset/tags"
    datamodel = SQLAInterface(Tag)
    class_permission_name = "Tags"
    include_route_methods = {"list"}

    @has_access
    @expose("/")
    def list(self) -> FlaskResponse:
        if not is_feature_enabled("TAGGING_SYSTEM"):
            return super().list()

        return super().render_app_template()


class TagView(BaseSupersetView):
    @staticmethod
    def is_enabled() -> bool:
        return is_feature_enabled("TAGGING_SYSTEM")

    @before_request
    def ensure_enabled(self) -> None:
        if not self.is_enabled():
            raise NotFound()

    @has_access_api
    @expose("/tags/", methods=("GET",))
    def tags(self) -> FlaskResponse:
        query = db.session.query(Tag).all()
        results = [
            {
                "id": obj.id,
                "type": obj.type.name,
                "name": obj.name,
                "changed_on": obj.changed_on,
                "changed_by": obj.changed_by_fk,
                "created_by": obj.created_by_fk,
            }
            for obj in query
        ]
        return json_success(json.dumps(results, default=json.json_int_dttm_ser))
