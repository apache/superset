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
from os import environ
from typing import TYPE_CHECKING

from superset.app import create_app

if TYPE_CHECKING:
    from typing import Any

    from flask.testing import FlaskClient


# DEPRECATED: Do not use this global app instance directly
# Use the app fixture from conftest.py instead
# This is kept for backward compatibility only
def _get_app():
    """Get app instance lazily. This function is deprecated."""
    superset_config_module = environ.get(
        "SUPERSET_CONFIG", "tests.integration_tests.superset_test_config"
    )
    return create_app(superset_config_module=superset_config_module)


# Create app lazily to avoid issues with config at import time
_app = None


def __getattr__(name):
    """Lazy load app attribute for backward compatibility."""
    global _app
    if name == "app":
        if _app is None:
            _app = _get_app()
        return _app
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def login(
    client: "FlaskClient[Any]",
    username: str = "admin",
    password: str = "general",  # noqa: S107
):
    resp = client.post(
        "/login/",
        data=dict(username=username, password=password),  # noqa: C408
    ).get_data(as_text=True)
    assert "User confirmation needed" not in resp
    return resp
