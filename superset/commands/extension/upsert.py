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
from __future__ import annotations

import logging
from functools import partial
from typing import Any

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError
from superset_core.extensions.types import Manifest

from superset.commands.base import BaseCommand
from superset.commands.extension.exceptions import (
    ExtensionBackendError,
    ExtensionEnabledError,
    ExtensionFrontendError,
    ExtensionManifestError,
    ExtensionNameError,
    ExtensionUpsertFailedError,
)
from superset.daos.extension import ExtensionDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpsertExtensionCommand(BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()
        self._name: str
        self._manifest: Manifest
        self._frontend: dict[str, bytes] | None
        self._backend: dict[str, bytes] | None
        self._enabled: bool

    @transaction(on_error=partial(on_error, reraise=ExtensionUpsertFailedError))
    def run(self) -> Model:
        self.validate()
        return ExtensionDAO.upsert(
            name=self._name,
            manifest=self._manifest,
            frontend=self._frontend,
            backend=self._backend,
            enabled=self._enabled,
        )

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        name: str | None = self._properties.get("name")
        manifest: Manifest | None = self._properties.get("manifest")
        frontend: dict[str, bytes] | None = self._properties.get("frontend")
        backend: dict[str, bytes] | None = self._properties.get("backend")
        enabled: bool | None = self._properties.get("enabled")

        # Validate that all fields are correct
        if not name:
            exceptions.append(ExtensionNameError())
        else:
            self._name = name

        if not manifest:
            exceptions.append(ExtensionManifestError())
        else:
            self._manifest = manifest

        if manifest and manifest.get("frontend") and not frontend:
            exceptions.append(ExtensionFrontendError())
        else:
            self._frontend = frontend

        if manifest and manifest.get("backend") and not backend:
            exceptions.append(ExtensionBackendError())
        else:
            self._backend = backend

        if enabled is None:
            exceptions.append(ExtensionEnabledError())
        else:
            self._enabled = enabled

        if exceptions:
            raise ExtensionUpsertFailedError(exceptions=exceptions)
