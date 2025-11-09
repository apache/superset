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
from uuid import UUID

from flask_appbuilder import Model
from sqlalchemy.orm import Mapped


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
    Abstract class for Dataset models.

    This abstract class defines the contract that dataset models should implement,
    providing consistent data source operations and metadata.

    It provides the public API for Datasets implemented by the host application.
    """

    __abstract__ = True

    id = Mapped[int]
    uuid = Mapped[UUID | None]
    table_name = Mapped[str | None]
    main_dttm_col = Mapped[str | None]
    database_id = Mapped[int | None]
    schema = Mapped[str | None]
    catalog = Mapped[str | None]
    sql = Mapped[str | None]  # For virtual datasets
    description = Mapped[str | None]
    default_endpoint = Mapped[str | None]
    is_featured = Mapped[bool]
    filter_select_enabled = Mapped[bool]
    offset = Mapped[int]
    cache_timeout = Mapped[int | None]
    params = Mapped[str | None]
    perm = Mapped[str | None]
    schema_perm = Mapped[str | None]
    catalog_perm = Mapped[str | None]
    is_managed_externally = Mapped[bool]
    external_url = Mapped[str | None]
    fetch_values_predicate = Mapped[str | None]
    is_sqllab_view = Mapped[bool]
    template_params = Mapped[str | None]
    extra = Mapped[str | None]  # JSON string
    normalize_columns = Mapped[bool]
    always_filter_main_dttm = Mapped[bool]
    folders = Mapped[str | None]  # JSON string


class Chart(CoreModel):
    """
    Abstract Chart/Slice model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    id = Mapped[int]
    uuid = Mapped[UUID | None]
    slice_name = Mapped[str | None]
    datasource_id = Mapped[int | None]
    datasource_type = Mapped[str | None]
    datasource_name = Mapped[str | None]
    viz_type = Mapped[str | None]
    params = Mapped[str | None]
    query_context = Mapped[str | None]
    description = Mapped[str | None]
    cache_timeout = Mapped[int | None]
    certified_by = Mapped[str | None]
    certification_details = Mapped[str | None]
    is_managed_externally = Mapped[bool]
    external_url = Mapped[str | None]


class Dashboard(CoreModel):
    """
    Abstract Dashboard model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    id = Mapped[int]
    uuid = Mapped[UUID | None]
    dashboard_title = Mapped[str | None]
    position_json = Mapped[str | None]
    description = Mapped[str | None]
    css = Mapped[str | None]
    json_metadata = Mapped[str | None]
    slug = Mapped[str | None]
    published = Mapped[bool]
    certified_by = Mapped[str | None]
    certification_details = Mapped[str | None]
    is_managed_externally = Mapped[bool]
    external_url = Mapped[str | None]


class User(CoreModel):
    """
    Abstract User model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    id = Mapped[int]
    username = Mapped[str | None]
    email = Mapped[str | None]
    first_name = Mapped[str | None]
    last_name = Mapped[str | None]
    active = Mapped[bool]


class Query(CoreModel):
    """
    Abstract Query model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    id = Mapped[int]
    client_id = Mapped[str | None]
    database_id = Mapped[int | None]
    sql = Mapped[str | None]
    status = Mapped[str | None]
    user_id = Mapped[int | None]
    progress = Mapped[int]
    error_message = Mapped[str | None]


class SavedQuery(CoreModel):
    """
    Abstract SavedQuery model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    id = Mapped[int]
    uuid = Mapped[UUID | None]
    label = Mapped[str | None]
    sql = Mapped[str | None]
    database_id = Mapped[int | None]
    description = Mapped[str | None]
    user_id = Mapped[int | None]


class Tag(CoreModel):
    """
    Abstract Tag model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    id = Mapped[int]
    name = Mapped[str | None]
    type = Mapped[str | None]


class KeyValue(CoreModel):
    """
    Abstract KeyValue model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    id = Mapped[int]
    uuid = Mapped[UUID | None]
    resource = Mapped[str | None]
    value = Mapped[str | None]  # Encoded value
    expires_on = Mapped[Any | None]  # datetime or None
    created_by_fk = Mapped[int | None]
    changed_by_fk = Mapped[int | None]
