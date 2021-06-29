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

from typing import Any, Dict, Tuple, Type

from pytest import fixture


@fixture
def left_unique_key_value() -> Tuple[str, Any]:
    return "left_unique", "left_unique_value"


@fixture
def right_unique_key_value() -> Tuple[str, Any]:
    return "right_unique", "right_unique_value"


@fixture
def similar_key_of_str() -> str:
    return "similar_str"


@fixture
def similar_key_of_type() -> str:
    return "similar_type"


@fixture
def similar_key_of_dict() -> str:
    return "similar_dict"


@fixture
def similar_key_of_object() -> str:
    return "similar_object"


@fixture
def left_similar_str_key_value(similar_key_of_str: str) -> Tuple[str, str]:
    return similar_key_of_str, "left_similar_str_value"


@fixture
def left_similar_type_key_value(similar_key_of_type: str) -> Tuple[str, Type[Any]]:
    class SimilarType:
        left_key = "left_value"

    return similar_key_of_type, SimilarType


@fixture
def left_similar_dict_key_value(
    similar_key_of_dict: str,
    left_unique_key_value: Tuple[str, Any],
    left_similar_str_key_value: Tuple[str, str],
) -> Tuple[str, Dict[Any, Any]]:
    return (
        similar_key_of_dict,
        {
            left_unique_key_value[0]: left_unique_key_value[1],
            left_similar_str_key_value[0]: left_similar_str_key_value[1],
        },
    )


@fixture
def left_similar_object_key_value(
    similar_key_of_object: str, left_similar_dict_key_value: Tuple[str, Dict[Any, Any]]
):
    obj = object()
    obj.__dict__.update(left_similar_dict_key_value[1])
    return similar_key_of_object, obj


@fixture
def right_similar_str_key_value(similar_key_of_str: str) -> Tuple[str, str]:
    return similar_key_of_str, "right_similar_str_value"


@fixture
def right_similar_type_key_value(similar_key_of_type: str) -> Tuple[str, Type[Any]]:
    class SimilarType:
        right_key = "right_value"

    return similar_key_of_type, SimilarType


@fixture
def right_similar_dict_key_value(
    similar_key_of_dict: str,
    right_unique_key_value: Tuple[str, Any],
    right_similar_str_key_value: Tuple[str, str],
) -> Tuple[str, Dict[Any, Any]]:
    return (
        similar_key_of_dict,
        {
            right_unique_key_value[0]: right_unique_key_value[1],
            right_similar_str_key_value[0]: right_similar_str_key_value[1],
        },
    )


@fixture
def right_similar_object_key_value(
    similar_key_of_object: str, right_similar_dict_key_value: Tuple[str, Dict[Any, Any]]
):
    obj = object()
    obj.__dict__.update(right_similar_dict_key_value[1])
    return similar_key_of_object, obj


@fixture
def left_values(
    left_unique_key_value: Tuple[str, Any],
    left_similar_str_key_value: Tuple[str, str],
    left_similar_type_key_value: Tuple[str, Type[Any]],
    left_similar_dict_key_value: Tuple[str, Dict[Any, Any]],
    left_similar_object_key_value: Tuple[str, object],
) -> Dict[str, Any]:
    return {
        left_unique_key_value[0]: left_unique_key_value[1],
        left_similar_str_key_value[0]: left_similar_str_key_value[1],
        left_similar_type_key_value[0]: left_similar_type_key_value[1],
        left_similar_dict_key_value[0]: left_similar_dict_key_value[1],
        left_similar_object_key_value[0]: left_similar_object_key_value[1],
    }


@fixture
def right_values(
    right_unique_key_value: Tuple[str, Any],
    right_similar_str_key_value: Tuple[str, str],
    right_similar_type_key_value: Tuple[str, Type[Any]],
    right_similar_dict_key_value: Tuple[str, Dict[Any, Any]],
    right_similar_object_key_value: Tuple[str, object],
) -> Dict[str, Any]:
    return {
        right_unique_key_value[0]: left_unique_key_value[1],
        right_similar_str_key_value[0]: right_similar_str_key_value[1],
        right_similar_type_key_value[0]: right_similar_type_key_value[1],
        right_similar_dict_key_value[0]: right_similar_dict_key_value[1],
        right_similar_object_key_value[0]: right_similar_object_key_value[1],
    }
