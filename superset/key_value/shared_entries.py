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
from typing import Any, Optional
from uuid import uuid3

from superset.daos.key_value import KeyValueDAO
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource, SharedKey
from superset.key_value.utils import (
    get_fallback_algorithms,
    get_uuid_namespace,
    get_uuid_namespace_with_algorithm,
    random_key,
)
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)

RESOURCE = KeyValueResource.APP
CODEC = JsonKeyValueCodec()


def get_shared_value(key: SharedKey) -> Optional[Any]:
    """
    Get a shared value by key, with configurable fallback for backward compatibility.

    If found via fallback algorithm, automatically migrates the entry to current
    algorithm's UUID.
    """
    # Try with current algorithm
    namespace = get_uuid_namespace("")
    uuid_key = uuid3(namespace, key)
    value = KeyValueDAO.get_value(RESOURCE, uuid_key, CODEC)

    if value is not None:
        return value

    # Fallback: try configured fallback algorithms for legacy entries
    for fallback_algo in get_fallback_algorithms():
        namespace_fallback = get_uuid_namespace_with_algorithm("", fallback_algo)
        uuid_key_fallback = uuid3(namespace_fallback, key)
        value = KeyValueDAO.get_value(RESOURCE, uuid_key_fallback, CODEC)

        # If found via fallback, migrate to current algorithm
        if value is not None:
            try:
                # Create new entry with current algorithm UUID
                KeyValueDAO.create_entry(RESOURCE, value, CODEC, uuid_key)
                # Note: We keep the old entry for safety
                # It can be cleaned up later with a manual migration script
            except Exception as ex:
                # If creation fails (e.g., duplicate), that's fine
                # The entry might already exist
                logger.debug("Failed to migrate entry to current algorithm: %s", ex)

            return value

    return None


@transaction()
def set_shared_value(key: SharedKey, value: Any) -> None:
    """
    Set a shared value by key, using current hash algorithm.

    Note: This creates a new entry. To update existing entries,
    use KeyValueDAO.upsert_entry directly.
    """
    namespace = get_uuid_namespace("")
    uuid_key = uuid3(namespace, key)
    KeyValueDAO.create_entry(RESOURCE, value, CODEC, uuid_key)


def get_permalink_salt(key: SharedKey) -> str:
    salt = get_shared_value(key)
    if salt is None:
        # Use a 48 bytes salt
        salt = random_key(48)
        set_shared_value(key, value=salt)
    return salt
