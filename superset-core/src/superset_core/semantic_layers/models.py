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
Semantic layer model interfaces for superset-core.

Provides abstract model classes for semantic layers and views that will be
replaced by the host implementation's concrete SQLAlchemy models during
initialization.

Usage:
    from superset_core.semantic_layers.models import (
        SemanticLayerModel,
        SemanticViewModel,
    )
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from superset_core.common.models import CoreModel


class SemanticLayerModel(CoreModel):
    """
    Abstract interface for the SemanticLayer database model.

    Host implementations will replace this class during initialization
    with a concrete SQLAlchemy model providing actual persistence.
    """

    __abstract__ = True

    # Type hints for expected column attributes
    uuid: UUID
    name: str
    description: str | None
    type: str
    configuration: str
    configuration_version: int
    cache_timeout: int | None
    created_on: datetime | None
    changed_on: datetime | None


class SemanticViewModel(CoreModel):
    """
    Abstract interface for the SemanticView database model.

    Host implementations will replace this class during initialization
    with a concrete SQLAlchemy model providing actual persistence.
    """

    __abstract__ = True

    # Type hints for expected column attributes
    id: int
    uuid: UUID
    name: str
    description: str | None
    configuration: str
    configuration_version: int
    cache_timeout: int | None
    semantic_layer_uuid: UUID
    created_on: datetime | None
    changed_on: datetime | None


__all__ = ["SemanticLayerModel", "SemanticViewModel"]
