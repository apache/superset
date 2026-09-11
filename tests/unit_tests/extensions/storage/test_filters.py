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

"""Tests for ExtensionStorageFilter — the ambient-context isolation boundary."""

from __future__ import annotations

from unittest.mock import MagicMock

from flask import Flask

from superset.extensions.context import use_context
from superset.extensions.storage.filters import ExtensionStorageFilter
from superset.extensions.storage.persistent_model import ExtensionStorage

from .conftest import create_context


def test_apply_scopes_to_the_ambient_extension_id(app: Flask) -> None:
    """apply() filters by the extension_id of the current ambient context."""
    ctx = create_context(publisher="acme", name="widgets")
    query = MagicMock()

    with app.app_context(), use_context(ctx):
        ExtensionStorageFilter("extension_id", MagicMock()).apply(query, None)

    filter_arg = query.filter.call_args[0][0]
    assert filter_arg.right.value == "acme.widgets"


def test_apply_matches_nothing_outside_an_extension_context(app: Flask) -> None:
    """apply() filters on extension_id IS NULL when no ambient context is set.

    This is a deliberate fail-closed default: a query made outside extension
    execution (e.g. accidentally from host code) must never fall through to
    an unscoped query that would return every extension's storage.
    """
    query = MagicMock()

    with app.app_context():
        ExtensionStorageFilter("extension_id", MagicMock()).apply(query, None)

    filter_arg = query.filter.call_args[0][0]
    assert str(filter_arg) == str(ExtensionStorage.extension_id.is_(None))


def test_different_extensions_get_different_filters(app: Flask) -> None:
    """Two different ambient contexts produce two different filter clauses."""
    ctx_a = create_context(publisher="acme", name="widgets")
    ctx_b = create_context(publisher="acme", name="gadgets")

    query_a = MagicMock()
    query_b = MagicMock()

    with app.app_context():
        with use_context(ctx_a):
            ExtensionStorageFilter("extension_id", MagicMock()).apply(query_a, None)
        with use_context(ctx_b):
            ExtensionStorageFilter("extension_id", MagicMock()).apply(query_b, None)

    filter_a = query_a.filter.call_args[0][0]
    filter_b = query_b.filter.call_args[0][0]
    assert filter_a.right.value == "acme.widgets"
    assert filter_b.right.value == "acme.gadgets"
