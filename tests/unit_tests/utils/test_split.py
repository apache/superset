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

from superset.utils.core import split


def test_split_empty_string():
    assert list(split("")) == [""]


def test_split_leading_delimiter():
    assert list(split(" a")) == [
        "",
        "a",
    ]


def test_split_trailing_delimiter():
    assert list(split("a ")) == [
        "a",
        "",
    ]


def test_split_only_delimiter():
    assert list(split(" ")) == [
        "",
        "",
    ]


def test_split_nested_parentheses():
    assert list(
        split(
            "a,(b,(c,d))",
            delimiter=",",
        )
    ) == [
        "a",
        "(b,(c,d))",
    ]


def test_branch_separator_found():
    assert list(split("a b")) == [
        "a",
        "b",
    ]


def test_branch_separator_not_found():
    assert list(split("ab")) == [
        "ab",
    ]


def test_branch_parentheses():
    assert list(split("(a b)")) == [
        "(a b)",
    ]


def test_branch_escaped_quote():
    assert list(split(r'"a\"b c" d')) == [
        r'"a\"b c"',
        "d",
    ]
