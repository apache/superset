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

"""Core model base classes."""

from typing import Any

from flask_appbuilder import Model
from sqlalchemy.orm import Mapped


class CoreModel(Model):
    """
    Abstract base class that extends Flask-AppBuilder's Model.

    This class provides the interface contract for all Superset models.
    The host package provides concrete implementations.
    """

    __abstract__ = True


class Database(CoreModel):
    """
    Interface for Database models.

    This interface defines the contract that database models should implement,
    providing consistent database connectivity and metadata operations.
    """

    __abstract__ = True

    id = Mapped[int]
    verbose_name = Mapped[str]
    database_name = Mapped[str | None]

    @property
    def name(self) -> str:
        raise NotImplementedError

    @property
    def backend(self) -> str:
        raise NotImplementedError

    @property
    def data(self) -> dict[str, Any]:
        raise NotImplementedError


class Dataset(CoreModel):
    """
    Interface for Dataset models.

    This Interface defines the contract that dataset models should implement,
    providing consistent data source operations and metadata.

    It provides the public API for Datasets implemented by the host application.
    """

    __abstract__ = True
