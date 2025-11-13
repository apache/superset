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
Model API for superset-core.

Provides model classes that will be replaced by host implementations
during initialization for extension developers to use.

Usage:
    from superset_core.api.models import Dataset, Database, get_session

    # Use as regular model classes
    dataset = Dataset(name="My Dataset")
    db = Database(database_name="My DB")
    session = get_session()
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from flask_appbuilder import Model
from sqlalchemy.orm import scoped_session


class CoreModel(Model):
    """
    Abstract base class that extends Flask-AppBuilder's Model.

    This base class provides the interface contract for all Superset models.
    The host package provides concrete implementations.
    """

    __abstract__ = True


class Database(CoreModel):
    """
    Abstract class for Database models.

    This abstract class defines the contract that database models should implement,
    providing consistent database connectivity and metadata operations.
    """

    __abstract__ = True

    id: int
    verbose_name: str
    database_name: str | None

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
    Abstract class for Dataset models.

    This abstract class defines the contract that dataset models should implement,
    providing consistent data source operations and metadata.

    It provides the public API for Datasets implemented by the host application.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    uuid: UUID | None
    table_name: str | None
    main_dttm_col: str | None
    database_id: int | None
    schema: str | None
    catalog: str | None
    sql: str | None  # For virtual datasets
    description: str | None
    default_endpoint: str | None
    is_featured: bool
    filter_select_enabled: bool
    offset: int
    cache_timeout: int
    params: str
    perm: str | None
    schema_perm: str | None
    catalog_perm: str | None
    is_managed_externally: bool
    external_url: str | None
    fetch_values_predicate: str | None
    is_sqllab_view: bool
    template_params: str | None
    extra: str | None  # JSON string
    normalize_columns: bool
    always_filter_main_dttm: bool
    folders: str | None  # JSON string


class Chart(CoreModel):
    """
    Abstract Chart/Slice model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    uuid: UUID | None
    slice_name: str | None
    datasource_id: int | None
    datasource_type: str | None
    datasource_name: str | None
    viz_type: str | None
    params: str | None
    query_context: str | None
    description: str | None
    cache_timeout: int
    certified_by: str | None
    certification_details: str | None
    is_managed_externally: bool
    external_url: str | None


class Dashboard(CoreModel):
    """
    Abstract Dashboard model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    uuid: UUID | None
    dashboard_title: str | None
    position_json: str | None
    description: str | None
    css: str | None
    json_metadata: str | None
    slug: str | None
    published: bool
    certified_by: str | None
    certification_details: str | None
    is_managed_externally: bool
    external_url: str | None


class User(CoreModel):
    """
    Abstract User model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    username: str | None
    email: str | None
    first_name: str | None
    last_name: str | None
    active: bool


class Query(CoreModel):
    """
    Abstract Query model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    client_id: str | None
    database_id: int | None
    sql: str | None
    status: str | None
    user_id: int | None
    progress: int
    error_message: str | None


class SavedQuery(CoreModel):
    """
    Abstract SavedQuery model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    uuid: UUID | None
    label: str | None
    sql: str | None
    database_id: int | None
    description: str | None
    user_id: int | None


class Tag(CoreModel):
    """
    Abstract Tag model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    name: str | None
    type: str | None


class KeyValue(CoreModel):
    """
    Abstract KeyValue model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    id: int
    uuid: UUID | None
    resource: str | None
    value: str | None  # Encoded value
    expires_on: datetime | None
    created_by_fk: int | None
    changed_by_fk: int | None


def get_session() -> scoped_session:
    """
    Retrieve the SQLAlchemy session to directly interface with the
    Superset models.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :returns: The SQLAlchemy scoped session instance.
    """
    raise NotImplementedError("Function will be replaced during initialization")


__all__ = [
    "Dataset",
    "Database",
    "Chart",
    "Dashboard",
    "User",
    "Query",
    "SavedQuery",
    "Tag",
    "KeyValue",
    "CoreModel",
    "get_session",
]
