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

import logging
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

import backoff

from superset import db
from superset.db_engine_specs.base import BaseEngineSpec
from superset.exceptions import CreateAuthLockFailedException
from superset.key_value.exceptions import KeyValueCreateFailedError
from superset.key_value.types import KeyValueResource, PickleKeyValueCodec

if TYPE_CHECKING:
    from superset.models.core import DatabaseUserOAuth2Tokens


LOCK_EXPIRATION = timedelta(seconds=30)
logger = logging.getLogger(__name__)


@backoff.on_exception(
    backoff.expo,
    CreateAuthLockFailedException,
    factor=10,
    base=2,
    max_tries=5,
)
def get_oauth2_access_token(
    database_id: int,
    user_id: int,
    db_engine_spec: type[BaseEngineSpec],
) -> str | None:
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

    if token.access_token and datetime.now() < token.access_token_expiration:
        return token.access_token

    if token.refresh_token:
        return refresh_oauth2_token(database_id, user_id, db_engine_spec, token)

    # since the access token is expired and there's no refresh token, delete the entry
    db.session.delete(token)

    return None


def integers_to_uuid(a: int, b: int) -> uuid.UUID:  # pylint: disable=invalid-name
    """
    Generate UUID based on a namespace UUID and the string representation of integer pair.
    """
    pair_str = f"{a}-{b}"
    return uuid.uuid5(uuid.NAMESPACE_DNS, pair_str)


@contextmanager
def AuthLock(  # pylint: disable=invalid-name
    user_id: int,
    database_id: int,
) -> Iterator[None]:
    """
    KV global lock for refreshing tokens.
    """
    # pylint: disable=import-outside-toplevel
    from superset.commands.key_value.create import CreateKeyValueCommand
    from superset.commands.key_value.delete import DeleteKeyValueCommand
    from superset.commands.key_value.delete_expired import DeleteExpiredKeyValueCommand

    key = integers_to_uuid(user_id, database_id)
    logger.debug(
        "Acquiring lock to refresh OAuth2 token for user ID %d and database ID %d",
        user_id,
        database_id,
    )
    try:
        DeleteExpiredKeyValueCommand(resource=KeyValueResource.OAUTH2).run()
        CreateKeyValueCommand(
            resource=KeyValueResource.OAUTH2,
            codec=PickleKeyValueCodec(),
            key=key,
            value=True,
            expires_on=datetime.now() + LOCK_EXPIRATION,
        ).run()
        yield
    except KeyValueCreateFailedError as ex:
        raise CreateAuthLockFailedException("Error acquiring lock") from ex
    finally:
        DeleteKeyValueCommand(resource=KeyValueResource.OAUTH2, key=key).run()
        logger.debug(
            "Removed lock to refresh OAuth2 token for user ID %d and database ID %d",
            user_id,
            database_id,
        )


def refresh_oauth2_token(
    database_id: int,
    user_id: int,
    db_engine_spec: type[BaseEngineSpec],
    token: DatabaseUserOAuth2Tokens,
) -> str | None:
    with AuthLock(user_id, database_id):
        token_response = db_engine_spec.get_oauth2_fresh_token(token.refresh_token)

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
