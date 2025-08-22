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

from abc import ABC, abstractmethod
from typing import Type

from flask_appbuilder.api import BaseApi


class RestApi(BaseApi):
    """
    Base REST API class for Superset with browser login support.

    This class extends Flask-AppBuilder's BaseApi and enables browser-based
    authentication by default.
    """

    allow_browser_login = True


class CoreRestApi(ABC):
    """
    Abstract interface for managing REST APIs in Superset.

    This class defines the contract for adding and managing REST APIs,
    including both core APIs and extension APIs.
    """

    @staticmethod
    @abstractmethod
    def add_api(api: Type[RestApi]) -> None:
        """
        Add a REST API to the Superset API.

        :param api: A REST API instance.
        :returns: None.
        """
        ...

    @staticmethod
    @abstractmethod
    def add_extension_api(api: Type[RestApi]) -> None:
        """
        Add an extension REST API to the Superset API.

        :param api: An extension REST API instance. These are placed under
            the /extensions resource.
        :returns: None.
        """
        ...
