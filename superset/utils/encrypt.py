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
from typing import Any, Dict, List, Optional

from flask import Flask
from sqlalchemy import TypeDecorator
from sqlalchemy_utils import EncryptedType


class AbstractEncryptedFieldAdapter(ABC):  # pylint: disable=too-few-public-methods
    @abstractmethod
    def create(
        self,
        app_config: Optional[Dict[str, Any]],
        *args: List[Any],
        **kwargs: Optional[Dict[str, Any]]
    ) -> TypeDecorator:
        pass


class SQLAlchemyUtilsAdapter(  # pylint: disable=too-few-public-methods
    AbstractEncryptedFieldAdapter
):
    def create(
        self,
        app_config: Optional[Dict[str, Any]],
        *args: List[Any],
        **kwargs: Optional[Dict[str, Any]]
    ) -> TypeDecorator:
        if app_config:
            return EncryptedType(*args, app_config["SECRET_KEY"], **kwargs)

        raise Exception("Missing app_config kwarg")


class EncryptedFieldFactory:
    def __init__(self) -> None:
        self._concrete_type_adapter: Optional[AbstractEncryptedFieldAdapter] = None
        self._config: Optional[Dict[str, Any]] = None

    def init_app(self, app: Flask) -> None:
        self._config = app.config
        self._concrete_type_adapter = self._config[
            "SQLALCHEMY_ENCRYPTED_FIELD_TYPE_ADAPTER"
        ]()

    def create(
        self, *args: List[Any], **kwargs: Optional[Dict[str, Any]]
    ) -> TypeDecorator:
        if self._concrete_type_adapter:
            return self._concrete_type_adapter.create(self._config, *args, **kwargs)

        raise Exception("App not initialized yet. Please call init_app first")
