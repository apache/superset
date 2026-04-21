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
from flask_appbuilder.models.sqla.filters import FilterIn

from superset.views.log.api import LogRestApi


def test_list_columns_contains_source() -> None:
    assert "source" in LogRestApi.list_columns


def test_search_columns_contains_source() -> None:
    assert "source" in LogRestApi.search_columns


def test_source_positioned_after_action_in_list_columns() -> None:
    cols = LogRestApi.list_columns
    assert cols.index("source") > cols.index("action")


def test_source_positioned_after_action_in_search_columns() -> None:
    cols = LogRestApi.search_columns
    assert cols.index("source") > cols.index("action")


def test_source_search_filter_uses_filter_in() -> None:
    assert FilterIn in LogRestApi.search_filters.get("source", [])
