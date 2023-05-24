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

from typing import Any, TYPE_CHECKING

from superset.models.filter_set import FilterSet
from tests.integration_tests.dashboards.filter_sets.consts import FILTER_SET_URI
from tests.integration_tests.test_app import app

if TYPE_CHECKING:
    from flask import Response
    from flask.testing import FlaskClient


def call_create_filter_set(
    client: FlaskClient[Any], dashboard_id: int, data: dict[str, Any]
) -> Response:
    uri = FILTER_SET_URI.format(dashboard_id=dashboard_id)
    return client.post(uri, json=data)


def call_get_filter_sets(client: FlaskClient[Any], dashboard_id: int) -> Response:
    uri = FILTER_SET_URI.format(dashboard_id=dashboard_id)
    return client.get(uri)


def call_delete_filter_set(
    client: FlaskClient[Any],
    filter_set_dict_to_update: dict[str, Any],
    dashboard_id: int | None = None,
) -> Response:
    dashboard_id = (
        dashboard_id
        if dashboard_id is not None
        else filter_set_dict_to_update["dashboard_id"]
    )
    uri = "{}/{}".format(
        FILTER_SET_URI.format(dashboard_id=dashboard_id),
        filter_set_dict_to_update["id"],
    )
    return client.delete(uri)


def call_update_filter_set(
    client: FlaskClient[Any],
    filter_set_dict_to_update: dict[str, Any],
    data: dict[str, Any],
    dashboard_id: int | None = None,
) -> Response:
    dashboard_id = (
        dashboard_id
        if dashboard_id is not None
        else filter_set_dict_to_update["dashboard_id"]
    )
    uri = "{}/{}".format(
        FILTER_SET_URI.format(dashboard_id=dashboard_id),
        filter_set_dict_to_update["id"],
    )
    return client.put(uri, json=data)


def get_filter_set_by_name(name: str) -> FilterSet:
    with app.app_context():
        return FilterSet.get_by_name(name)


def get_filter_set_by_id(id_: int) -> FilterSet:
    with app.app_context():
        return FilterSet.get(id_)


def get_filter_set_by_dashboard_id(dashboard_id: int) -> FilterSet:
    with app.app_context():
        return FilterSet.get_by_dashboard_id(dashboard_id)


def collect_all_ids(
    filtersets: dict[str, list[FilterSet]] | list[FilterSet]
) -> set[int]:
    if isinstance(filtersets, dict):
        filtersets_lists: list[list[FilterSet]] = list(filtersets.values())
        ids: set[int] = set()
        lst: list[FilterSet]
        for lst in filtersets_lists:
            ids.update(set(map(lambda fs: fs.id, lst)))
        return ids
    return set(map(lambda fs: fs.id, filtersets))
