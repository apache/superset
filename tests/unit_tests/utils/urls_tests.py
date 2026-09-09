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

from flask import current_app

from superset.utils.urls import get_url_path, modify_url_query

EXPLORE_CHART_LINK = "http://localhost:9000/explore/?form_data=%7B%22slice_id%22%3A+76%7D&standalone=true&force=false"

EXPLORE_DASHBOARD_LINK = "http://localhost:9000/superset/dashboard/3/?standalone=3"


def test_convert_chart_link() -> None:
    test_url = modify_url_query(EXPLORE_CHART_LINK, standalone="0")
    assert (
        test_url
        == "http://localhost:9000/explore/?form_data=%7B%22slice_id%22%3A%2076%7D&standalone=0&force=false"
    )


def test_convert_dashboard_link() -> None:
    test_url = modify_url_query(EXPLORE_DASHBOARD_LINK, standalone="0")
    assert test_url == "http://localhost:9000/superset/dashboard/3/?standalone=0"


def test_convert_dashboard_link_with_integer() -> None:
    test_url = modify_url_query(EXPLORE_DASHBOARD_LINK, standalone=0)
    assert test_url == "http://localhost:9000/superset/dashboard/3/?standalone=0"


def test_modify_url_query_preserves_repeated_and_blank_params() -> None:
    test_url = modify_url_query(
        "http://localhost:9000/explore/?a=1&a=2&b=&c=3",
        a=[4, 5],
    )

    assert test_url == "http://localhost:9000/explore/?a=4&a=5&b=&c=3"


def test_modify_url_query_appends_new_params_after_existing_params() -> None:
    test_url = modify_url_query(
        "http://localhost:9000/explore/?a=1&a=2&b=&c=3",
        d=7,
    )

    assert test_url == "http://localhost:9000/explore/?a=1&a=2&b=&c=3&d=7"


def test_modify_url_query_preserves_standard_url_encoding_for_list_values() -> None:
    test_url = modify_url_query(
        "http://localhost:9000/explore/?existing=ok",
        tag=["alpha value", "beta/value"],
    )

    assert (
        test_url
        == "http://localhost:9000/explore/?existing=ok&tag=alpha%20value&tag=beta/value"
    )


def test_get_url_path_preserves_query_params(app_context: None) -> None:
    current_app.config["WEBDRIVER_BASEURL"] = "http://localhost:9000/"

    test_url = get_url_path(
        "static",
        filename="assets/images/favicon.png",
        standalone=1,
        form_data='{"slice_id": 76}',
    )

    assert (
        test_url
        == "http://localhost:9000/static/assets/images/favicon.png?standalone=1&form_data=%7B%22slice_id%22:+76%7D"
    )
