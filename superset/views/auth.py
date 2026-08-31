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

from flask import g, redirect, request, url_for
from flask_appbuilder import expose
from flask_appbuilder.const import LOGMSG_ERR_SEC_NO_REGISTER_HASH
from flask_appbuilder.security.decorators import no_cache
from flask_appbuilder.security.views import AuthView, WerkzeugResponse
from flask_appbuilder.utils.base import get_safe_redirect
from flask_babel import lazy_gettext

from superset.views.base import BaseSupersetView

logger = logging.getLogger(__name__)

LOGIN_REDIRECT_MARKER_PARAM = "login_redirect"
LOGIN_REDIRECT_MARKER_VALUE = "1"


class SupersetAuthView(BaseSupersetView, AuthView):
    route_base = "/login"

    @staticmethod
    def _safe_next_url() -> str:
        """Return the requested redirect only when FAB considers it safe."""
        next_url = request.args.get("next", "")
        # Browsers treat backslashes as path separators for special URL schemes,
        # while Python's URL parser does not. Reject them before FAB validates
        # the destination so both interpret the authority consistently.
        if not next_url or "\\" in next_url:
            return ""

        safe_url = get_safe_redirect(next_url)
        return safe_url if safe_url == next_url else ""

    def _marked_login_url(self) -> str:
        """Build a login URL marked as having been visited anonymously."""
        query = request.args.to_dict(flat=False)
        query[LOGIN_REDIRECT_MARKER_PARAM] = [LOGIN_REDIRECT_MARKER_VALUE]
        return url_for(f"{self.__class__.__name__}.login", **query)

    def _marked_next_url(self) -> str:
        """Return a safe redirect from a login URL visited anonymously."""
        if request.args.get(LOGIN_REDIRECT_MARKER_PARAM) != LOGIN_REDIRECT_MARKER_VALUE:
            return ""
        return self._safe_next_url()

    @expose("/")
    @no_cache
    def login(self, provider: Optional[str] = None) -> WerkzeugResponse:
        if g.user is not None and g.user.is_authenticated:
            if next_url := self._marked_next_url():
                return redirect(next_url)
            return redirect(self.appbuilder.get_url_for_index)

        if (
            self._safe_next_url()
            and request.args.get(LOGIN_REDIRECT_MARKER_PARAM)
            != LOGIN_REDIRECT_MARKER_VALUE
        ):
            return redirect(self._marked_login_url())

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
            logger.error("Registration activation failed: %s", self.false_error_message)
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
            logger.error("User registration failed: %s", self.error_message)
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
