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
from typing import Any, cast, TypeVar, Union

from superset.exceptions import CreateKeyValueDistributedLockFailedException
from superset.key_value.exceptions import KeyValueCreateFailedError
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource
from superset.utils import json

LOCK_EXPIRATION = timedelta(seconds=30)
logger = logging.getLogger(__name__)


def serialize(params: dict[str, Any]) -> str:
    """
    Serialize parameters into a string.
    """

    T = TypeVar(
        "T",
        bound=Union[dict[str, Any], list[Any], int, float, str, bool, None],
    )

    def sort(obj: T) -> T:
        if isinstance(obj, dict):
            return cast(T, {k: sort(v) for k, v in sorted(obj.items())})
        if isinstance(obj, list):
            return cast(T, [sort(x) for x in obj])
        return obj

    return json.dumps(params)


def get_key(namespace: str, **kwargs: Any) -> uuid.UUID:
    return uuid.uuid5(uuid.uuid5(uuid.NAMESPACE_DNS, namespace), serialize(kwargs))


@contextmanager
def KeyValueDistributedLock(  # pylint: disable=invalid-name
    namespace: str,
    **kwargs: Any,
) -> Iterator[uuid.UUID]:
    """
    KV global lock for refreshing tokens.

    This context manager acquires a distributed lock for a given namespace, with
    optional parameters (eg, namespace="cache", user_id=1). It yields a UUID for the
    lock that can be used within the context, and corresponds to the key in the KV
    store.

    :param namespace: The namespace for which the lock is to be acquired.
    :type namespace: str
    :param kwargs: Additional keyword arguments.
    :yields: A unique identifier (UUID) for the acquired lock (the KV key).
    :raises CreateKeyValueDistributedLockFailedException: If the lock is taken.
    """
    # pylint: disable=import-outside-toplevel
    from superset.commands.key_value.create import CreateKeyValueCommand
    from superset.commands.key_value.delete import DeleteKeyValueCommand
    from superset.commands.key_value.delete_expired import DeleteExpiredKeyValueCommand

    key = get_key(namespace, **kwargs)
    logger.debug("Acquiring lock on namespace %s for key %s", namespace, key)
    try:
        DeleteExpiredKeyValueCommand(resource=KeyValueResource.LOCK).run()
        CreateKeyValueCommand(
            resource=KeyValueResource.LOCK,
            codec=JsonKeyValueCodec(),
            key=key,
            value=True,
            expires_on=datetime.now() + LOCK_EXPIRATION,
        ).run()

        yield key

        DeleteKeyValueCommand(resource=KeyValueResource.LOCK, key=key).run()
        logger.debug("Removed lock on namespace %s for key %s", namespace, key)
    except KeyValueCreateFailedError as ex:
        raise CreateKeyValueDistributedLockFailedException(
            "Error acquiring lock"
        ) from ex
