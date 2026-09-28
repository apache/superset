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

from unittest.mock import MagicMock, patch

from flask_appbuilder.api import expose

from superset.core.api.core_api_injection import _contextualize_extension_api


def test_extension_api_methods_run_in_extension_context() -> None:
    manifest = MagicMock()

    class TestApi:
        @expose("/callback", methods=("GET",))
        def callback(self) -> str:
            return "ok"

        def helper(self) -> str:
            return "helper"

    original_helper = TestApi.helper
    with (
        patch(
            "superset.core.api.core_api_injection.extension_context"
        ) as extension_context,
        patch(
            "superset.core.api.core_api_injection.get_user_id",
            return_value=42,
        ),
    ):
        _contextualize_extension_api(TestApi, manifest)

        assert TestApi().callback() == "ok"

    extension_context.assert_called_once_with(manifest, user_id=42)
    assert TestApi.helper is original_helper
    assert TestApi.callback._urls == [("/callback", ("GET",))]
