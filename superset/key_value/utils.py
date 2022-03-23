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

from hashlib import md5
from secrets import token_urlsafe
from typing import Literal, TYPE_CHECKING, Union
from uuid import UUID, uuid3

import hashids
from flask import current_app

from superset.key_value.exceptions import KeyValueParseKeyError
from superset.key_value.types import Key, KeyValueFilter

if TYPE_CHECKING:
    from superset.key_value.models import KeyValueEntry

HASHIDS_MIN_LENGTH = 11


def random_key() -> str:
    return token_urlsafe(48)


def get_filter(resource: str, key: Union[int, UUID]) -> KeyValueFilter:
    try:
        filter_: KeyValueFilter = {"resource": resource}
        if isinstance(key, UUID):
            filter_["uuid"] = key
        else:
            filter_["id"] = key
        return filter_
    except ValueError as ex:
        raise KeyValueParseKeyError() from ex


def encode_permalink_key(key: int, salt: str) -> str:
    obj = hashids.Hashids(salt, min_length=HASHIDS_MIN_LENGTH)
    return obj.encode(key)


def decode_permalink_id(key: str, salt: str) -> int:
    obj = hashids.Hashids(salt, min_length=HASHIDS_MIN_LENGTH)
    return obj.decode(key)[0]


def get_uuid_namespace(seed: str) -> UUID:
    md5_obj = md5()
    md5_obj.update(seed.encode("utf-8"))
    return UUID(md5_obj.hexdigest())
