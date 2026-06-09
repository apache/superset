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
import pytest
from marshmallow import Schema

from superset.openapi.manager import normalize_app_root, resolver


@pytest.mark.parametrize(
    "app_root,expected",
    [
        ("/", ""),
        ("", ""),
        (None, ""),
        ("/prefix", "/prefix"),
        ("/prefix/", "/prefix"),
        ("/nested/prefix/", "/nested/prefix"),
    ],
)
def test_normalize_app_root(app_root: str | None, expected: str) -> None:
    assert normalize_app_root(app_root) == expected


def test_resolver_strips_schema_suffix() -> None:
    class FooSchema(Schema):
        pass

    assert resolver(FooSchema) == "Foo"


def test_resolver_keeps_name_without_schema_suffix() -> None:
    class Bar(Schema):
        pass

    assert resolver(Bar) == "Bar"
