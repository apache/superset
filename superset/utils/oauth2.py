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

from datetime import datetime, timedelta
from typing import Optional, Type

from superset import db
from superset.db_engine_specs.base import BaseEngineSpec


def get_oauth2_access_token(
    database_id: int,
    user_id: int,
    db_engine_spec: Type[BaseEngineSpec],
) -> Optional[str]:
    """
    Return a valid OAuth2 access token.

    If the token exists but is expired and a refresh token is available the function will
    return a fresh token and store it in the database for further requests.
    """
    # pylint: disable=import-outside-toplevel
    from superset.models.core import DatabaseUserOAuth2Tokens

    token = (
        db.session.query(DatabaseUserOAuth2Tokens)
        .filter_by(user_id=user_id, database_id=database_id)
        .one_or_none()
    )
    if token is None:
        return None

    if token.access_token and token.access_token_expiration < datetime.now():
        return token.access_token

    if token.refresh_token:
        # refresh access token
        token_response = db_engine_spec.get_oauth2_fresh_token(token.refresh_token)

        # store new access token; note that the refresh token might be revoked, in which
        # case there would be no access token in the response
        if "access_token" in token_response:
            token.access_token = token_response["access_token"]
            token.access_token_expiration = datetime.now() + timedelta(
                seconds=token_response["expires_in"]
            )
            db.session.add(token)

            return token.access_token

    # since the access token is expired and there's no refresh token, delete the entry
    db.session.delete(token)

    return None
