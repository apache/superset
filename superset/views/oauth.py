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
import jwt
from flask import flash, g, redirect, get_flashed_messages, request, session, url_for
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import no_cache
from flask_appbuilder.security.utils import generate_random_string
from flask_appbuilder.security.views import  AuthOAuthView, WerkzeugResponse
from flask_appbuilder._compat import as_unicode
from superset.views.base import BaseSupersetView

logger = logging.getLogger(__name__)


class SupersetOAuthView(BaseSupersetView, AuthOAuthView):
    route_base = "/login"

    @expose("/")
    @expose("/<provider>")
    @no_cache
    def login(self, provider: Optional[str] = None) -> WerkzeugResponse:
    
        get_flashed_messages(category_filter=['danger'])

        if provider is None:
            providers = [k for k in self.appbuilder.sm.oauth_remotes.keys()]
            if len(providers) == 1:
                provider = providers[0]
        logger.debug("Provider: %s", provider)
        if g.user is not None and g.user.is_authenticated:
                logger.debug("Already authenticated %s", g.user)
                return redirect(self.appbuilder.get_url_for_index)

        if provider is None:
            return self.render_template(
                self.login_template,
                providers=self.appbuilder.sm.oauth_providers,
                title=self.title,
                appbuilder=self.appbuilder,
            )

        logger.debug("Going to call authorize for: %s", provider)
        random_state = generate_random_string()
        state = jwt.encode(
            request.args.to_dict(flat=False), random_state, algorithm="HS256"
        )
        session["oauth_state"] = random_state
        try:
            if provider == "twitter":
                return self.appbuilder.sm.oauth_remotes[provider].authorize_redirect(
                    redirect_uri=url_for(
                        ".oauth_authorized",
                        provider=provider,
                        _external=True,
                        state=state,
                    )
                )
            else:
                return self.appbuilder.sm.oauth_remotes[provider].authorize_redirect(
                    redirect_uri=url_for(
                        ".oauth_authorized", provider=provider, _external=True
                    ),
                    state=state.decode("ascii") if isinstance(state, bytes) else state,
                )
        except Exception as e:
            logger.error("Error on OAuth authorize: %s", e)
            flash(as_unicode(self.invalid_login_message), "warning")
            return redirect(self.appbuilder.get_url_for_index)
