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
from flask_appbuilder.api.manager import SwaggerView


def test_swagger_template_without_prefix(app_context: None) -> None:
    view = SwaggerView()
    original_app_root = current_app.config.get("APPLICATION_ROOT")
    try:
        current_app.config["APPLICATION_ROOT"] = "/"
        with current_app.test_request_context("/swagger/v1"):
            response = view.show("v1")
            html = (
                response
                if isinstance(response, str)
                else response.get_data(as_text=True)
            )
            assert 'url: "/api/v1/_openapi"' in html
    finally:
        current_app.config["APPLICATION_ROOT"] = original_app_root


def test_swagger_template_with_prefix_script_name(app_context: None) -> None:
    view = SwaggerView()
    original_app_root = current_app.config.get("APPLICATION_ROOT")
    try:
        current_app.config["APPLICATION_ROOT"] = "/prefix"
        with current_app.test_request_context(
            "/swagger/v1",
            environ_overrides={"SCRIPT_NAME": "/prefix"},
        ):
            response = view.show("v1")
            html = (
                response
                if isinstance(response, str)
                else response.get_data(as_text=True)
            )
            assert 'url: "/prefix/api/v1/_openapi"' in html
    finally:
        current_app.config["APPLICATION_ROOT"] = original_app_root


def test_swagger_template_with_prefix_fallback(app_context: None) -> None:
    view = SwaggerView()
    original_app_root = current_app.config.get("APPLICATION_ROOT")
    try:
        current_app.config["APPLICATION_ROOT"] = "/prefix"
        with current_app.test_request_context("/swagger/v1"):
            response = view.show("v1")
            html = (
                response
                if isinstance(response, str)
                else response.get_data(as_text=True)
            )
            assert 'url: "/prefix/api/v1/_openapi"' in html
    finally:
        current_app.config["APPLICATION_ROOT"] = original_app_root
