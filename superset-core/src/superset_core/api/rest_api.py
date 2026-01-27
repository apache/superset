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

"""
REST API functions for superset-core.

Provides dependency-injected REST API utility functions that will be replaced by
host implementations during initialization.

Usage:
    from superset_core.api.rest_api import add_api, add_extension_api

    add_api(MyCustomAPI)
    add_extension_api(MyExtensionAPI)
"""

from flask_appbuilder.api import BaseApi


class RestApi(BaseApi):
    """
    Base REST API class for Superset with browser login support.

    This class extends Flask-AppBuilder's BaseApi and enables browser-based
    authentication by default.
    """

    allow_browser_login = True


def add_api(api: type[RestApi]) -> None:
    """
    Add a REST API to the Superset API.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param api: A REST API instance.
    :returns: None.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def add_extension_api(api: type[RestApi]) -> None:
    """
    Add an extension REST API to the Superset API.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :param api: An extension REST API instance. These are placed under
        the /extensions resource.
    :returns: None.
    """
    raise NotImplementedError("Function will be replaced during initialization")


__all__ = ["RestApi", "add_api", "add_extension_api"]
