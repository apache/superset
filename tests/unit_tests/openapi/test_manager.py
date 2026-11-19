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
from flask import Flask
from marshmallow import Schema

from superset.openapi.manager import (
    normalize_app_root,
    resolve_url_prefix,
    resolver,
)


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


def test_resolve_url_prefix_prefers_script_root() -> None:
    # A reverse-proxy prefix (X-Forwarded-Prefix / SCRIPT_NAME) must win over
    # APPLICATION_ROOT so FAB's script_root behavior isn't dropped.
    app = Flask(__name__)
    app.config["APPLICATION_ROOT"] = "/config-root"
    with app.test_request_context(environ_overrides={"SCRIPT_NAME": "/proxy-root"}):
        assert resolve_url_prefix() == "/proxy-root"


def test_resolve_url_prefix_falls_back_to_app_root() -> None:
    app = Flask(__name__)
    app.config["APPLICATION_ROOT"] = "/config-root"
    with app.test_request_context():
        assert resolve_url_prefix() == "/config-root"


def test_resolve_url_prefix_empty_when_neither_set() -> None:
    app = Flask(__name__)
    app.config["APPLICATION_ROOT"] = "/"
    with app.test_request_context():
        assert resolve_url_prefix() == ""


def test_resolver_strips_schema_suffix() -> None:
    class FooSchema(Schema):
        pass

    assert resolver(FooSchema) == "Foo"


def test_resolver_keeps_name_without_schema_suffix() -> None:
    class Bar(Schema):
        pass

    assert resolver(Bar) == "Bar"
