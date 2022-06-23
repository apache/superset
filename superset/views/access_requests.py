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
from flask import current_app as app
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from werkzeug.exceptions import NotFound

from superset.constants import RouteMethod
from superset.views.base import DeleteMixin, SupersetModelView
from superset.views.core import DAR


class AccessRequestsModelView(
    SupersetModelView, DeleteMixin
):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(DAR)
    include_route_methods = RouteMethod.CRUD_SET
    list_columns = [
        "username",
        "user_roles",
        "datasource_link",
        "roles_with_datasource",
        "created_on",
    ]
    order_columns = ["created_on"]
    base_order = ("changed_on", "desc")
    label_columns = {
        "username": _("User"),
        "user_roles": _("User Roles"),
        "database": _("Database URL"),
        "datasource_link": _("Datasource"),
        "roles_with_datasource": _("Roles to grant"),
        "created_on": _("Created On"),
    }

    @staticmethod
    def is_enabled() -> bool:
        return bool(app.config["ENABLE_ACCESS_REQUEST"])

    @before_request
    def ensure_enabled(self) -> None:
        if not self.is_enabled():
            raise NotFound()
