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

from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator, TYPE_CHECKING

import backoff
import jwt
from flask import current_app, url_for
from marshmallow import EXCLUDE, fields, post_load, Schema, validate

from superset import db
from superset.distributed_lock import KeyValueDistributedLock
from superset.exceptions import CreateKeyValueDistributedLockFailedException
from superset.superset_typing import OAuth2ClientConfig, OAuth2State

if TYPE_CHECKING:
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.models.core import Database, DatabaseUserOAuth2Tokens

JWT_EXPIRATION = timedelta(minutes=5)


@backoff.on_exception(
    backoff.expo,
    CreateKeyValueDistributedLockFailedException,
    factor=10,
    base=2,
    max_tries=5,
)
def get_oauth2_access_token(
    config: OAuth2ClientConfig,
    database_id: int,
    user_id: int,
    db_engine_spec: type[BaseEngineSpec],
) -> str | None:
    """
    Return a valid OAuth2 access token.

    If the token exists but is expired and a refresh token is available the function will
    return a fresh token and store it in the database for further requests. The function
    has a retry decorator, in case a dashboard with multiple charts triggers
    simultaneous requests for refreshing a stale token; in that case only the first
    process to acquire the lock will perform the refresh, and othe process should find a
    a valid token when they retry.
    """  # noqa: E501
    # pylint: disable=import-outside-toplevel
    from superset.models.core import DatabaseUserOAuth2Tokens

    token = (
        db.session.query(DatabaseUserOAuth2Tokens)
        .filter_by(user_id=user_id, database_id=database_id)
        .one_or_none()
    )
    if token is None:
        return None

    if token.access_token and datetime.now() < token.access_token_expiration:
        return token.access_token

    if token.refresh_token:
        return refresh_oauth2_token(config, database_id, user_id, db_engine_spec, token)

    # since the access token is expired and there's no refresh token, delete the entry
    db.session.delete(token)

    return None


def refresh_oauth2_token(
    config: OAuth2ClientConfig,
    database_id: int,
    user_id: int,
    db_engine_spec: type[BaseEngineSpec],
    token: DatabaseUserOAuth2Tokens,
) -> str | None:
    with KeyValueDistributedLock(
        namespace="refresh_oauth2_token",
        user_id=user_id,
        database_id=database_id,
    ):
        token_response = db_engine_spec.get_oauth2_fresh_token(
            config,
            token.refresh_token,
        )

        # store new access token; note that the refresh token might be revoked, in which
        # case there would be no access token in the response
        if "access_token" not in token_response:
            return None

        token.access_token = token_response["access_token"]
        token.access_token_expiration = datetime.now() + timedelta(
            seconds=token_response["expires_in"]
        )
        db.session.add(token)

    return token.access_token


def encode_oauth2_state(state: OAuth2State) -> str:
    """
    Encode the OAuth2 state.
    """
    payload = {
        "exp": datetime.now(tz=timezone.utc) + JWT_EXPIRATION,
        "database_id": state["database_id"],
        "user_id": state["user_id"],
        "default_redirect_uri": state["default_redirect_uri"],
        "tab_id": state["tab_id"],
    }
    encoded_state = jwt.encode(
        payload=payload,
        key=current_app.config["SECRET_KEY"],
        algorithm=current_app.config["DATABASE_OAUTH2_JWT_ALGORITHM"],
    )

    # Google OAuth2 needs periods to be escaped.
    encoded_state = encoded_state.replace(".", "%2E")

    return encoded_state


class OAuth2StateSchema(Schema):
    database_id = fields.Int(required=True)
    user_id = fields.Int(required=True)
    default_redirect_uri = fields.Str(required=True)
    tab_id = fields.Str(required=True)

    # pylint: disable=unused-argument
    @post_load
    def make_oauth2_state(
        self,
        data: dict[str, Any],
        **kwargs: Any,
    ) -> OAuth2State:
        return OAuth2State(
            database_id=data["database_id"],
            user_id=data["user_id"],
            default_redirect_uri=data["default_redirect_uri"],
            tab_id=data["tab_id"],
        )

    class Meta:  # pylint: disable=too-few-public-methods
        # ignore `exp`
        unknown = EXCLUDE


oauth2_state_schema = OAuth2StateSchema()


def decode_oauth2_state(encoded_state: str) -> OAuth2State:
    """
    Decode the OAuth2 state.
    """
    # Google OAuth2 needs periods to be escaped.
    encoded_state = encoded_state.replace("%2E", ".")

    payload = jwt.decode(
        jwt=encoded_state,
        key=current_app.config["SECRET_KEY"],
        algorithms=[current_app.config["DATABASE_OAUTH2_JWT_ALGORITHM"]],
    )
    state = oauth2_state_schema.load(payload)

    return state


class OAuth2ClientConfigSchema(Schema):
    id = fields.String(required=True)
    secret = fields.String(required=True)
    scope = fields.String(required=True)
    redirect_uri = fields.String(
        required=False,
        load_default=lambda: url_for("DatabaseRestApi.oauth2", _external=True),
    )
    authorization_request_uri = fields.String(required=True)
    token_request_uri = fields.String(required=True)
    request_content_type = fields.String(
        required=False,
        load_default=lambda: "json",
        validate=validate.OneOf(["json", "data"]),
    )


@contextmanager
def check_for_oauth2(database: Database) -> Iterator[None]:
    """
    Run code and check if OAuth2 is needed.
    """
    try:
        yield
    except Exception as ex:
        if database.is_oauth2_enabled() and database.db_engine_spec.needs_oauth2(ex):
            database.db_engine_spec.start_oauth2_dance(database)
        raise
