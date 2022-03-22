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
from typing import Literal
from uuid import UUID

from flask import current_app

from superset.key_value.exceptions import KeyValueParseKeyError
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import Key, KeyType, KeyValueFilter


def parse_permalink_key(key: str) -> Key:
    key_type: Literal["id", "uuid"] = current_app.config["PERMALINK_KEY_TYPE"]
    if key_type == "id":
        return Key(id=int(key), uuid=None)
    return Key(id=None, uuid=UUID(key))


def format_permalink_key(key: Key) -> str:
    """
    return the string representation of the key

    :param key: a key object with either a numerical or uuid key
    :return: a formatted string
    """
    return str(key.id if key.id is not None else key.uuid)


def extract_key(entry: KeyValueEntry, key_type: KeyType) -> str:
    return str(entry.id if key_type == "id" else entry.uuid)


def get_filter(resource: str, key: str, key_type: KeyType) -> KeyValueFilter:
    try:
        filter_: KeyValueFilter = {"resource": resource}
        if key_type == "uuid":
            filter_["uuid"] = UUID(key)
        else:
            filter_["id"] = int(key)
        return filter_
    except ValueError as ex:
        raise KeyValueParseKeyError() from ex
