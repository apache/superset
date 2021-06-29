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

from typing import Any, Dict, Type, Union

from .utils import merge_dicts_recursive, take_conf_keys_and_convert_to_dict

ConfigurationValue = Union[Type[Any], Dict[Any, Any]]


def union_values(left_value: Any, right_value: Any, conf_name: str) -> Any:
    strategy = meta_union_strategy.get(
        (type(left_value), type(right_value)), take_right_strategy
    )
    return strategy(left_value, right_value, conf_name)


def override_right_as_class_strategy(
    left_value: ConfigurationValue, right_value: ConfigurationValue, conf_name: str
) -> Type[Any]:
    if isinstance(right_value, dict):
        return type(conf_name, (), right_value)
    return right_value


def merge_as_class_strategy(
    left_value: ConfigurationValue, right_value: ConfigurationValue, conf_name: str
) -> Type[Any]:
    left_dict = take_conf_keys_and_convert_to_dict(left_value)
    right_dict = (
        right_value if isinstance(right_value, dict) else dict(right_value.__dict__)
    )
    base = left_value if isinstance(left_value, type) else object
    merged = {}
    merged.update(left_dict)
    merged.update(right_dict)
    return type(conf_name, (base,), merged)


def override_right_as_dict_strategy(
    left_value: ConfigurationValue, right_value: ConfigurationValue, conf_name: str
) -> Dict[Any, Any]:
    return take_conf_keys_and_convert_to_dict(right_value)


def merge_as_dict_strategy(
    left_value: ConfigurationValue, right_value: ConfigurationValue, conf_name: str
) -> Dict[Any, Any]:
    left_dict = take_conf_keys_and_convert_to_dict(left_value)
    right_dict = take_conf_keys_and_convert_to_dict(right_value)
    try:
        return merge_dicts_recursive(left_dict, right_dict)
    except:
        merged = {}
        merged.update(left_dict)
        merged.update(right_dict)
        return merged


def take_right_strategy(left: Any, right: Any, key_name: str) -> Any:
    return right


meta_union_strategy = {
    (type, type): override_right_as_class_strategy,
    (type, dict): override_right_as_class_strategy,
    (dict, type): override_right_as_class_strategy,
    (dict, dict): merge_as_dict_strategy,
}

if __name__ == "__main__":

    class A:
        NAME = "ofek"
        LAST = "israel"

    class B:
        NAME = "amit"
        ADDRESS = "aaa"

    rv = override_right_as_class_strategy(A, B, "A")  # type: ignore
    print(rv)
    rv = merge_as_class_strategy(A, B, "A")  # type: ignore
    print(rv)
    rv = override_right_as_dict_strategy(A, B, "A")  # type: ignore
    print(rv)
    rv = merge_as_dict_strategy(A, B, "A")  # type: ignore
    print(rv)
    rv = take_right_strategy(A, B, "A")  # type: ignore
    print(rv)
    print("done")
