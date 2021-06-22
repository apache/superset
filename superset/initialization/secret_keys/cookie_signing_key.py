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
from __future__ import annotations

from typing import Optional, TYPE_CHECKING

from flask.sessions import SecureCookieSessionInterface
from itsdangerous import URLSafeTimedSerializer
from keys_management import OnChangeKeyDefinition, SecretKeyFlow, SecretKeyUseCase

from .consts import COOKIE_SIGNING_KEY

if TYPE_CHECKING:
    from superset.app import SupersetApp


def define_cookie_signing_key(app: SupersetApp) -> None:
    # pylint: disable=W0613
    app.keys_management.define_key(  # type: ignore
        name=COOKIE_SIGNING_KEY,
        keys_store=lambda: app.config.get(COOKIE_SIGNING_KEY),
        use_case=SecretKeyUseCase.ONE_WAY_TRIP,
        stateless=True,
        keep_in_cache=False,
    )

    def on_key_change(
        old_key: str, new_key: str, on_change_key_definition: OnChangeKeyDefinition
    ) -> None:
        app.config[COOKIE_SIGNING_KEY] = new_key

    app.keys_management.register_on_change(  # type: ignore
        COOKIE_SIGNING_KEY, on_key_change
    )
    app.session_interface = SupersetSecureCookieSession()


class SupersetSecureCookieSession(SecureCookieSessionInterface):
    def get_signing_serializer(
        self, app: SupersetApp
    ) -> Optional[URLSafeTimedSerializer]:
        current_signing_key = app.keys_management.get_key(  # type: ignore
            COOKIE_SIGNING_KEY, SecretKeyFlow.DEFAULT
        )
        if not current_signing_key:
            return None
        signer_kwargs = dict(
            key_derivation=self.key_derivation, digest_method=self.digest_method
        )
        return URLSafeTimedSerializer(
            current_signing_key,
            salt=self.salt,
            serializer=self.serializer,
            signer_kwargs=signer_kwargs,
        )
