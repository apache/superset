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

from typing import Any, Optional
from uuid import uuid3

from flask import current_app

from superset.daos.key_value import KeyValueDAO
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource, SharedKey
from superset.key_value.utils import (
    get_uuid_namespace,
    get_uuid_namespace_with_algorithm,
    random_key,
)
from superset.utils.decorators import transaction

RESOURCE = KeyValueResource.APP
CODEC = JsonKeyValueCodec()


def get_shared_value(key: SharedKey) -> Optional[Any]:
    """
    Get a shared value by key, with fallback to MD5 for backward compatibility.
    """
    # Try with current algorithm
    namespace = get_uuid_namespace("")
    uuid_key = uuid3(namespace, key)
    value = KeyValueDAO.get_value(RESOURCE, uuid_key, CODEC)

    # Fallback: try MD5 for legacy entries
    if value is None and current_app.config["HASH_ALGORITHM"] != "md5":
        namespace_md5 = get_uuid_namespace_with_algorithm("", "md5")
        uuid_key_md5 = uuid3(namespace_md5, key)
        value = KeyValueDAO.get_value(RESOURCE, uuid_key_md5, CODEC)

    return value


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
