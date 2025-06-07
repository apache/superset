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

from flask import flash, g, redirect
from flask_appbuilder import expose
from flask_appbuilder._compat import as_unicode
from flask_appbuilder.const import LOGMSG_ERR_SEC_NO_REGISTER_HASH
from flask_appbuilder.security.decorators import no_cache
from flask_appbuilder.security.views import AuthView, WerkzeugResponse
from flask_babel import lazy_gettext

from superset.views.base import BaseSupersetView

logger = logging.getLogger(__name__)


class SupersetAuthView(BaseSupersetView, AuthView):
    route_base = "/login"

    @expose("/")
    @no_cache
    def login(self, provider: Optional[str] = None) -> WerkzeugResponse:
        if g.user is not None and g.user.is_authenticated:
            return redirect(self.appbuilder.get_url_for_index)

        return super().render_app_template()


class SupersetRegisterUserView(BaseSupersetView):
    route_base = "/register"
    activation_template = ""
    error_message = lazy_gettext(
        "Not possible to register you at the moment, try again later"
    )
    false_error_message = lazy_gettext("Registration not found")

    @expose("/")
    @no_cache
    def register(self) -> WerkzeugResponse:
        return super().render_app_template()

    @expose("/activation/<string:activation_hash>")
    def activation(self, activation_hash: str) -> WerkzeugResponse:
        """
        Endpoint to expose an activation url, this url
        is sent to the user by email, when accessed the user is inserted
        and activated
        """
        reg = self.appbuilder.sm.find_register_user(activation_hash)
        if not reg:
            logger.error(LOGMSG_ERR_SEC_NO_REGISTER_HASH, activation_hash)
            flash(as_unicode(self.false_error_message), "danger")
            return redirect(self.appbuilder.get_url_for_index)
        if not self.appbuilder.sm.add_user(
            username=reg.username,
            email=reg.email,
            first_name=reg.first_name,
            last_name=reg.last_name,
            role=self.appbuilder.sm.find_role(
                self.appbuilder.sm.auth_user_registration_role
            ),
            hashed_password=reg.password,
        ):
            flash(as_unicode(self.error_message), "danger")
            return redirect(self.appbuilder.get_url_for_index)
        else:
            self.appbuilder.sm.del_register_user(reg)
            return super().render_app_template(
                {
                    "username": reg.username,
                    "first_name": reg.first_name,
                    "last_name": reg.last_name,
                },
            )
