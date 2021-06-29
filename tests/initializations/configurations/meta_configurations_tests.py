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
# isort:skip_file
from __future__ import annotations
from superset.initialization.configurations.meta_configurations import (
    override_right_as_class_strategy,
    merge_as_class_strategy,
    override_right_as_dict_strategy,
    merge_as_dict_strategy,
)
from pytest import fixture
from typing import Type, Any, Dict

TEST_KEY = "TestKey"


@fixture
def left_class() -> Type[Any]:
    class TestKey:
        FIRST = "left_first"
        SECOND = "left_second"

    return TestKey


@fixture
def right_class() -> Type[Any]:
    class TestKey:
        FIRST = "right_first"
        THIRD = "right_third"

    return TestKey


@fixture
def left_dict() -> Dict[str, Any]:
    return {"FIRST": "left_first", "SECOND": "left_second"}


@fixture
def right_dict() -> Dict[str, Any]:
    return {"FIRST": "right_first", "THIRD": "right_third"}


@fixture
def setup_sample_data():
    pass


class TestOverrideRightAsClassStrategy:
    def test_with_classes(self, left_class: Type[Any], right_class: Type[Any]) -> None:
        union_class = override_right_as_class_strategy(
            left_class, right_class, TEST_KEY
        )

        self.assert_union_class(union_class)

    def assert_union_class(self, union_class):
        union_class_dict = union_class.__dict__
        assert union_class.__name__ == TEST_KEY
        assert "FIRST" in union_class_dict
        assert "SECOND" not in union_class_dict
        assert "THIRD" in union_class_dict
        assert "right_first" == union_class_dict["FIRST"]

    def test_with_class_and_dict(
        self, left_class: Type[Any], right_dict: Dict[str, Any]
    ) -> None:
        union_class = override_right_as_class_strategy(left_class, right_dict, TEST_KEY)

        self.assert_union_class(union_class)

    def test_with_dicts(
        self, left_dict: Dict[str, Any], right_dict: Dict[str, Any]
    ) -> None:
        union_class = override_right_as_class_strategy(left_dict, right_dict, TEST_KEY)

        self.assert_union_class(union_class)

    def test_with_dict_and_class(
        self, left_dict: Dict[str, Any], right_class: Type[Any]
    ) -> None:
        union_class = override_right_as_class_strategy(left_dict, right_class, TEST_KEY)

        self.assert_union_class(union_class)


class TestMergeAsClassStrategy:
    def test_with_classes(self, left_class: Type[Any], right_class: Type[Any]) -> None:
        union_class = merge_as_class_strategy(left_class, right_class, TEST_KEY)

        self.assert_union_class(union_class)

    def assert_union_class(self, union_class):
        union_class_dict = union_class.__dict__
        assert union_class.__name__ == TEST_KEY
        assert "FIRST" in union_class_dict
        assert "SECOND" in union_class_dict
        assert "THIRD" in union_class_dict
        assert "right_first" == union_class_dict["FIRST"]

    def test_with_class_and_dict(
        self, left_class: Type[Any], right_dict: Dict[str, Any]
    ) -> None:
        union_class = merge_as_class_strategy(left_class, right_dict, TEST_KEY)

        self.assert_union_class(union_class)

    def test_with_dicts(
        self, left_dict: Dict[str, Any], right_dict: Dict[str, Any]
    ) -> None:
        union_class = merge_as_class_strategy(left_dict, right_dict, TEST_KEY)

        self.assert_union_class(union_class)

    def test_with_dict_and_class(
        self, left_dict: Dict[str, Any], right_class: Type[Any]
    ) -> None:
        union_class = merge_as_class_strategy(left_dict, right_class, TEST_KEY)

        self.assert_union_class(union_class)


class TestOverrideRightAsDictStrategy:
    def test_with_classes(self, left_class: Type[Any], right_class: Type[Any]) -> None:
        union_dict = override_right_as_dict_strategy(left_class, right_class, TEST_KEY)

        self.assert_union_dict(union_dict)

    def assert_union_dict(self, union_dict):
        assert "FIRST" in union_dict
        assert "SECOND" not in union_dict
        assert "THIRD" in union_dict
        assert "right_first" == union_dict["FIRST"]

    def test_with_class_and_dict(
        self, left_class: Type[Any], right_dict: Dict[str, Any]
    ) -> None:
        union_dict = override_right_as_dict_strategy(left_class, right_dict, TEST_KEY)

        self.assert_union_dict(union_dict)

    def test_with_dicts(
        self, left_dict: Dict[str, Any], right_dict: Dict[str, Any]
    ) -> None:
        union_dict = override_right_as_dict_strategy(left_dict, right_dict, TEST_KEY)

        self.assert_union_dict(union_dict)

    def test_with_dict_and_class(
        self, left_dict: Dict[str, Any], right_class: Type[Any]
    ) -> None:
        union_dict = override_right_as_dict_strategy(left_dict, right_class, TEST_KEY)

        self.assert_union_dict(union_dict)


class TestMergeAsDictStrategy:
    def test_with_classes(self, left_class: Type[Any], right_class: Type[Any]) -> None:
        union_dict = merge_as_dict_strategy(left_class, right_class, TEST_KEY)

        self.assert_union_dict(union_dict)

    def assert_union_dict(self, union_dict):
        assert "FIRST" in union_dict
        assert "SECOND" in union_dict
        assert "THIRD" in union_dict
        assert "right_first" == union_dict["FIRST"]

    def test_with_class_and_dict(
        self, left_class: Type[Any], right_dict: Dict[str, Any]
    ) -> None:
        union_dict = merge_as_dict_strategy(left_class, right_dict, TEST_KEY)

        self.assert_union_dict(union_dict)

    def test_with_dicts(
        self, left_dict: Dict[str, Any], right_dict: Dict[str, Any]
    ) -> None:
        union_dict = merge_as_dict_strategy(left_dict, right_dict, TEST_KEY)

        self.assert_union_dict(union_dict)

    def test_with_dict_and_class(
        self, left_dict: Dict[str, Any], right_class: Type[Any]
    ) -> None:
        union_dict = merge_as_dict_strategy(left_dict, right_class, TEST_KEY)

        self.assert_union_dict(union_dict)
