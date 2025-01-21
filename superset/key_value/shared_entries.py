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

from superset.daos.key_value import KeyValueDAO
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource, SharedKey
from superset.key_value.utils import get_uuid_namespace, random_key
from superset.utils.decorators import transaction

RESOURCE = KeyValueResource.APP
NAMESPACE = get_uuid_namespace("")
CODEC = JsonKeyValueCodec()


def get_shared_value(key: SharedKey) -> Optional[Any]:
    uuid_key = uuid3(NAMESPACE, key)
    return KeyValueDAO.get_value(RESOURCE, uuid_key, CODEC)


@transaction()
def set_shared_value(key: SharedKey, value: Any) -> None:
    uuid_key = uuid3(NAMESPACE, key)
    KeyValueDAO.create_entry(RESOURCE, value, CODEC, uuid_key)


def get_permalink_salt(key: SharedKey) -> str:
    salt = get_shared_value(key)
    if salt is None:
        # Use a 48 bytes salt
        salt = random_key(48)
        set_shared_value(key, value=salt)
    return salt
