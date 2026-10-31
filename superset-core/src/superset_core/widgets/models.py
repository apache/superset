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
Widget model API for superset-core.

Provides widget-related model classes that will be replaced by host
implementations during initialization for extension developers to use.

Usage:
    from superset_core.widgets.models import WidgetModel
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from superset_core.common.models import CoreModel


class WidgetModel(CoreModel):
    """
    Abstract Widget model interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.

    A saved widget is one configured occurrence of a widget type: the
    namespaced ``widget_type`` of the registered widget class it instantiates,
    plus ``props`` that are valid against that type's schema at
    ``schema_version``. ``id`` and ``uuid`` identify the saved widget itself.
    """

    __abstract__ = True

    # Type hints for expected column attributes
    id: int
    uuid: UUID
    widget_type: str
    schema_version: int
    name: str
    description: str | None
    props: dict[str, Any]
    revision: int

    # Timestamps and authorship (from AuditMixinNullable)
    created_on: datetime | None
    changed_on: datetime | None
    created_by_fk: int | None
    changed_by_fk: int | None
